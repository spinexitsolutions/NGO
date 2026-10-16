import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/db.js';
import { sha256 } from '../src/utils/crypto.js';
import { totp } from '../src/utils/totp.js';
import { PASSWORD, app, client, createUser, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);

describe('authentication', () => {
  it('rejects state-changing requests without a CSRF token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'x@y.org', password: 'nope' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF');
  });

  it('logs in with an httpOnly session cookie and logs out', async () => {
    await createUser('super_admin', 'boss@test.org');
    const c = await client();
    const res = await c.post('/api/v1/auth/login', { email: 'boss@test.org', password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((x) => x.startsWith('ngo_session='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect((await c.get('/api/v1/auth/me')).body.data.user.email).toBe('boss@test.org');
    await c.post('/api/v1/auth/logout');
    expect((await c.get('/api/v1/auth/me')).body.data.user).toBeNull();
  });

  it('returns the same error for unknown email and wrong password', async () => {
    await createUser('content_editor', 'ed@test.org');
    const c = await client();
    const a = await c.post('/api/v1/auth/login', { email: 'ed@test.org', password: 'wrong-password-1' });
    const b = await c.post('/api/v1/auth/login', { email: 'nobody@test.org', password: 'wrong-password-1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('locks the account after 5 failed attempts', async () => {
    await createUser('content_editor', 'ed@test.org');
    const c = await client();
    for (let i = 0; i < 4; i++) expect((await c.post('/api/v1/auth/login', { email: 'ed@test.org', password: 'bad' })).status).toBe(401);
    expect((await c.post('/api/v1/auth/login', { email: 'ed@test.org', password: 'bad' })).status).toBe(423);
    expect((await c.post('/api/v1/auth/login', { email: 'ed@test.org', password: PASSWORD })).status).toBe(423);
  });

  it('has no public admin registration endpoint', async () => {
    const c = await client();
    expect((await c.post('/api/v1/auth/register', { email: 'a@b.org', password: PASSWORD })).status).toBe(404);
  });

  it('deactivated users lose access immediately', async () => {
    const admin = await loginAs('super_admin');
    const ed = await createUser('content_editor', 'ed2@test.org');
    const c = await client();
    await c.post('/api/v1/auth/login', { email: ed.email, password: PASSWORD });
    expect((await c.get('/api/v1/admin/pages')).status).toBe(200);
    const res = await admin.put(`/api/v1/admin/users/${ed.id}`, { name: ed.name, email: ed.email, roleId: ed.roleId, isActive: false });
    expect(res.status).toBe(200);
    expect((await c.get('/api/v1/admin/pages')).status).toBe(401);
  });

  it('resets a password with a single-use token and revokes old sessions', async () => {
    const user = await createUser('content_editor', 'ed@test.org');
    const old = await client();
    await old.post('/api/v1/auth/login', { email: user.email, password: PASSWORD });
    const token = 'reset-token-abcdefghijklmnopqrstuvwxyz';
    await prisma.passwordResetToken.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 60000) } });
    const c = await client();
    expect((await c.post('/api/v1/auth/reset-password', { token, password: 'Brand-new-pass-9' })).status).toBe(200);
    expect((await c.post('/api/v1/auth/reset-password', { token, password: 'Another-pass-99' })).status).toBe(400);
    expect((await old.get('/api/v1/admin/pages')).status).toBe(401);
    expect((await c.post('/api/v1/auth/login', { email: user.email, password: 'Brand-new-pass-9' })).status).toBe(200);
  });

  it('requires a TOTP code when MFA is enabled', async () => {
    const admin = await loginAs('super_admin');
    const setup = await admin.post('/api/v1/auth/mfa/setup');
    const secret = setup.body.data.secret as string;
    expect((await admin.post('/api/v1/auth/mfa/enable', { code: totp(secret) })).status).toBe(200);
    const c = await client();
    const res = await c.post('/api/v1/auth/login', { email: admin.user.email, password: PASSWORD });
    expect(res.body.data.mfaRequired).toBe(true);
    expect((await c.get('/api/v1/admin/pages')).status).toBe(401); // half-authenticated session has no access
    expect((await c.post('/api/v1/auth/mfa/verify', { code: '000000' })).status).toBe(401);
    expect((await c.post('/api/v1/auth/mfa/verify', { code: totp(secret) })).status).toBe(200);
    expect((await c.get('/api/v1/admin/pages')).status).toBe(200);
  });
});
