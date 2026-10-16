import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound('Endpoint not found'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let e: AppError;
  if (err instanceof AppError) e = err;
  else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
    e = AppError.conflict(`A record with this ${target} already exists`, [{ path: target, message: 'Already in use' }]);
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') e = AppError.notFound();
  else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003')
    e = AppError.conflict('This record is still referenced by other data');
  else if (err instanceof MulterError) e = AppError.badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message);
  else if (err instanceof SyntaxError && 'body' in err) e = AppError.badRequest('Invalid JSON body');
  else if (typeof (err as { status?: unknown })?.status === 'number' && (err as { status: number }).status < 500) {
    // e.g. express.static / body-parser errors (404 for a missing upload, 413 payload too large)
    const status = (err as { status: number }).status;
    e = new AppError(status, status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', status === 404 ? 'Not found' : (err as Error).message);
  }
  else {
    logger.error({ err, path: req.path }, 'Unhandled error');
    e = new AppError(500, 'INTERNAL', 'Something went wrong. Please try again.');
  }
  res.status(e.status).json({ error: { code: e.code, message: e.message, details: e.details } });
}
