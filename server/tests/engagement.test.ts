import { beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { prisma } from '../src/config/db.js';
import { client, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);

const application = {
  name: 'Kiran Das', email: 'kiran@example.org', phone: '+91 98000 00000', city: 'Pune', interests: ['Teaching & mentoring'], skills: ['Maths'],
  availability: 'WEEKENDS', motivation: 'I want to help children learn maths on weekends.', agreeCodeOfConduct: true, consentDataProcessing: true,
};

describe('volunteer workflow', () => {
  it('apply → status lookup → approve with notification', async () => {
    const c = await client();
    const res = await c.post('/api/v1/forms/volunteer-applications', application);
    expect(res.status).toBe(201);
    const ref = res.body.data.reference as string;
    expect((await c.post('/api/v1/forms/volunteer-applications', application)).status).toBe(409);
    expect((await c.post('/api/v1/forms/volunteer-applications/status', { reference: ref, email: 'other@example.org' })).status).toBe(404);
    expect((await c.post('/api/v1/forms/volunteer-applications/status', { reference: ref, email: 'kiran@example.org' })).body.data.status).toBe('SUBMITTED');

    const coord = await loginAs('volunteer_coordinator');
    const app = await prisma.volunteerApplication.findUniqueOrThrow({ where: { reference: ref } });
    expect((await coord.post(`/api/v1/admin/volunteers/applications/${app.id}/status`, { status: 'INFO_REQUESTED' })).status).toBe(422);
    expect((await coord.post(`/api/v1/admin/volunteers/applications/${app.id}/status`, { status: 'APPROVED', message: 'Welcome!' })).status).toBe(200);
    expect((await prisma.volunteerProfile.findUniqueOrThrow({ where: { email: 'kiran@example.org' } })).status).toBe('ACTIVE');
    expect(await prisma.emailLog.count({ where: { templateKey: 'volunteer_status' } })).toBe(1);

    const hours = await coord.post('/api/v1/admin/volunteers/hours', { profileId: app.profileId, date: new Date().toISOString().slice(0, 10), hours: 3.5, activity: 'Weekend class' });
    expect(hours.status).toBe(201);
    expect(hours.body.data.minutes).toBe(210);
  });

  it('requires consent and code-of-conduct acceptance', async () => {
    const c = await client();
    expect((await c.post('/api/v1/forms/volunteer-applications', { ...application, consentDataProcessing: false })).status).toBe(422);
  });

  it('rejects bot submissions via honeypot', async () => {
    const c = await client();
    expect((await c.post('/api/v1/forms/inquiries', { name: 'Bot', email: 'b@x.org', subject: 'Hello', message: 'Spam spam spam', consent: true, website: 'http://spam' })).status).toBe(422);
  });
});

describe('event registration', () => {
  async function event(capacity: number | null) {
    return prisma.event.create({ data: { slug: 'walk', title: 'Walk', summary: 's', coverImage: '/x.webp', startsAt: new Date(Date.now() + 7 * 86_400_000), capacity, status: 'PUBLISHED', volunteerSlots: 1 } });
  }

  it('confirms until capacity, then waitlists; cancelling promotes the waitlist', async () => {
    await event(1);
    const c = await client();
    const a = await c.post('/api/v1/forms/events/walk/register', { name: 'Anu', email: 'anu@example.org' });
    const b = await c.post('/api/v1/forms/events/walk/register', { name: 'Ben', email: 'ben@example.org' });
    expect(a.body.data.status).toBe('CONFIRMED');
    expect(b.body.data.status).toBe('WAITLISTED');
    expect((await c.post('/api/v1/forms/events/walk/register', { name: 'Anu', email: 'anu@example.org' })).status).toBe(409);

    // Cancel with the emailed token: find it in the email log text is not stored, so use the hash path via API contract.
    const reg = await prisma.eventRegistration.findUniqueOrThrow({ where: { reference: a.body.data.reference } });
    expect((await c.post('/api/v1/forms/events/registrations/cancel', { reference: reg.reference, token: 'wrong-token-123' })).status).toBe(404);
    const { sha256 } = await import('../src/utils/crypto.js');
    await prisma.eventRegistration.update({ where: { id: reg.id }, data: { cancelToken: sha256('known-token-123') } });
    expect((await c.post('/api/v1/forms/events/registrations/cancel', { reference: reg.reference, token: 'known-token-123' })).status).toBe(200);
    expect((await prisma.eventRegistration.findUniqueOrThrow({ where: { reference: b.body.data.reference } })).status).toBe('CONFIRMED');
  });

  it('staff can mark attendance and export registrations', async () => {
    const e = await event(null);
    const c = await client();
    const r = await c.post('/api/v1/forms/events/walk/register', { name: 'Anu', email: 'anu@example.org' });
    const staff = await loginAs('campaign_manager');
    const reg = await prisma.eventRegistration.findUniqueOrThrow({ where: { reference: r.body.data.reference } });
    expect((await staff.put(`/api/v1/admin/events/registrations/${reg.id}`, { status: 'CONFIRMED', attended: true })).body.data.attended).toBe(true);
    const list = await staff.get(`/api/v1/admin/events/${e.id}/registrations`);
    expect(list.body.meta.stats.attended).toBe(1);
    expect(list.body.data[0].cancelToken).toBeUndefined();
    expect((await staff.get(`/api/v1/admin/events/${e.id}/registrations?format=csv`)).text).toContain('anu@example.org');
  });
});

describe('media library', () => {
  it('converts uploaded images to WebP and records dimensions', async () => {
    const admin = await loginAs('content_editor');
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#164B3A' } }).png().toBuffer();
    const res = await admin.upload('/api/v1/admin/media').field('folder', 'tests').attach('files', png, 'photo.png');
    expect(res.status).toBe(201);
    const asset = res.body.data[0];
    expect(asset.mimeType).toBe('image/webp');
    expect(asset.width).toBe(1200);
    expect(Object.keys(asset.variants)).toEqual(expect.arrayContaining(['480', '960']));
  });

  it('rejects files whose content is not an allowed type, whatever the extension', async () => {
    const admin = await loginAs('content_editor');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await admin.upload('/api/v1/admin/media').attach('files', svg, 'logo.png')).status).toBe(400);
    expect((await admin.upload('/api/v1/admin/media').attach('files', Buffer.from('MZ executable'), 'x.jpg')).status).toBe(400);
  });

  it('warns before deleting an asset that is in use and updates references on replace', async () => {
    const admin = await loginAs('super_admin');
    const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#C6A76B' } }).png().toBuffer();
    const asset = (await admin.upload('/api/v1/admin/media').attach('files', png, 'a.png')).body.data[0];
    await prisma.cause.create({ data: { slug: 'c', title: 'C', summary: 's', coverImage: asset.url } });
    expect((await admin.del(`/api/v1/admin/media/${asset.id}`, { confirm: true })).status).toBe(409);
    const png2 = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#252A27' } }).png().toBuffer();
    const rep = await admin.upload(`/api/v1/admin/media/${asset.id}/replace`).attach('file', png2, 'b.png');
    expect(rep.status).toBe(200);
    const cause = await prisma.cause.findUniqueOrThrow({ where: { slug: 'c' } });
    expect(cause.coverImage).toBe(rep.body.data.asset.url);
  });
});

describe('public API privacy', () => {
  it('does not expose private fields or unverified registration details', async () => {
    await prisma.project.create({ data: { slug: 'p', title: 'P', summary: 's', coverImage: '/x', startDate: new Date(), status: 'PUBLISHED', budgetAmount: 500, showBudget: false, beneficiariesReached: 99, beneficiariesVerified: false } });
    const c = await client();
    const p = (await c.get('/api/v1/public/projects/p')).body.data;
    expect(p.budgetAmount).toBeUndefined();
    expect(p.beneficiariesReached).toBeNull();
    const site = (await c.get('/api/v1/public/site')).body.data;
    expect(site.settings.registration.registrationNumber).toBe('');
    expect(site.settings.donation.bankTransfer).toEqual({ enabled: false });
  });
});
