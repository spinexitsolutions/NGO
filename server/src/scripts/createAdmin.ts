/**
 * Creates (or promotes) a Super Admin. There is deliberately no public admin registration endpoint.
 *
 *   npm run create-admin -- --email you@org.org --name "Your Name"
 *   (you will be prompted for a password, or pass ADMIN_PASSWORD in the environment)
 */
import readline from 'node:readline/promises';
import { SUPER_ADMIN_ROLE } from '@ngo/shared';
import { prisma, syncDatabase } from '../config/db.js';
import { hashPassword, passwordSchema } from '../services/auth.service.js';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  await syncDatabase();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const email = (arg('email') ?? (await rl.question('Email: '))).trim().toLowerCase();
  const name = (arg('name') ?? (await rl.question('Full name: '))).trim();
  const password = process.env.ADMIN_PASSWORD ?? (await rl.question('Password (min 10 chars, letters + numbers): '));
  rl.close();
  const check = passwordSchema.safeParse(password);
  if (!check.success) throw new Error(check.error.issues[0].message);
  const role = await prisma.role.findUnique({ where: { key: SUPER_ADMIN_ROLE } });
  if (!role) throw new Error('Roles not found — run `npm run seed` first.');
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, roleId: role.id, passwordHash: await hashPassword(password) },
    update: { roleId: role.id, isActive: true, passwordHash: await hashPassword(password), passwordChangedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { action: 'user.super_admin_created_cli', entityType: 'User', entityId: user.id, summary: email } });
  console.log(`✓ Super Admin ready: ${email}. Sign in at /admin`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
