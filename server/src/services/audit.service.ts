import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/db.js';
import { clientIp } from '../utils/http.js';

const SENSITIVE = /password|secret|token|hash|mfa/i;

function scrub(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(scrub);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? '[redacted]' : scrub(v)]),
    );
  }
  return value;
}

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  before?: unknown;
  after?: unknown;
  /** Overrides the actor (e.g. during login, before req.user exists). */
  actorId?: string;
}

export async function audit(req: Request | null, input: AuditInput, tx: Tx = prisma) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId ?? req?.user?.id ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? '',
      summary: input.summary ?? '',
      before: input.before === undefined ? undefined : (scrub(input.before) as Prisma.InputJsonValue),
      after: input.after === undefined ? undefined : (scrub(input.after) as Prisma.InputJsonValue),
      ip: req ? clientIp(req) : '',
      userAgent: req?.get('user-agent')?.slice(0, 300) ?? '',
    },
  });
}
