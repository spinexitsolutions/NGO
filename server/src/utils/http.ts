import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { zodIssues } from '@ngo/shared';
import { AppError } from './AppError.js';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw AppError.validation('Please check the highlighted fields', zodIssues(r.error));
  return r.data;
}

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? '';
}

/** JSON columns hold string lists (SQLite has no array type). */
export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
