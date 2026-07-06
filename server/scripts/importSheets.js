import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { connectDatabase } from '../config/database.js';
import { legacyModuleSpecs } from '../models/legacyModels.js';
import { replaceCollection } from '../services/legacyStore.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const importDir = process.env.IMPORT_DIR ? path.resolve(process.env.IMPORT_DIR) : path.join(rootDir, 'imports');
const dryRun = ['1', 'true', 'yes'].includes(String(process.env.IMPORT_DRY_RUN || '').toLowerCase());

const modelOrder = [
  'User',
  'Client',
  'TicketHistory',
  'Ticket',
  'Attendance',
  'Leave',
  'Intimation',
  'Expense',
  'FmsTask',
  'Todo',
  'Invoice',
  'Message',
  'SocialHistory',
  'SocialMedia',
  'FormsPortal',
  'WhatsAppLog'
];

function aliasPattern(alias, model) {
  const escaped = alias.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-_\s]+/g, '[-_ ]?');
  if (model === 'SocialMedia' && /^social$/i.test(alias)) return /^social(?![-_ ]?history)/i;
  return new RegExp(`^${escaped}s?`, 'i');
}

const fileMap = modelOrder.map((model) => ({
  model,
  patterns: legacyModuleSpecs[model].aliases.map((alias) => aliasPattern(alias, model))
}));

function normalizeCell(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return '';
  return value;
}

function detectModel(name) {
  const clean = path.basename(name, path.extname(name)).trim();
  const found = fileMap.find((entry) => entry.patterns.some((pattern) => pattern.test(clean)));
  return found?.model || null;
}

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const rowsByModel = new Map();
  for (const sheetName of workbook.SheetNames) {
    const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
    const model = detectModel(sheetName) || detectModel(filePath);
    if (!model || !sheetRows.length) continue;
    const cleanRows = sheetRows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim(), normalizeCell(value)]))
    );
    rowsByModel.set(model, [...(rowsByModel.get(model) || []), ...cleanRows]);
  }
  return rowsByModel;
}

if (!dryRun) await connectDatabase();

if (!fs.existsSync(importDir)) {
  fs.mkdirSync(importDir, { recursive: true });
  console.log(`Created imports folder: ${importDir}`);
  console.log('Add CSV/XLSX exports here, then run npm.cmd run import:sheets again.');
  process.exit(0);
}

const files = fs
  .readdirSync(importDir)
  .filter((file) => /\.(xlsx|xls|csv)$/i.test(file))
  .map((file) => path.join(importDir, file));

if (!files.length) {
  console.log(`No CSV/XLSX files found in ${importDir}`);
  process.exit(0);
}

const merged = new Map();
for (const file of files) {
  const rowsByModel = readRows(file);
  for (const [model, rows] of rowsByModel.entries()) {
    merged.set(model, [...(merged.get(model) || []), ...rows]);
  }
}

for (const [model, rows] of merged.entries()) {
  if (dryRun) {
    const sampleColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 12);
    console.log(`${model}: dry-run ${rows.length} row(s); columns=${sampleColumns.join('|')}`);
  } else {
    const count = await replaceCollection(model, rows);
    console.log(`${model}: imported ${count} row(s)`);
  }
}

console.log(dryRun ? 'Import dry-run complete.' : 'Import complete.');
process.exit(0);
