import { spawn } from 'child_process';
import net from 'net';

const ports = ['5000', '5173'];
const children = [];

async function fetchRoot(port) {
  try {
    const response = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1200) });
    return { ok: true, status: response.status, body: await response.text() };
  } catch (error) {
    return { ok: false, error: error.name === 'TimeoutError' ? 'timeout' : error.code || error.message };
  }
}

function canListen(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(Number(port), '0.0.0.0');
  });
}

function isExactWorkTrack(body = '') {
  return body.includes('<title>Work_Track_System</title>') &&
    body.includes('/googleScriptRunShim.js') &&
    !body.includes('id="root"') &&
    !/Discussion Center|Track tickets|portal-rail/.test(body);
}

async function classifyPort(port) {
  const probe = await fetchRoot(port);
  if (probe.ok && isExactWorkTrack(probe.body)) return { status: 'exact-running' };
  const free = await canListen(port);
  if (free) return { status: 'free' };
  return { status: 'blocked', detail: probe.ok ? `HTTP ${probe.status}` : probe.error };
}

for (const port of ports) {
  const state = await classifyPort(port);
  if (state.status === 'exact-running') {
    console.log(`Exact WorkTrack already running on http://localhost:${port}/`);
    continue;
  }
  if (state.status === 'blocked') {
    console.error(`Port ${port} is occupied by a non-exact WorkTrack process (${state.detail}).`);
    console.error('Stop that process first so the Apps Script UI can run on the expected port.');
    process.exit(1);
  }

  const child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: port },
    stdio: 'inherit',
    windowsHide: true
  });
  children.push(child);
}

if (!children.length) {
  console.log('No new server processes started because the exact UI is already running.');
}

function shutdown() {
  for (const child of children) child.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
