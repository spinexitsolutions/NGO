import request from 'supertest';
import type { Express } from 'express';
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from '@ngo/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { clearConfigCache } from '../src/services/config.service.js';
import { hashPassword } from '../src/services/auth.service.js';

export const app: Express = createApp();
export const PASSWORD = 'Correct-horse-42';

const KEEP = new Set(['Permission', 'Role', 'RolePermission']);

/** Empties every collection except roles/permissions, which are (re)created once. */
export async function resetDb() {
  if (!/test/.test(process.env.DATABASE_URL ?? '')) throw new Error('resetDb only runs against a test database');
  const list = (await prisma.$runCommandRaw({ listCollections: 1, nameOnly: true })) as { cursor: { firstBatch: { name: string }[] } };
  for (const { name } of list.cursor.firstBatch)
    if (!KEEP.has(name) && !name.startsWith('system.')) await prisma.$runCommandRaw({ delete: name, deletes: [{ q: {}, limit: 0 }] });
  clearConfigCache();
  await prisma.role.deleteMany({ where: { isSystem: false } });
  if (!(await prisma.role.count())) {
    for (const key of ALL_PERMISSIONS) await prisma.permission.create({ data: { key, group: PERMISSIONS[key].group, description: PERMISSIONS[key].label } });
    for (const r of DEFAULT_ROLES)
      await prisma.role.create({ data: { key: r.key, name: r.name, isSystem: true, permissions: { create: r.permissions.map((permissionKey) => ({ permissionKey })) } } });
  }
}

export async function createUser(roleKey: string, email = `${roleKey}@test.org`) {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  return prisma.user.create({ data: { email, name: roleKey, roleId: role.id, passwordHash: await hashPassword(PASSWORD) } });
}

/** A supertest agent that keeps cookies and sends the CSRF header automatically. */
export async function client() {
  const agent = request.agent(app);
  const res = await agent.get('/api/v1/auth/me');
  const cookie = (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('ngo_csrf='));
  const csrf = cookie ? decodeURIComponent(cookie.split(';')[0].split('=')[1]) : '';
  const wrap = <T extends { set: (k: string, v: string) => T }>(r: T) => r.set('x-csrf-token', csrf);
  return {
    agent,
    csrf,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => wrap(agent.post(url)).send(body ?? {}),
    put: (url: string, body?: object) => wrap(agent.put(url)).send(body ?? {}),
    del: (url: string, body?: object) => wrap(agent.delete(url)).send(body ?? {}),
    upload: (url: string) => wrap(agent.post(url)),
  };
}

export async function loginAs(roleKey: string) {
  const user = await createUser(roleKey);
  const c = await client();
  const res = await c.post('/api/v1/auth/login', { email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...c, user };
}
