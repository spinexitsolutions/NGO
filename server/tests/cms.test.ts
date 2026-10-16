import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME, createSection } from '@ngo/shared';
import { prisma } from '../src/config/db.js';
import { client, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);

describe('theme customizer (draft → publish)', () => {
  it('saving a draft does not change the live site; publishing does', async () => {
    const admin = await loginAs('super_admin');
    const pub = await client();
    const v0 = (await pub.get('/api/v1/public/site/version')).body.data.version;
    const draft = { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: '#123456' } };
    expect((await admin.put('/api/v1/admin/config/theme/draft', draft)).status).toBe(200);
    expect((await pub.get('/api/v1/public/site')).body.data.theme.colors.primary).toBe('#164B3A');
    const res = await admin.post('/api/v1/admin/config/theme/publish', { note: 'New brand colour' });
    expect(res.status).toBe(200);
    expect((await pub.get('/api/v1/public/site')).body.data.theme.colors.primary).toBe('#123456');
    expect((await pub.get('/api/v1/public/site/version')).body.data.version).toBeGreaterThan(v0);
    expect(await prisma.auditLog.count({ where: { action: 'theme.published' } })).toBe(1);
  });

  it('rejects invalid theme values', async () => {
    const admin = await loginAs('super_admin');
    const res = await admin.put('/api/v1/admin/config/theme/draft', { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: 'javascript:alert(1)' } });
    expect(res.status).toBe(422);
  });

  it('restores a previous published version into the draft', async () => {
    const admin = await loginAs('super_admin');
    await admin.put('/api/v1/admin/config/theme/draft', { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: '#111111' } });
    await admin.post('/api/v1/admin/config/theme/publish', {});
    const versions = (await admin.get('/api/v1/admin/config/theme/versions')).body.data as { id: string; version: number }[];
    const first = versions.find((v) => v.version === 1)!;
    const restored = await admin.post(`/api/v1/admin/config/theme/versions/${first.id}/restore`);
    expect(restored.body.data.draft.colors.primary).toBe('#164B3A');
    expect(restored.body.data.published.colors.primary).toBe('#111111');
    expect(restored.body.data.hasUnpublishedChanges).toBe(true);
  });

  it('resets a single settings group to defaults', async () => {
    const admin = await loginAs('super_admin');
    const current = (await admin.get('/api/v1/admin/config/settings')).body.data.draft;
    await admin.put('/api/v1/admin/config/settings/draft', { ...current, announcement: { ...current.announcement, text: 'Changed' }, organization: { ...current.organization, name: 'Renamed NGO' } });
    const res = await admin.post('/api/v1/admin/config/settings/reset', { group: 'announcement' });
    expect(res.body.data.draft.announcement.text).not.toBe('Changed');
    expect(res.body.data.draft.organization.name).toBe('Renamed NGO');
  });
});

describe('pages & sections', () => {
  async function newPage(admin: Awaited<ReturnType<typeof loginAs>>) {
    const res = await admin.post('/api/v1/admin/pages', { title: 'Our partners', slug: 'our-partners', template: 'blank' });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  it('publishing validates every section and leaves the live page untouched on error', async () => {
    const admin = await loginAs('super_admin');
    const id = await newPage(admin);
    const pub = await client();
    expect((await pub.get('/api/v1/public/pages/our-partners')).status).toBe(404);

    const bad = createSection('hero'); // heading is required
    await admin.put(`/api/v1/admin/pages/${id}/draft`, { title: 'Our partners', seo: {}, sections: [bad] });
    const res = await admin.post(`/api/v1/admin/pages/${id}/publish`, {});
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].id).toBe(bad.id);
    expect((await pub.get('/api/v1/public/pages/our-partners')).status).toBe(404);

    const good = { ...bad, props: { ...bad.props, heading: 'Partners' } };
    const hidden = { ...createSection('richText', { body: 'Hidden text' }), visible: false };
    await admin.put(`/api/v1/admin/pages/${id}/draft`, { title: 'Our partners', seo: {}, sections: [hidden, good] });
    expect((await admin.post(`/api/v1/admin/pages/${id}/publish`, { note: 'v1' })).status).toBe(200);
    const live = await pub.get('/api/v1/public/pages/our-partners');
    expect(live.status).toBe(200);
    expect(live.body.data.sections.map((s: { type: string }) => s.type)).toEqual(['richText', 'hero']); // order preserved
  });

  it('drafts do not leak to the public until published; versions can be restored', async () => {
    const admin = await loginAs('super_admin');
    const id = await newPage(admin);
    const v1 = createSection('richText', { body: 'Version one' });
    await admin.put(`/api/v1/admin/pages/${id}/draft`, { title: 'P', seo: {}, sections: [v1] });
    await admin.post(`/api/v1/admin/pages/${id}/publish`, {});
    await admin.put(`/api/v1/admin/pages/${id}/draft`, { title: 'P', seo: {}, sections: [{ ...v1, props: { ...v1.props, body: 'Version two draft' } }] });
    const pub = await client();
    expect((await pub.get('/api/v1/public/pages/our-partners')).body.data.sections[0].props.body).toBe('Version one');
    const versions = (await admin.get(`/api/v1/admin/pages/${id}/versions`)).body.data;
    await admin.post(`/api/v1/admin/pages/${id}/versions/${versions[0].id}/restore`);
    expect((await admin.get(`/api/v1/admin/pages/${id}`)).body.data.draft.sections[0].props.body).toBe('Version one');
  });

  it('rejects reserved slugs and protects system pages', async () => {
    const admin = await loginAs('super_admin');
    expect((await admin.post('/api/v1/admin/pages', { title: 'x', slug: 'admin' })).status).toBe(422);
    const page = await prisma.page.create({ data: { slug: 'home', isSystem: true, draft: { title: 'Home', seo: {}, sections: [] } } });
    expect((await admin.del(`/api/v1/admin/pages/${page.id}`, { confirm: true })).status).toBe(400);
    expect((await admin.post(`/api/v1/admin/pages/${page.id}/unpublish`)).status).toBe(400);
  });

  it('delete requires explicit confirmation', async () => {
    const admin = await loginAs('super_admin');
    const id = await newPage(admin);
    expect((await admin.del(`/api/v1/admin/pages/${id}`)).status).toBe(422);
    expect((await admin.del(`/api/v1/admin/pages/${id}`, { confirm: true })).status).toBe(200);
  });

  it('scheduled pages publish when due', async () => {
    const admin = await loginAs('super_admin');
    const id = await newPage(admin);
    await admin.put(`/api/v1/admin/pages/${id}/draft`, { title: 'P', seo: {}, sections: [createSection('richText', { body: 'Later' })] });
    expect((await admin.post(`/api/v1/admin/pages/${id}/schedule`, { at: new Date(Date.now() + 60_000).toISOString() })).status).toBe(200);
    const { runScheduledPublishing } = await import('../src/services/page.service.js');
    expect((await runScheduledPublishing(new Date())).pages).toBe(0);
    expect((await runScheduledPublishing(new Date(Date.now() + 120_000))).pages).toBe(1);
    expect((await (await client()).get('/api/v1/public/pages/our-partners')).status).toBe(200);
  });
});
