/**
 * One command to run everything on a laptop — no database server to install.
 *
 *   npm run local
 *
 * The database is a single SQLite file (server/data/ngo.db). On first run this creates the settings
 * file, the tables, sample content and an admin account, then starts the API and the website.
 * Press Ctrl+C to stop.
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');
const dataDir = path.join(serverDir, 'data');
const seededMarker = path.join(dataDir, '.seeded');
const credentialsFile = path.join(root, 'LOCAL-ADMIN.txt');
const isWin = process.platform === 'win32';
const log = (msg) => console.log(`\x1b[32m[local]\x1b[0m ${msg}`);

// 1. Settings file, created once with a fresh secret.
const envFile = path.join(serverDir, '.env');
if (!fs.existsSync(envFile)) {
  const example = fs.readFileSync(path.join(serverDir, '.env.example'), 'utf8');
  fs.writeFileSync(envFile, example.replace(/^APP_SECRET=.*$/m, `APP_SECRET=${crypto.randomBytes(32).toString('hex')}`));
  log('Created server/.env');
}
fs.mkdirSync(dataDir, { recursive: true });

const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? 'file:../data/ngo.db' };
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, env, ...opts });
  if (r.status !== 0) {
    console.error(`\nCommand failed: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
};

// 2. Database client + tables (safe every run: only applies new migrations).
log('Preparing database (server/data/ngo.db)…');
run('npx', ['prisma', 'generate'], { cwd: serverDir, stdio: 'ignore' });
run('npx', ['prisma', 'migrate', 'deploy'], { cwd: serverDir });

// 3. Sample content + admin account, first time only.
if (!fs.existsSync(seededMarker)) {
  log('First run: adding sample content and an admin account…');
  run('npm', ['run', 'seed', '-w', 'server'], { cwd: root });
  const email = 'admin@ngo.local';
  const password = `Ngo-${crypto.randomBytes(5).toString('hex')}9`;
  run('npm', ['run', 'create-admin', '-w', 'server', '--', '--email', email, '--name', 'Local Admin'], { cwd: root, env: { ...env, ADMIN_PASSWORD: password } });
  fs.writeFileSync(credentialsFile, `Admin panel: http://localhost:5173/admin\nEmail:    ${email}\nPassword: ${password}\n\nChange the password after signing in (My account).\n`);
  fs.writeFileSync(seededMarker, new Date().toISOString());
}

// 4. API + website.
console.log('\n' + '─'.repeat(60));
console.log('Website:  http://localhost:5173');
if (fs.existsSync(credentialsFile)) console.log(fs.readFileSync(credentialsFile, 'utf8').trim());
console.log('─'.repeat(60) + '\n');
const app = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit', shell: isWin, env });
app.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => app.kill('SIGINT'));
