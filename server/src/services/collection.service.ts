import { z } from 'zod';
import { COLLECTION_MAP, fieldsToZod, type CollectionDef } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

// Prisma delegates share the same CRUD surface; we access them dynamically by collection definition.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Delegate = any;

export function getCollection(key: string): CollectionDef {
  const def = COLLECTION_MAP[key];
  if (!def) throw AppError.notFound('Unknown collection');
  return def;
}

export function delegate(def: CollectionDef): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[def.model];
}

export function inputSchema(def: CollectionDef) {
  const statuses = def.statusOptions.map((s) => s.value) as [string, ...string[]];
  return fieldsToZod(def.fields).extend({ status: z.enum(statuses) });
}

/** Converts validated form values into Prisma column values. */
export function toDb(def: CollectionDef, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    const v = data[f.name];
    if (v === undefined) continue;
    if (f.type === 'date' || f.type === 'datetime') out[f.name] = v ? new Date(String(v)) : null;
    else if (f.type === 'relation') out[f.name] = v ? v : null;
    else if (f.type === 'number' && f.required === false && v === null) out[f.name] = null;
    else out[f.name] = v;
  }
  out.status = data.status;
  return out;
}

export function checkRules(def: CollectionDef, data: Record<string, unknown>) {
  const errors = Object.entries(def.rules?.(data) ?? {}).filter(([, m]) => Boolean(m));
  if (errors.length) throw AppError.validation('Please fix the highlighted fields', errors.map(([path, message]) => ({ path, message })));
}

/** Validates that relation ids point to existing records. */
export async function checkRelations(def: CollectionDef, data: Record<string, unknown>) {
  for (const f of def.fields.filter((x) => x.type === 'relation' && data[x.name])) {
    const target = getCollection(f.relation!);
    const exists = await delegate(target).findUnique({ where: { id: String(data[f.name]) }, select: { id: true } });
    if (!exists) throw AppError.validation('Invalid reference', [{ path: f.name, message: `Selected ${target.singular.toLowerCase()} no longer exists` }]);
  }
}

/** Removes private fields and applies publication rules for public responses. */
export function toPublic(def: CollectionDef, row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  for (const f of def.privateFields ?? []) delete out[f];
  if (def.key === 'projects') {
    if (row.showBudget) {
      out.budgetAmount = row.budgetAmount;
      out.fundingSecured = row.fundingSecured;
    }
    if (!row.beneficiariesVerified) out.beneficiariesReached = null;
  }
  return out;
}
