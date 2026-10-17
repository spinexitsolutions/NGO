import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { runScheduledPublishing } from '../services/page.service.js';

/**
 * Lightweight in-process job loop. With a single-file SQLite database the app runs as one server
 * process, so an in-memory flag is enough to stop a task overlapping with itself.
 */
const TASKS: { name: string; everyMs: number; run: () => Promise<unknown> }[] = [
  { name: 'scheduled-publishing', everyMs: 60_000, run: () => runScheduledPublishing() },
  {
    name: 'cleanup',
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

const running = new Set<string>();

async function runLocked(task: (typeof TASKS)[number]) {
  if (running.has(task.name)) return;
  running.add(task.name);
  try {
    const result = await task.run();
    logger.debug({ task: task.name, result }, 'job finished');
  } catch (err) {
    logger.error({ err, task: task.name }, 'job failed');
  } finally {
    running.delete(task.name);
  }
}

export function startScheduler() {
  const timers = TASKS.map((t) => setInterval(() => void runLocked(t), t.everyMs));
  setTimeout(() => TASKS.forEach((t) => void runLocked(t)), 5_000);
  return () => timers.forEach(clearInterval);
}
