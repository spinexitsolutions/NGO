import { execSync } from 'node:child_process';

/** Applies migrations to the dedicated test database (non-destructive). Tables are emptied per test by helpers.resetDb. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ngo_app_test';
  if (!/\/[\w-]+_test(\?|$)/.test(url)) throw new Error(`Refusing to run tests against a non-test database: ${url}`);
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } });
}
