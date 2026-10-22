/**
 * Runs a private MongoDB server for local use and tests, so nothing has to be installed by hand.
 * The MongoDB program is downloaded once (~100 MB, cached in ~/.cache/mongodb-binaries) and started
 * as a single-node replica set, which Prisma needs for transactions.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { MongoClient } from 'mongodb';
import { MongoBinary } from 'mongodb-memory-server-core';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True when `url` is the embedded server's address (127.0.0.1:<port>). */
export function isEmbeddedUrl(url, port) {
  return url.includes(`127.0.0.1:${port}/`);
}

export function embeddedUrl(port, dbName) {
  return `mongodb://127.0.0.1:${port}/${dbName}?replicaSet=rs0&directConnection=true`;
}

async function ping(port) {
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 1000 });
  try {
    await client.connect();
    return client;
  } catch {
    await client.close().catch(() => {});
    return null;
  }
}

/**
 * Starts MongoDB on 127.0.0.1:<port> with its data in `dbPath` (kept between runs) and waits until it
 * accepts writes. If something is already listening there (e.g. a previous run), it is reused.
 * `fresh` starts from an empty data folder (used by tests).
 */
export async function startEmbeddedMongo({ port, dbPath, fresh = false, log = () => {} }) {
  let client = await ping(port);
  let proc = null;
  if (!client) {
    if (fresh) fs.rmSync(dbPath, { recursive: true, force: true });
    fs.mkdirSync(dbPath, { recursive: true });
    log('Getting MongoDB ready (downloaded once on the first run, this can take a minute)…');
    const binary = await MongoBinary.getPath();
    proc = spawn(binary, ['--replSet', 'rs0', '--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d));
    let exited = null;
    proc.once('exit', (code) => (exited = code));
    for (let i = 0; i < 60 && !client; i++) {
      if (exited !== null) throw new Error(`MongoDB stopped (exit code ${exited}). ${stderr.trim()}`);
      await sleep(500);
      client = await ping(port);
    }
    if (!client) throw new Error('MongoDB did not start within 30 seconds');
  }

  const admin = client.db('admin');
  try {
    await admin.command({ replSetGetStatus: 1 });
  } catch (err) {
    if (err?.codeName !== 'NotYetInitialized') throw err;
    await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
  }
  for (let i = 0; i < 60; i++) {
    if ((await admin.command({ hello: 1 })).isWritablePrimary) break;
    await sleep(500);
  }
  await client.close();

  return {
    stop: () =>
      new Promise((resolve) => {
        if (!proc || proc.exitCode !== null) return resolve();
        proc.once('exit', () => resolve());
        proc.kill('SIGTERM');
      }),
  };
}

/** True when the database already has at least one admin user (i.e. it was set up before). */
export async function hasUsers(url) {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    return (await client.db().collection('User').countDocuments({}, { limit: 1 })) > 0;
  } finally {
    await client.close();
  }
}
