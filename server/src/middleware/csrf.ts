import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { randomToken, safeEqual } from '../utils/crypto.js';

export const CSRF_COOKIE = 'ngo_csrf';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Double-submit cookie CSRF protection for all state-changing API requests. */
export function csrf(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token || typeof token !== 'string' || token.length < 20) {
    token = randomToken(24);
    res.cookie(CSRF_COOKIE, token, { httpOnly: false, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/' });
    req.cookies[CSRF_COOKIE] = token;
  }
  if (SAFE.has(req.method)) return next();
  const header = req.get('x-csrf-token');
  if (!header || !safeEqual(header, token)) return next(new AppError(403, 'CSRF', 'Your session expired. Please refresh the page and try again.'));
  next();
}
