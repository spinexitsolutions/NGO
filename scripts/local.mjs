/**
 * One command to run everything on a laptop — no database to install.
 *
 *   npm run local
 *
 * The database is MongoDB. Unless server/.env points DATABASE_URL at your own MongoDB (e.g. Atlas), a
 * private MongoDB is started for you with its data in server/data/mongo. On first run this creates the
 * settings file, the collections, sample content and an admin account, then starts the API and the
 * website. Press Ctrl+C to stop.
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embeddedUrl, hasUsers, isEmbeddedUrl, startEmbeddedMongo } from './embedded-mongo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');
const dataDir = path.join(serverDir, 'data');
const credentialsFile = path.join(root, 'LOCAL-ADMIN.txt');
const isWin = process.platform === 'win32';
const EMBEDDED_PORT = 27027;
const log = (msg) => console.log(`\x1b[32m[local]\x1b[0m ${msg}`);

// 1. Settings file, created once with a fresh secret. Older copies that used a SQLite file are switched to MongoDB.
const envFile = path.join(serverDir, '.env');
if (!fs.existsSync(envFile)) {
  const example = fs.readFileSync(path.join(serverDir, '.env.example'), 'utf8');
  fs.writeFileSync(envFile, example.replace(/^APP_SECRET=.*$/m, `APP_SECRET=${crypto.randomBytes(32).toString('hex')}`));
  log('Created server/.env');
}
let envText = fs.readFileSync(envFile, 'utf8');
if (/^DATABASE_URL=["']?file:/m.test(envText)) {
  envText = envText.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${embeddedUrl(EMBEDDED_PORT, 'ngo')}"`);
  fs.writeFileSync(envFile, envText);
  log('Switched server/.env to MongoDB');
}
const fromFile = envText.match(/^DATABASE_URL=["']?([^"'\n]*)["']?$/m)?.[1];
const databaseUrl = process.env.DATABASE_URL || fromFile || embeddedUrl(EMBEDDED_PORT, 'ngo');
const env = { ...process.env, DATABASE_URL: databaseUrl };

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, env, ...opts });
  if (r.status !== 0) {
    console.error(`\nCommand failed: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
};

// 2. MongoDB: the private one, unless you configured your own.
let mongo = null;
if (isEmbeddedUrl(databaseUrl, EMBEDDED_PORT)) {
  try {
    mongo = await startEmbeddedMongo({ port: EMBEDDED_PORT, dbPath: path.join(dataDir, 'mongo'), log });
  } catch (err) {
    console.error(`\nCould not start MongoDB: ${err.message}`);
    console.error('You can instead put a MongoDB Atlas URL in DATABASE_URL in server/.env.');
    process.exit(1);
  }
  log('MongoDB is running (data in server/data/mongo)');
} else {
  log('Using the MongoDB from DATABASE_URL');
}
const stopMongo = () => (mongo ? mongo.stop() : Promise.resolve());

// 3. Database client. (Collections and indexes are created by the app itself when it starts.)
log('Preparing database…');
run('npx', ['prisma', 'generate'], { cwd: serverDir, stdio: 'ignore' });

// 4. Sample content + admin account, first time only (an empty database).
if (!(await hasUsers(databaseUrl))) {
  log('First run: adding sample content and an admin account…');
  run('npm', ['run', 'seed', '-w', 'server'], { cwd: root });
  const email = 'admin@ngo.local';
  const password = `Ngo-${crypto.randomBytes(5).toString('hex')}9`;
  run('npm', ['run', 'create-admin', '-w', 'server', '--', '--email', email, '--name', 'Local Admin'], { cwd: root, env: { ...env, ADMIN_PASSWORD: password } });
  fs.writeFileSync(credentialsFile, `Admin panel: http://localhost:5173/admin\nEmail:    ${email}\nPassword: ${password}\n\nChange the password after signing in (My account).\n`);
}

// 5. API + website.
console.log('\n' + '─'.repeat(60));
console.log('Website:  http://localhost:5173');
if (fs.existsSync(credentialsFile)) console.log(fs.readFileSync(credentialsFile, 'utf8').trim());
console.log('─'.repeat(60) + '\n');
const app = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit', shell: isWin, env });
app.on('exit', async (code) => {
  await stopMongo();
  process.exit(code ?? 0);
});
process.on('SIGINT', () => app.kill('SIGINT'));
