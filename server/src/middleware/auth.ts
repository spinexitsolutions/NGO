import type { NextFunction, Request, Response } from 'express';
import { SUPER_ADMIN_ROLE, type Permission } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { sha256 } from '../utils/crypto.js';

export const SESSION_COOKIE = 'ngo_session';
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000; // 12 h of inactivity
export const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000; // absolute lifetime

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  roleName: string;
  permissions: Set<Permission>;
  sessionId: string;
  mfaEnabled: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    mfaPendingUserId?: string;
    sessionId?: string;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
};

/** Loads the session (if any) and attaches the user. Never throws for anonymous visitors. */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token || typeof token !== 'string') return next();
    const session = await prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { include: { role: { include: { permissions: true } } } } },
    });
    const now = Date.now();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < now ||
      session.createdAt.getTime() + SESSION_MAX_MS < now ||
      !session.user.isActive ||
      // Sessions created before a password change are invalid.
      session.createdAt < session.user.passwordChangedAt
    ) {
      return next();
    }
    req.sessionId = session.id;
    if (session.mfaPending) {
      req.mfaPendingUserId = session.userId;
      return next();
    }
    const u = session.user;
    req.user = {
      id: u.id,
      email: u.email,
      name: u.name,
      roleKey: u.role.key,
      roleName: u.role.name,
      permissions: new Set(u.role.permissions.map((p) => p.permissionKey as Permission)),
      sessionId: session.id,
      mfaEnabled: u.mfaEnabled,
    };
    // Sliding idle expiry, written at most every 5 minutes.
    if (now - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_IDLE_MS) },
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(AppError.unauthorized());
  next();
}

export function hasPermission(user: AuthUser | undefined, permission: Permission): boolean {
  if (!user) return false;
  return user.roleKey === SUPER_ADMIN_ROLE || user.permissions.has(permission);
}

/** Requires ANY of the listed permissions. Enforced server-side on every protected route. */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!permissions.some((p) => hasPermission(req.user, p))) return next(AppError.forbidden());
    next();
  };
}
