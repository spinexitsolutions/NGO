import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Prisma, PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

export const prisma = new PrismaClient();
export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

type IndexSpec = { name: string; key: Record<string, 1>; unique: boolean; partialFilterExpression?: Record<string, unknown> };

/** Reads `@@index([...])` lines per model from the schema copy that `prisma generate` puts next to the client. */
function schemaIndexes(): Map<string, string[][]> {
  const text = fs.readFileSync(createRequire(import.meta.url).resolve('.prisma/client/schema.prisma'), 'utf8');
  const out = new Map<string, string[][]>();
  for (const m of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm))
    out.set(m[1], [...m[2].matchAll(/@@index\(\[([^\]]+)\]/g)].map((i) => i[1].split(',').map((f) => f.trim())));
  return out;
}

const MONGO_TYPES: Record<string, string> = { String: 'string', Int: 'int', DateTime: 'date', Boolean: 'bool' };

/** Unique and secondary indexes for every model, named the way Prisma names them. */
function indexSpecs(): Map<string, IndexSpec[]> {
  const extra = schemaIndexes();
  const specs = new Map<string, IndexSpec[]>();
  for (const model of Prisma.dmmf.datamodel.models) {
    const fields = new Map(model.fields.map((f) => [f.name, f]));
    const unique = (names: readonly string[]): IndexSpec => {
      // An optional field only has to be unique when it is set: MongoDB would otherwise treat two
      // empty (null) values as duplicates.
      const optional = names.filter((n) => !fields.get(n)?.isRequired);
      return {
        name: `${model.name}_${names.join('_')}_key`,
        key: Object.fromEntries(names.map((n) => [n, 1])),
        unique: true,
        ...(optional.length && { partialFilterExpression: Object.fromEntries(optional.map((n) => [n, { $type: MONGO_TYPES[fields.get(n)!.type] ?? 'string' }])) }),
      };
    };
    specs.set(model.name, [
      ...model.fields.filter((f) => f.isUnique && !f.isId).map((f) => unique([f.name])),
      ...model.uniqueFields.map(unique),
      ...(extra.get(model.name) ?? []).map((names) => ({ name: `${model.name}_${names.join('_')}_idx`, key: Object.fromEntries(names.map((n) => [n, 1 as const])), unique: false })),
    ]);
  }
  return specs;
}

/**
 * Creates any missing collections and indexes. Safe to run on every start: existing ones that already
 * match are left alone. (Used instead of `prisma db push`, which can't express the partial indexes above.)
 */
export async function syncDatabase() {
  const client = new MongoClient(process.env.DATABASE_URL ?? '');
  try {
    await client.connect();
    const db = client.db();
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    for (const [model, specs] of indexSpecs()) {
      if (!existing.has(model)) await db.createCollection(model);
      const coll = db.collection(model);
      const current = await coll.indexes();
      for (const spec of specs) {
        const found = current.find((i) => i.name === spec.name);
        const same =
          found &&
          JSON.stringify(found.key) === JSON.stringify(spec.key) &&
          Boolean(found.unique) === spec.unique &&
          JSON.stringify(found.partialFilterExpression ?? null) === JSON.stringify(spec.partialFilterExpression ?? null);
        if (same) continue;
        if (found) await coll.dropIndex(spec.name);
        const { name, key, unique, partialFilterExpression } = spec;
        await coll.createIndex(key, { name, unique, ...(partialFilterExpression && { partialFilterExpression }) });
      }
    }
  } finally {
    await client.close();
  }
}
