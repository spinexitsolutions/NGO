import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

const base = { standardHeaders: 'draft-7' as const, legacyHeaders: false, skip: () => isTest };
const message = { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } };

export const apiLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300, message });
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 20, message });
/** Public form submissions (contact, volunteer, newsletter, registrations). */
export const formLimiter = rateLimit({ ...base, windowMs: 10 * 60_000, limit: 15, message });
export const checkoutLimiter = rateLimit({ ...base, windowMs: 10 * 60_000, limit: 30, message });
