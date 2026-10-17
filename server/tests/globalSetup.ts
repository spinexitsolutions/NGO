import { execSync } from 'node:child_process';
import fs from 'node:fs';

/** Creates/updates the separate SQLite test database file (never the real one). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'file:../data/test.db';
  if (!/test/.test(url)) throw new Error(`Refusing to run tests against a non-test database: ${url}`);
  fs.mkdirSync('data', { recursive: true });
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } });
}
