import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';

async function main() {
  const logsDir = path.resolve(process.cwd(), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const buildLog = path.join(logsDir, `build-${stamp}.log`);
  const startLog = path.join(logsDir, `start-${stamp}.log`);
  const probeLog = path.join(logsDir, `probe-${stamp}.log`);

  // 1) Build
  console.log('> Running next build ...');
  await runAndLog(['npm', ['run', 'build']], buildLog);
  console.log(`  ✓ Build logs: ${rel(buildLog)}`);

  // 2) Start on port 3010
  console.log('> Starting next start -p 3010 ...');
  const nextBin = path.join('node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', '3010'], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const out = fs.createWriteStream(startLog);
  child.stdout.pipe(out);
  child.stderr.pipe(out);

  // wait a bit for server to boot
  await sleep(5000);

  // 3) Probe endpoints
  const probe = fs.createWriteStream(probeLog);
  const write = (s: string) => probe.write(s + '\n');
  try {
    write('--- GET /api/health');
    write(await httpGet('http://localhost:3010/api/health'));
  } catch (e: any) {
    write('ERR ' + (e?.message || e));
  }

  let signinHtml = '';
  try {
    write('--- GET /auth/signin [first 40 lines]');
    signinHtml = await httpGet('http://localhost:3010/auth/signin');
    write(signinHtml.split('\n').slice(0, 40).join('\n'));
  } catch (e: any) {
    write('ERR ' + (e?.message || e));
  }

  try {
    const m = signinHtml.match(/(\/\_next\/static\/[^"']+\.js)/);
    if (m) {
      const chunk = m[1];
      write('--- HEAD ' + chunk);
      const head = await httpHead('http://localhost:3010' + chunk);
      write(head.trim());
    } else {
      write('No chunk path found in signin HTML.');
    }
  } catch (e: any) {
    write('ERR ' + (e?.message || e));
  }

  probe.end();

  // 4) Cleanup
  try { child.kill(); } catch {}

  console.log(`  ✓ Start logs: ${rel(startLog)}`);
  console.log(`  ✓ Probe logs: ${rel(probeLog)}`);
}

async function runAndLog([cmd, args]: [string, string[]], logfile: string) {
  return new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(logfile);
    const child = spawn(cmd, args, { shell: process.platform === 'win32' });
    child.stdout.pipe(out);
    child.stderr.pipe(out);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(`HTTP ${res.statusCode}\n` + data));
    }).on('error', reject);
  });
}

function httpHead(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'HEAD' }, (res) => {
      const headers = Object.entries(res.headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n');
      resolve(`HTTP ${res.statusCode}\n${headers}`);
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function rel(p: string) { return path.relative(process.cwd(), p); }

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

