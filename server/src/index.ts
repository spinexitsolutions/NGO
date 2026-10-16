import { createApp } from './app.js';
import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startScheduler } from './jobs/scheduler.js';

const app = createApp();
const server = app.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT} (payments: ${env.PAYMENT_PROVIDER}, email: ${env.EMAIL_TRANSPORT}, storage: ${env.STORAGE_DRIVER})`));
const stopJobs = env.JOBS_ENABLED ? startScheduler() : () => undefined;

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  stopJobs();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
