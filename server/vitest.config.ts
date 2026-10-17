import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Test-only values — never real secrets.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'file:../data/test.db',
      APP_SECRET: 'test-secret-test-secret-test-secret-test-secret',
      PAYMENT_PROVIDER: 'sandbox',
      RAZORPAY_KEY_ID: 'rzp_test_dummy',
      RAZORPAY_KEY_SECRET: 'rzp_test_key_secret',
      RAZORPAY_WEBHOOK_SECRET: 'rzp_test_webhook_secret',
      EMAIL_TRANSPORT: 'log',
      JOBS_ENABLED: 'false',
      UPLOAD_DIR: path.join(os.tmpdir(), 'ngo-test-uploads'),
      PRIVATE_UPLOAD_DIR: path.join(os.tmpdir(), 'ngo-test-private'),
      PUBLIC_SITE_URL: 'http://localhost:5173',
    },
  },
});
