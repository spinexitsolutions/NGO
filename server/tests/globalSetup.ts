import os from 'node:os';
import path from 'node:path';
import { isEmbeddedUrl, startEmbeddedMongo } from '../../scripts/embedded-mongo.mjs';
import { TEST_DB_PORT, TEST_DATABASE_URL } from '../vitest.config.js';

/**
 * Prepares the separate test database (never the real one). Unless TEST_DATABASE_URL points at a MongoDB
 * replica set, a throwaway MongoDB is started for the test run.
 */
export default async function setup() {
  const url = TEST_DATABASE_URL;
  if (!/test/.test(url)) throw new Error(`Refusing to run tests against a non-test database: ${url}`);
  let mongo: { stop: () => Promise<void> } | null = null;
  if (isEmbeddedUrl(url, TEST_DB_PORT)) {
    mongo = await startEmbeddedMongo({ port: TEST_DB_PORT, dbPath: path.join(os.tmpdir(), 'ngo-test-mongo'), fresh: true });
  }
  const stop = async () => {
    await mongo?.stop();
  };
  try {
    process.env.DATABASE_URL = url;
    const { syncDatabase } = await import('../src/config/db.js');
    await syncDatabase();
  } catch (err) {
    await stop();
    throw err;
  }
  return stop;
}
