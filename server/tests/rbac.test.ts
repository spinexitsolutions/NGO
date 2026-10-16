import { beforeEach, describe, expect, it } from 'vitest';
import { client, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);

const story = { title: 'A story', slug: 'a-story', excerpt: 'Excerpt', body: 'Body', image: '/uploads/x.webp', consentObtained: true };

describe('role-based access control (enforced by the API)', () => {
  it('anonymous users get 401 on admin APIs', async () => {
    const c = await client();
    for (const url of ['/api/v1/admin/donations', '/api/v1/admin/pages', '/api/v1/admin/config/theme', '/api/v1/admin/beneficiaries', '/api/v1/admin/users']) {
      expect((await c.get(url)).status, url).toBe(401);
    }
  });

  it('content editors cannot see donations, beneficiaries, users or the theme', async () => {
    const ed = await loginAs('content_editor');
    for (const url of ['/api/v1/admin/donations', '/api/v1/admin/donors', '/api/v1/admin/beneficiaries', '/api/v1/admin/users', '/api/v1/admin/config/theme', '/api/v1/admin/audit']) {
      expect((await ed.get(url)).status, url).toBe(403);
    }
    expect((await ed.get('/api/v1/admin/pages')).status).toBe(200);
  });

  it('finance managers can view donations but not edit pages', async () => {
    const fin = await loginAs('finance_manager');
    expect((await fin.get('/api/v1/admin/donations')).status).toBe(200);
    expect((await fin.get('/api/v1/admin/pages')).status).toBe(403);
    expect((await fin.get('/api/v1/admin/collections/stories')).status).toBe(403);
  });

  it('publishing content requires content.publish', async () => {
    const admin = await loginAs('super_admin');
    // A custom role that can manage content but not publish it.
    const roleRes = await admin.post('/api/v1/admin/roles', { key: 'writer', name: 'Writer', permissions: ['content.manage'] });
    expect(roleRes.status).toBe(201);
    const writer = await loginAs('writer');
    expect((await writer.post('/api/v1/admin/collections/stories', { ...story, status: 'DRAFT' })).status).toBe(201);
    expect((await writer.post('/api/v1/admin/collections/stories', { ...story, slug: 'b', status: 'PUBLISHED' })).status).toBe(403);
  });

  it('only users.manage can change roles; super admin role is protected', async () => {
    const dir = await loginAs('director');
    expect((await dir.get('/api/v1/admin/roles')).status).toBe(403);
    const admin = await loginAs('super_admin');
    const roles = (await admin.get('/api/v1/admin/roles')).body.data as { id: string; key: string }[];
    const sa = roles.find((r) => r.key === 'super_admin')!;
    expect((await admin.put(`/api/v1/admin/roles/${sa.id}`, { name: 'Renamed', permissions: [] })).status).toBe(400);
  });

  it('rejects unknown permissions when editing roles', async () => {
    const admin = await loginAs('super_admin');
    expect((await admin.post('/api/v1/admin/roles', { key: 'bad_role', name: 'Bad', permissions: ['everything'] })).status).toBe(422);
  });

  it('stories cannot be published without consent', async () => {
    const admin = await loginAs('super_admin');
    const res = await admin.post('/api/v1/admin/collections/stories', { ...story, consentObtained: false, status: 'PUBLISHED' });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].path).toBe('consentObtained');
  });
});
