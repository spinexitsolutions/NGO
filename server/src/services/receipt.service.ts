import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { toMajor } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './audit.service.js';
import { getPublished } from './config.service.js';

export interface ReceiptSnapshot {
  org: { name: string; legalName: string; address: string; email: string; phone: string; registration: { label: string; value: string }[] };
  taxText: string;
  donor: { name: string; email: string; phone: string; pan: string; address: string };
  amount: number;
  currency: string;
  amountInWords: string;
  method: string;
  donationReference: string;
  paymentReference: string;
  paidAt: string;
  purpose: string;
  frequency: string;
  footer: string;
  signatory: { name: string; title: string };
}

/** Indian financial year label (April–March), e.g. 2026-27. */
export function financialYear(date: Date): string {
  const y = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

async function nextReceiptNumber(date: Date, tx: Prisma.TransactionClient): Promise<string> {
  const fy = financialYear(date);
  const c = await tx.counter.upsert({ where: { key: `receipt:${fy}` }, create: { key: `receipt:${fy}`, value: 1 }, update: { value: { increment: 1 } } });
  return `RCPT/${fy}/${String(c.value).padStart(6, '0')}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigits(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}
/** Indian numbering (lakh, crore). */
export function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

export function amountInWords(minor: number, currency: string): string {
  const major = Math.floor(toMajor(minor, currency));
  const fraction = minor % 100;
  const unit = currency === 'INR' ? ['Rupees', 'Paise'] : [currency, 'cents'];
  return `${unit[0]} ${numberToWords(major)}${fraction ? ` and ${twoDigits(fraction)} ${unit[1]}` : ''} Only`;
}

async function buildSnapshot(donationId: string, overrides?: Partial<ReceiptSnapshot['donor']>): Promise<ReceiptSnapshot> {
  const d = await prisma.donation.findUniqueOrThrow({ where: { id: donationId }, include: { donor: true, campaign: true, cause: true, event: true } });
  const s = await getPublished('settings');
  const reg = s.registration;
  const registration = reg.verified
    ? [
        reg.registrationType && reg.registrationNumber ? { label: reg.registrationType, value: reg.registrationNumber } : null,
        reg.pan ? { label: 'PAN', value: reg.pan } : null,
        ...reg.otherCredentials.filter((c) => c.label && c.value),
      ].filter((x): x is { label: string; value: string } => Boolean(x))
    : [];
  return {
    org: {
      name: s.organization.name,
      legalName: reg.verified ? reg.legalName : '',
      address: s.contact.address,
      email: s.contact.email,
      phone: s.contact.phone,
      registration,
    },
    // Tax text is printed only when the organisation has verified registrations and enabled it.
    taxText: reg.verified && reg.taxExemptionEnabled ? reg.taxExemptionText : '',
    donor: {
      name: overrides?.name ?? d.donor.name,
      email: d.donor.email,
      phone: d.donor.phone,
      pan: overrides?.pan ?? d.donor.pan,
      address: overrides?.address ?? d.donor.address,
    },
    amount: d.amount,
    currency: d.currency,
    amountInWords: amountInWords(d.amount, d.currency),
    method: d.isOffline ? d.method.replace('_', ' ') : 'Online payment',
    donationReference: d.reference,
    paymentReference: d.providerPaymentId ?? d.offlineReference ?? '',
    paidAt: (d.paidAt ?? d.createdAt).toISOString(),
    purpose: d.campaign?.title ?? d.cause?.title ?? d.event?.title ?? 'General donation',
    frequency: d.frequency === 'MONTHLY' ? 'Monthly' : 'One-time',
    footer: s.donation.receiptFooter,
    signatory: { name: s.donation.signatoryName, title: s.donation.signatoryTitle },
  };
}

/** Issues a receipt for a successful donation. Idempotent: returns the existing active receipt. */
export async function issueReceipt(donationId: string) {
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: donationId } });
  if (!['SUCCESS', 'PARTIALLY_REFUNDED'].includes(donation.status)) throw AppError.badRequest('Receipts can only be issued for successful donations');
  const existing = await prisma.receipt.findFirst({ where: { donationId, status: 'ISSUED' } });
  if (existing) return existing;
  const snapshot = await buildSnapshot(donationId);
  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction to avoid two concurrent issuers.
    const again = await tx.receipt.findFirst({ where: { donationId, status: 'ISSUED' } });
    if (again) return again;
    const receiptNumber = await nextReceiptNumber(donation.paidAt ?? new Date(), tx);
    return tx.receipt.create({ data: { donationId, receiptNumber, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
  });
}

/** Voids a receipt (with reason), optionally issuing a corrected replacement. Audited. */
export async function voidReceipt(req: Request, receiptId: string, reason: string, correction?: Partial<ReceiptSnapshot['donor']> | null) {
  const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
  if (receipt.status === 'VOIDED') throw AppError.conflict('Receipt is already void');
  const snapshot = correction ? await buildSnapshot(receipt.donationId, correction) : null;
  return prisma.$transaction(async (tx) => {
    const voided = await tx.receipt.update({ where: { id: receiptId }, data: { status: 'VOIDED', voidedAt: new Date(), voidReason: reason, voidedById: req.user!.id } });
    let replacement = null;
    if (snapshot) {
      const receiptNumber = await nextReceiptNumber(new Date(), tx);
      replacement = await tx.receipt.create({
        data: { donationId: receipt.donationId, receiptNumber, snapshot: snapshot as unknown as Prisma.InputJsonValue, replacesId: receipt.id },
      });
    }
    await audit(
      req,
      {
        action: replacement ? 'receipt.corrected' : 'receipt.voided',
        entityType: 'Receipt',
        entityId: receipt.id,
        summary: `${receipt.receiptNumber} voided: ${reason}${replacement ? ` → ${replacement.receiptNumber}` : ''}`,
        before: receipt.snapshot,
        after: replacement?.snapshot,
      },
      tx,
    );
    return { voided, replacement };
  });
}

function money(minor: number, currency: string) {
  return `${currency} ${toMajor(minor, currency).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Renders the stored snapshot to PDF — what was issued is exactly what is re-printed. */
export async function receiptPdf(receiptId: string): Promise<Buffer> {
  const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
  const s = receipt.snapshot as unknown as ReceiptSnapshot;
  const theme = await getPublished('theme');
  const brand = theme.colors.primary;

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Receipt ${receipt.receiptNumber}`, Author: s.org.name } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.rect(0, 0, doc.page.width, 110).fill(brand);
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(s.org.name, 50, 36);
  doc.fontSize(9).font('Helvetica').text([s.org.legalName, s.org.address].filter(Boolean).join(' · '), 50, 64, { width: 495 });
  doc.text([s.org.email, s.org.phone].filter(Boolean).join(' · '), 50, 78, { width: 495 });

  doc.fillColor('#252A27').fontSize(16).font('Helvetica-Bold').text('Donation Receipt', 50, 135);
  if (receipt.status === 'VOIDED') {
    doc.save().rotate(-30, { origin: [300, 420] }).fontSize(80).fillColor('#cc0000').opacity(0.18).text('VOID', 160, 380).restore();
    doc.opacity(1);
  }
  doc.fontSize(10).font('Helvetica').fillColor('#5C635E');
  doc.text(`Receipt No: ${receipt.receiptNumber}`, 50, 160);
  doc.text(`Issued: ${receipt.issuedAt.toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 350, 160, { width: 195, align: 'right' });

  const rows: [string, string][] = [
    ['Received with thanks from', s.donor.name],
    ['Email', s.donor.email],
    ...(s.donor.pan ? ([['PAN', s.donor.pan]] as [string, string][]) : []),
    ...(s.donor.address ? ([['Address', s.donor.address]] as [string, string][]) : []),
    ['Amount', money(s.amount, s.currency)],
    ['Amount in words', s.amountInWords],
    ['Towards', s.purpose],
    ['Type', s.frequency],
    ['Mode of payment', s.method],
    ['Date of payment', new Date(s.paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' })],
    ['Donation reference', s.donationReference],
    ...(s.paymentReference ? ([['Payment reference', s.paymentReference]] as [string, string][]) : []),
  ];
  let y = 195;
  for (const [label, value] of rows) {
    doc.font('Helvetica').fontSize(10).fillColor('#5C635E').text(label, 50, y, { width: 170 });
    doc.font('Helvetica-Bold').fillColor('#252A27').text(value, 220, y, { width: 325 });
    y = Math.max(doc.y, y + 14) + 8;
    doc.moveTo(50, y - 4).lineTo(545, y - 4).strokeColor('#E2DCCB').lineWidth(0.5).stroke();
  }

  y += 10;
  if (s.org.registration.length) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#252A27').text('Registration details', 50, y);
    y = doc.y + 4;
    for (const r of s.org.registration) {
      doc.font('Helvetica').fontSize(9).fillColor('#5C635E').text(`${r.label}: ${r.value}`, 50, y);
      y = doc.y + 2;
    }
    y += 8;
  }
  if (s.taxText) {
    doc.font('Helvetica').fontSize(9).fillColor('#252A27').text(s.taxText, 50, y, { width: 495 });
    y = doc.y + 10;
  }
  if (s.signatory.name) {
    doc.font('Helvetica-Bold').fontSize(10).text(s.signatory.name, 350, y + 30, { width: 195, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#5C635E').text(s.signatory.title, 350, doc.y, { width: 195, align: 'right' });
  }
  doc.fontSize(8).fillColor('#8A908B').text(s.footer, 50, 780, { width: 495, align: 'center' });
  doc.end();
  return done;
}
