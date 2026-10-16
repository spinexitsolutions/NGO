import { Router } from 'express';
import { z } from 'zod';
import { ALL_PERMISSIONS } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE, requireAuth, sessionCookieOptions } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { audit } from '../services/audit.service.js';
import {
  LOCK_MINUTES,
  checkCredentials,
  createSession,
  hashPassword,
  loadAuthUser,
  passwordSchema,
  verifyPassword,
} from '../services/auth.service.js';
import { getPublished } from '../services/config.service.js';
import { sendTemplate } from '../services/email.service.js';
import { AppError } from '../utils/AppError.js';
import { decrypt, encrypt, randomToken, sha256 } from '../utils/crypto.js';
import { asyncHandler, clientIp, parse } from '../utils/http.js';
import { generateSecret, otpauthUrl, verifyTotp } from '../utils/totp.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }), req.body);
    const result = await checkCredentials(email, password);
    if (!result.ok) {
      if (result.user) await audit(null, { action: 'auth.login_failed', entityType: 'User', entityId: result.user.id, summary: result.reason });
      if (result.reason === 'locked')
        throw new AppError(423, 'LOCKED', `Too many failed attempts. Your account is locked for ${LOCK_MINUTES} minutes.`);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
    }
    const user = result.user;
    const { token } = await createSession(user.id, { ip: clientIp(req), userAgent: req.get('user-agent') ?? '', mfaPending: user.mfaEnabled });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    if (user.mfaEnabled) return res.json({ data: { mfaRequired: true } });
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await audit(req, { actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id });
    res.json({ data: { user: await loadAuthUser(user.id) } });
  }),
);

authRouter.post(
  '/mfa/verify',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { code } = parse(z.object({ code: z.string().trim() }), req.body);
    if (!req.mfaPendingUserId || !req.sessionId) throw AppError.unauthorized('Please sign in again');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.mfaPendingUserId } });
    if (!user.mfaSecret || !verifyTotp(decrypt(user.mfaSecret), code)) {
      await audit(null, { action: 'auth.mfa_failed', entityType: 'User', entityId: user.id });
      throw new AppError(401, 'INVALID_CODE', 'That code is not valid. Check your authenticator app and try again.');
    }
    // Rotate the session token after the second factor.
    await prisma.session.update({ where: { id: req.sessionId }, data: { revokedAt: new Date() } });
    const { token } = await createSession(user.id, { ip: clientIp(req), userAgent: req.get('user-agent') ?? '', mfaPending: false });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await audit(req, { actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, summary: 'with MFA' });
    res.json({ data: { user: await loadAuthUser(user.id) } });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.sessionId) await prisma.session.update({ where: { id: req.sessionId }, data: { revokedAt: new Date() } });
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    res.json({ data: { ok: true } });
  }),
);

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) return res.json({ data: { user: null, mfaPending: Boolean(req.mfaPendingUserId) } });
    res.json({ data: { user: await loadAuthUser(req.user.id), allPermissions: ALL_PERMISSIONS } });
  }),
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parse(z.object({ email: z.string().email() }), req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user?.isActive) {
      const token = randomToken(32);
      await prisma.passwordResetToken.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60_000) } });
      await sendTemplate({
        to: user.email,
        template: 'password_reset',
        vars: { name: user.name, resetUrl: `${env.PUBLIC_SITE_URL}/admin/reset-password?token=${token}` },
        related: { type: 'User', id: user.id },
      });
    }
    // Same response whether or not the account exists.
    res.json({ data: { ok: true } });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = parse(z.object({ token: z.string().min(20), password: passwordSchema }), req.body);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw AppError.badRequest('This reset link is invalid or has expired');
    const now = new Date();
    await prisma.$transaction([
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } }),
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(password), passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null },
      }),
      prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    await audit(req, { actorId: record.userId, action: 'auth.password_reset', entityType: 'User', entityId: record.userId });
    res.json({ data: { ok: true } });
  }),
);

// ─── Authenticated account management ─────────────────────────────────────────────

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parse(z.object({ currentPassword: z.string(), newPassword: passwordSchema }), req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw AppError.validation('Current password is incorrect', [{ path: 'currentPassword', message: 'Incorrect password' }]);
    const now = new Date(Date.now() - 1000);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: now } });
    await prisma.session.updateMany({ where: { userId: user.id, id: { not: req.user!.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } });
    // Keep the current session valid: it was created before passwordChangedAt, so re-issue it.
    await prisma.session.update({ where: { id: req.user!.sessionId }, data: { revokedAt: new Date() } });
    const { token } = await createSession(user.id, { ip: clientIp(req), userAgent: req.get('user-agent') ?? '', mfaPending: false });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    await audit(req, { action: 'auth.password_changed', entityType: 'User', entityId: user.id });
    res.json({ data: { ok: true } });
  }),
);

authRouter.post(
  '/mfa/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (user.mfaEnabled) throw AppError.conflict('Two-factor authentication is already enabled');
    const secret = generateSecret();
    await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: encrypt(secret) } });
    const settings = await getPublished('settings');
    res.json({ data: { secret, otpauthUrl: otpauthUrl(secret, user.email, settings.organization.name) } });
  }),
);

authRouter.post(
  '/mfa/enable',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = parse(z.object({ code: z.string().trim() }), req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.mfaSecret || !verifyTotp(decrypt(user.mfaSecret), code)) throw AppError.validation('Invalid code', [{ path: 'code', message: 'Invalid code' }]);
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
    await audit(req, { action: 'auth.mfa_enabled', entityType: 'User', entityId: user.id });
    res.json({ data: { ok: true } });
  }),
);

authRouter.post(
  '/mfa/disable',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { password } = parse(z.object({ password: z.string() }), req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(password, user.passwordHash))) throw AppError.validation('Incorrect password', [{ path: 'password', message: 'Incorrect password' }]);
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } });
    await audit(req, { action: 'auth.mfa_disabled', entityType: 'User', entityId: user.id });
    res.json({ data: { ok: true } });
  }),
);

authRouter.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.id, revokedAt: null, mfaPending: false, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true },
    });
    res.json({ data: sessions.map((s) => ({ ...s, current: s.id === req.user!.sessionId })) });
  }),
);

authRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await prisma.session.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { revokedAt: new Date() } });
    if (!r.count) throw AppError.notFound();
    await audit(req, { action: 'auth.session_revoked', entityType: 'Session', entityId: req.params.id });
    res.json({ data: { ok: true } });
  }),
);
