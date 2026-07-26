import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const failures = [];

const runtimeRoots = [
  path.join(repoRoot, 'client', 'src'),
  path.join(repoRoot, 'server'),
  path.join(repoRoot, 'server.js')
];

const skipDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'appscript',
  'uploads',
  'public',
  'coverage'
]);

const skipFiles = new Set([
  'verifyAppScriptIndependence.js'
]);

const textExtensions = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css'
]);

const runtimeArchitectureAllowList = new Set([
  'client/src/architecture/README.md',
  'client/src/architecture/appscriptUiInventory.js',
  'client/src/architecture/coverageMatrix.js',
  'client/src/architecture/coverageMatrix.md',
  'client/src/architecture/featureContracts.js',
  'client/src/architecture/featureStructureAudit.js',
  'client/src/architecture/frontendParityBacklog.md',
  'client/src/architecture/index.js',
  'client/src/architecture/legacyInteractionMap.js',
  'client/src/architecture/legacySelectorRegistry.js',
  'client/src/architecture/parityAudit.md',
  'client/src/architecture/reactFrontendBlueprint.js',
  'client/src/architecture/reactModuleOwnershipMatrix.js',
  'client/src/architecture/routeMigrationMatrix.js',
  'client/src/architecture/surfaceRegistry.js',
  'client/src/architecture/uiMigrationRunbook.md',
  'client/src/architecture/uiSurfaceOwnershipMatrix.js'
]);

const bannedPatterns = [
  { regex: /google\.script\.run/i, label: 'google.script.run bridge' },
  { regex: /\bmernApi\b/i, label: 'legacy mernApi bridge' },
  { regex: /\/api\/apps-script\b/i, label: 'Apps Script API route' },
  { regex: /googleScriptRunShim/i, label: 'Apps Script shim asset' },
  { regex: /appscript\/(?:index|client-index|dashboard-index)\.html/i, label: 'legacy Apps Script HTML runtime dependency' }
];

function walk(targetPath) {
  const stats = fs.statSync(targetPath);
  if (stats.isFile()) {
    return [targetPath];
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (skipDirectories.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
      continue;
    }
    if (skipFiles.has(entry.name)) {
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function normalizeRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join(path.posix.sep);
}

function shouldSkipFile(filePath) {
  const relativePath = normalizeRelative(filePath);
  if (relativePath.startsWith('server/scripts/')) {
    return true;
  }
  if (relativePath.endsWith('/README.md') || relativePath.endsWith('.md')) {
    return true;
  }
  if (!relativePath.startsWith('client/src/architecture/')) {
    return false;
  }
  return runtimeArchitectureAllowList.has(relativePath);
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const runtimeFiles = runtimeRoots.flatMap((targetPath) => walk(targetPath)).filter((filePath) => !shouldSkipFile(filePath));

for (const filePath of runtimeFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  const relativePath = normalizeRelative(filePath);
  for (const pattern of bannedPatterns) {
    assert(!pattern.regex.test(source), `${pattern.label} found in ${relativePath}`);
  }
}

const serverSource = fs.readFileSync(path.join(repoRoot, 'server.js'), 'utf8');
assert(/clientDistPath/.test(serverSource), 'server.js is not configured to serve the built React client.');
assert(!/appscript\//i.test(serverSource), 'server.js still references the appscript directory at runtime.');

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log(`Apps Script runtime independence verification passed across ${runtimeFiles.length} source files.`);
