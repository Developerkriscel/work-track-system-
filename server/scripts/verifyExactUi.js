import fs from 'fs';
import path from 'path';

const root = process.cwd();
const requiredFiles = [
  'appscript/index.html',
  'appscript/client-index.html',
  'appscript/dashboard-index.html',
  'public/worktrack-logo.png',
  'public/googleScriptRunShim.js',
  'server.js',
  'server/models/legacyModels.js',
  'server/routes/appsScript.routes.js',
  'server/scripts/openExactWorkTrack.js',
  'server/scripts/verifyReferenceScreens.ps1',
  'server/scripts/verifyImportDryRun.js'
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
for (const forbidden of ['react', 'react-dom', 'vite', '@vitejs/plugin-react', 'lucide-react', 'recharts']) {
  if (deps[forbidden]) failures.push(`Prototype dependency still present: ${forbidden}`);
}

for (const [name, script] of Object.entries(packageJson.scripts || {})) {
  if (/\bvite\b|react/i.test(script)) failures.push(`Prototype script still present: ${name}`);
}
if (!packageJson.scripts?.['verify:reference-screens']) {
  failures.push('Reference screen verification script missing from package.json');
}
if (!packageJson.scripts?.['verify:import']) {
  failures.push('Import verification script missing from package.json');
}
if (!packageJson.scripts?.['open:exact']) {
  failures.push('Clean exact WorkTrack browser launcher script missing from package.json');
}
if (!packageJson.scripts?.['verify:open-exact']) {
  failures.push('Clean exact WorkTrack browser launcher smoke script missing from package.json');
}

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
for (const route of ["['/', '/worktrack']", "'/client'", "'/dashboard'"]) {
  if (!server.includes(route)) failures.push(`Exact route not found in server.js: ${route}`);
}
if (!server.includes('googleScriptRunShim.js')) failures.push('Shim injection missing from server.js');
if (!server.includes('mern-cache-cleanup') || !server.includes('serviceWorker.getRegistrations') || !server.includes("'/service-worker.js'")) {
  failures.push('Cache/service-worker cleanup guard missing from server.js');
}
if (!server.includes('Clear-Site-Data') || !server.includes('"cache", "storage"') || !server.includes('worktrack_exact_cache_cleared')) {
  failures.push('One-time prototype cache/storage purge missing from server.js');
}
if (!server.includes("'/reset-localhost'") || !server.includes('Resetting WorkTrack local cache') || !server.includes('location.replace')) {
  failures.push('Manual localhost prototype reset route missing from server.js');
}
if (!server.includes('mern-appscript-viewport-scale') || !server.includes('zoom: 0.85')) {
  failures.push('Apps Script viewport scale injection missing from server.js');
}
if (!server.includes('/worktrack-logo.png')) failures.push('Local WorkTrack logo replacement missing from server.js');
if (!server.includes('API endpoint not found.') || !server.includes('exactPages.worktrack')) {
  failures.push('Exact UI stale-link fallback missing from server.js');
}
if (/app\.use\(express\.static\(path\.join\(__dirname,\s*['"]dist['"]\)\)/.test(server)) {
  failures.push('dist static React fallback is still enabled');
}

const shim = fs.readFileSync(path.join(root, 'public/googleScriptRunShim.js'), 'utf8');
for (const expectedShimFeature of ['withSuccessHandler', 'withFailureHandler', 'withUserObject', 'google.script.host']) {
  if (!shim.includes(expectedShimFeature)) failures.push(`Shim compatibility feature missing: ${expectedShimFeature}`);
}

const legacyModels = fs.readFileSync(path.join(root, 'server/models/legacyModels.js'), 'utf8');
for (const requiredModel of ['User', 'Client', 'Ticket', 'Attendance', 'Leave', 'Intimation', 'Expense', 'FmsTask', 'Todo', 'Invoice', 'Message', 'SocialMedia', 'SocialHistory', 'FormsPortal', 'TicketHistory', 'WhatsAppLog']) {
  if (!new RegExp(`${requiredModel}:\\s*\\{[\\s\\S]*?collection:[\\s\\S]*?aliases:`, 'm').test(legacyModels)) {
    failures.push(`Legacy Mongo module spec missing: ${requiredModel}`);
  }
}

const opener = fs.readFileSync(path.join(root, 'server/scripts/openExactWorkTrack.js'), 'utf8');
if (!opener.includes('.worktrack-browser-profile') || !opener.includes('/reset-localhost') || !opener.includes('msedge.exe') || !opener.includes('WORKTRACK_OPEN_SMOKE')) {
  failures.push('Clean exact WorkTrack browser launcher is missing reset/profile/browser safeguards');
}

const handlers = fs.readFileSync(path.join(root, 'server/routes/appsScript.routes.js'), 'utf8');
const handlerBlock = handlers.slice(handlers.indexOf('const handlers = {'));
const handlerNames = new Set([...handlerBlock.matchAll(/\n\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]));

function skipWs(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function skipBalancedCall(source, index) {
  if (source[index] !== '(') return index;
  let depth = 0;
  let quote = null;
  let escaped = false;
  let templateDepth = 0;
  for (; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (quote === '`' && char === '$' && next === '{') {
        templateDepth += 1;
        index += 1;
        continue;
      }
      if (quote === '`' && templateDepth && char === '}') {
        templateDepth -= 1;
        continue;
      }
      if (char === quote && !(quote === '`' && templateDepth)) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 1;
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return index;
}

function readIdent(source, index) {
  const match = /^[A-Za-z_$][\w$]*/.exec(source.slice(index));
  return match ? [match[0], index + match[0].length] : [null, index];
}

function scanGoogleScriptCalls(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const calls = [];
  let position = 0;
  while ((position = source.indexOf('google.script.run', position)) !== -1) {
    let index = position + 'google.script.run'.length;
    for (let guard = 0; guard < 20 && index < source.length; guard += 1) {
      index = skipWs(source, index);
      if (source[index] === '.') {
        index = skipWs(source, index + 1);
        const [name, nextIndex] = readIdent(source, index);
        if (!name) break;
        index = skipWs(source, nextIndex);
        if (name === 'withSuccessHandler' || name === 'withFailureHandler') {
          index = skipBalancedCall(source, index);
          continue;
        }
        calls.push(name);
        break;
      }
      if (source[index] === '[') break;
      break;
    }
    position = index + 1;
  }
  return calls;
}

const htmlFiles = ['appscript/index.html', 'appscript/client-index.html', 'appscript/dashboard-index.html'];
const frontendCalls = new Set(htmlFiles.flatMap(scanGoogleScriptCalls));
for (const dynamicCall of ['createTicketInSheet', 'createTodoInSheet']) frontendCalls.add(dynamicCall);

for (const fn of frontendCalls) {
  if (!handlerNames.has(fn)) failures.push(`Apps Script handler missing: ${fn}`);
}

for (const requiredBackendParityFn of ['checkPaymentRestriction', 'getScriptUrl', 'getTeamIds', 'checkTicketTatReminders']) {
  if (!handlerNames.has(requiredBackendParityFn)) failures.push(`Apps Script backend parity handler missing: ${requiredBackendParityFn}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Exact Apps Script UI verification passed.');
