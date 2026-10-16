import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { runScheduledPublishing } from '../services/page.service.js';

/**
 * Lightweight in-process job loop. Each task takes a Postgres advisory lock so that running several
 * server instances never executes the same job concurrently.
 */
const TASKS: { name: string; lockId: number; everyMs: number; run: () => Promise<unknown> }[] = [
  { name: 'scheduled-publishing', lockId: 8_100_001, everyMs: 60_000, run: () => runScheduledPublishing() },
  {
    name: 'cleanup',
    lockId: 8_100_002,
    everyMs: 6 * 60 * 60_000,
    run: async () => {
      const now = new Date();
      const old = new Date(Date.now() - 30 * 86_400_000);
      await prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: old } }, { revokedAt: { lt: old } }] } });
      await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
      await prisma.donorLoginToken.deleteMany({ where: { expiresAt: { lt: now } } });
      // Abandoned checkouts: pending for more than 24 h are marked cancelled (never counted as raised).
      await prisma.donation.updateMany({ where: { status: 'PENDING', isOffline: false, createdAt: { lt: new Date(Date.now() - 86_400_000) } }, data: { status: 'CANCELLED', failureReason: 'Checkout abandoned' } });
    },
  },
];

async function runLocked(task: (typeof TASKS)[number]) {
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${task.lockId}) AS locked`;
  if (!locked) return;
  try {
    const result = await task.run();
    logger.debug({ task: task.name, result }, 'job finished');
  } catch (err) {
    logger.error({ err, task: task.name }, 'job failed');
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${task.lockId})`;
  }
}

export function startScheduler() {
  const timers = TASKS.map((t) => setInterval(() => void runLocked(t), t.everyMs));
  setTimeout(() => TASKS.forEach((t) => void runLocked(t)), 5_000);
  return () => timers.forEach(clearInterval);
}
