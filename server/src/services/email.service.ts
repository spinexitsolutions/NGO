import nodemailer, { type Transporter } from 'nodemailer';
import { marked } from 'marked';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { DEFAULT_EMAIL_TEMPLATES } from './emailTemplates.js';
import { getPublished } from './config.service.js';

let transporter: Transporter | null = null;
function getTransport(): Transporter | null {
  if (env.EMAIL_TRANSPORT !== 'smtp') return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Substitutes {{vars}}. Values are HTML-escaped; the template itself is trusted admin markdown with raw HTML stripped. */
export function renderTemplate(source: string, vars: Record<string, string>, escape = true): string {
  return source.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k] ?? '';
    return escape ? escapeHtml(v) : v;
  });
}

function markdownToHtml(md: string): string {
  // Strip raw HTML from the template markdown before rendering.
  const html = marked.parse(md.replace(/<[^>]*>/g, ''), { async: false }) as string;
  return html.replace(/<a href="(?!https?:|mailto:)[^"]*"/g, '<a href="#"');
}

function layout(bodyHtml: string, org: { name: string; address: string }, color: string, footerExtra = ''): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f2ec;font-family:Helvetica,Arial,sans-serif;color:#252a27">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${color};padding:20px 32px;color:#ffffff;font-size:18px;font-weight:bold">${escapeHtml(org.name)}</td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:16px 32px;background:#faf8f3;color:#6b706c;font-size:12px;line-height:1.5">${escapeHtml(org.address)}${footerExtra}</td></tr>
</table></td></tr></table></body></html>`;
}

export interface SendOptions {
  to: string;
  template: string;
  vars: Record<string, string>;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
  related?: { type: string; id: string };
}

/** Sends a templated email and records it in EmailLog. Never throws — failures are logged. */
export async function sendTemplate(opts: SendOptions): Promise<boolean> {
  const fallback = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === opts.template);
  const tpl = (await prisma.emailTemplate.findUnique({ where: { key: opts.template } })) ?? fallback;
  if (!tpl) {
    logger.error({ template: opts.template }, 'Unknown email template');
    return false;
  }
  const [settings, theme] = await Promise.all([getPublished('settings'), getPublished('theme')]);
  const vars: Record<string, string> = { orgName: settings.organization.name, ...opts.vars };
  const subject = renderTemplate(tpl.subject, vars, false).replace(/[\r\n]+/g, ' ').slice(0, 200);
  const unsubscribe = tpl.isMarketing && vars.unsubscribeUrl
    ? `<br><a href="${escapeHtml(vars.unsubscribeUrl)}" style="color:#6b706c">Unsubscribe</a>`
    : '';
  const html = layout(markdownToHtml(renderTemplate(tpl.body, vars)), { name: settings.organization.name, address: settings.contact.address }, theme.colors.primary, unsubscribe);
  const text = renderTemplate(tpl.body, vars, false);

  let status = 'SENT';
  let error = '';
  try {
    const t = getTransport();
    if (env.EMAIL_TRANSPORT === 'none') status = 'SKIPPED';
    else if (!t) logger.info({ to: opts.to, subject, text }, '[email:log] email not sent (EMAIL_TRANSPORT=log)');
    else
      await t.sendMail({
        from: env.EMAIL_FROM,
        to: opts.to,
        subject,
        html,
        text,
        attachments: opts.attachments,
        headers: tpl.isMarketing && vars.unsubscribeUrl ? { 'List-Unsubscribe': `<${vars.unsubscribeUrl}>` } : undefined,
      });
  } catch (err) {
    status = 'FAILED';
    error = err instanceof Error ? err.message : String(err);
    logger.error({ err, to: opts.to, template: opts.template }, 'Email failed');
  }
  await prisma.emailLog.create({
    data: { to: opts.to, templateKey: opts.template, subject, status, error, relatedType: opts.related?.type ?? '', relatedId: opts.related?.id ?? '' },
  });
  return status === 'SENT';
}

export async function previewTemplate(key: string, subject: string, body: string, vars: Record<string, string>) {
  const [settings, theme] = await Promise.all([getPublished('settings'), getPublished('theme')]);
  const all = { orgName: settings.organization.name, ...vars };
  return {
    subject: renderTemplate(subject, all, false),
    html: layout(markdownToHtml(renderTemplate(body, all)), { name: settings.organization.name, address: settings.contact.address }, theme.colors.primary),
    key,
  };
}
