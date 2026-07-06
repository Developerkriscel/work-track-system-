import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

const root = process.cwd();
const port = process.env.WORKTRACK_PORT || '5173';
const resetUrl = `http://localhost:${port}/reset-localhost`;
const profileDir = path.join(root, '.worktrack-browser-profile');

function isExactWorkTrack(body = '') {
  return body.includes('<title>Work_Track_System</title>') &&
    body.includes('/googleScriptRunShim.js') &&
    !body.includes('id="root"') &&
    !/Discussion Center|Track tickets|portal-rail|Client Portal\s+Acme Retail/.test(body);
}

async function assertExactServer() {
  const body = await new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(data);
      });
    });
    req.setTimeout(5000, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', reject);
  });
  if (!isExactWorkTrack(body)) throw new Error(`localhost:${port} is not serving exact WorkTrack UI. Run npm run dev first.`);
}

function browserCandidates() {
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return [
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
    ];
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
  }
  return ['/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

await assertExactServer();
fs.mkdirSync(profileDir, { recursive: true });

if (process.env.WORKTRACK_OPEN_SMOKE === '1' || process.argv.includes('--smoke')) {
  console.log(`Exact WorkTrack launcher smoke passed: ${resetUrl}`);
  console.log(`Profile: ${profileDir}`);
  process.exit(0);
}

const browserPath = browserCandidates().find((candidate) => fs.existsSync(candidate));
if (!browserPath) {
  console.log(`Exact WorkTrack is ready: ${resetUrl}`);
  console.log('No supported browser executable was found automatically.');
  process.exit(0);
}

spawn(browserPath, [
  `--user-data-dir=${profileDir}`,
  '--new-window',
  '--no-first-run',
  '--no-default-browser-check',
  resetUrl
], {
  detached: true,
  stdio: 'ignore',
  windowsHide: false
}).unref();

console.log(`Opened exact WorkTrack UI in a clean browser profile: ${resetUrl}`);
console.log(`Profile: ${profileDir}`);
