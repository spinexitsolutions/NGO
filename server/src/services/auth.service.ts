import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { SESSION_IDLE_MS } from '../middleware/auth.js';
import { randomToken, sha256 } from '../utils/crypto.js';

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), 'Use letters and numbers');

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// Used to keep login timing similar for unknown emails.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export async function checkCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false as const, reason: 'invalid' as const };
  }
  if (!user.isActive) return { ok: false as const, reason: 'inactive' as const };
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false as const, reason: 'locked' as const, user };
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    return { ok: false as const, reason: failed >= MAX_FAILED_LOGINS ? ('locked' as const) : ('invalid' as const), user };
  }
  return { ok: true as const, user };
}

export async function createSession(userId: string, meta: { ip: string; userAgent: string; mfaPending: boolean }) {
  const token = randomToken(32);
  const session = await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      ip: meta.ip,
      userAgent: meta.userAgent.slice(0, 300),
      mfaPending: meta.mfaPending,
      expiresAt: new Date(Date.now() + (meta.mfaPending ? 10 * 60_000 : SESSION_IDLE_MS)),
    },
  });
  return { token, session };
}

export async function loadAuthUser(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { role: { include: { permissions: true } } },
  });
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: { key: u.role.key, name: u.role.name },
    permissions: u.role.key === 'super_admin' ? ['*'] : u.role.permissions.map((p) => p.permissionKey),
    mfaEnabled: u.mfaEnabled,
    lastLoginAt: u.lastLoginAt,
  };
}
