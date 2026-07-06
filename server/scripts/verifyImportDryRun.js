import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import XLSX from 'xlsx';
import { legacyModelNames, legacyModuleSpecs } from '../models/legacyModels.js';

const root = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worktrack-import-'));

const workbook = XLSX.utils.book_new();
const requiredModels = [
  ['User', 'Employee ID'],
  ['Client', 'Client_Id'],
  ['Ticket', 'Ticket ID'],
  ['Attendance', 'AttendanceID'],
  ['Leave', 'LeaveID'],
  ['Intimation', 'IntimationID'],
  ['Expense', 'ExpenseID'],
  ['FmsTask', 'Task ID'],
  ['Todo', 'Task ID'],
  ['Invoice', 'InvoiceID'],
  ['Message', 'MessageID'],
  ['SocialMedia', 'Post ID'],
  ['SocialHistory', 'History ID'],
  ['FormsPortal', 'Sheet name'],
  ['TicketHistory', 'Ticket ID'],
  ['WhatsAppLog', 'Log ID']
];

const missingModelSpecs = requiredModels
  .map(([model]) => model)
  .filter((model) => !legacyModelNames.includes(model) || !legacyModuleSpecs[model]?.collection || !legacyModuleSpecs[model]?.aliases?.length);
if (missingModelSpecs.length) {
  console.error(`Missing legacy module specs: ${missingModelSpecs.join(', ')}`);
  process.exit(1);
}

const sheets = {
  Users: [{ 'Employee ID': 'VK', 'Employee Name': 'Vikas Kushwah', Password: '', Role: 'User', Status: 'Active' }],
  Clients: [{ Client_Id: 'CL000', 'Client Name': 'Kriscel Tech Private Limited', 'Mobile Number': '9876543210', 'Client Email ID': 'worktrack@kriscel.com' }],
  Tickets: [{ 'Ticket ID': 'TICKET_IMPORT_1', Client_Id: 'CL000', 'Task Description': 'Import parity ticket', Status: 'Pending Approval', 'Plan Date': '2026-07-03' }],
  Attendance: [{ AttendanceID: 'ATT_IMPORT_1', 'Employee ID': 'VK', Date: '2026-07-03', Action: 'Punch In', Status: 'Pending' }],
  Leaves: [{ LeaveID: 'LEAVE_IMPORT_1', 'Employee ID': 'VK', 'Start Date': '2026-07-03', Status: 'Pending' }],
  Intimations: [{ IntimationID: 'INT_IMPORT_1', 'Employee ID': 'VK', 'Intimation Type': 'Work from Home', Status: 'Submitted' }],
  Expenses: [{ ExpenseID: 'EXP_IMPORT_1', 'Employee ID': 'VK', Date: '2026-07-03', Amount: '100', Status: 'Pending' }],
  FMS: [{ 'Task ID': 'FMS_IMPORT_1', Client_Id: 'CL000', Description: 'Import FMS task', Status: 'Pending', 'Plan Date': '2026-07-03' }],
  Todo: [{ 'Task ID': 'TODO_IMPORT_1', 'Employee ID': 'VK', Task: 'Import todo', TAT: '30', Status: 'Pending' }],
  Invoices: [{ InvoiceID: 'INV_IMPORT_1', CustomerID: 'CL000', Amount: '1000', Outstanding: '500', Status: 'Partially Paid' }],
  Messages: [{ MessageID: 'MSG_IMPORT_1', TaskID: 'TICKET_IMPORT_1', Sender: 'Vikas Kushwah', Message: 'Import message' }],
  Social: [{ 'Post ID': 'SOC_IMPORT_1', Client_Id: 'CL000', Platform: 'LinkedIn', Description: 'Import social', Status: 'Pending Approval' }],
  SocialHistory: [{ 'History ID': 'HIST_IMPORT_1', 'Post ID': 'SOC_IMPORT_1', Remarks: 'Import history' }],
  Forms: [{ 'Form ID': 'FORM_IMPORT_1', Department: 'HR', 'Sheet name': 'Leave Request', For: 'Leave support', 'Form link': 'https://example.com/form' }],
  TicketHistory: [{ 'History ID': 'TICKET_HIST_IMPORT_1', 'Ticket ID': 'TICKET_IMPORT_1', ActionType: 'Created' }],
  WhatsApp: [{ 'Log ID': 'WA_IMPORT_1', Mobile: '9876543210', Message: 'Import WhatsApp log' }]
};

for (const [name, rows] of Object.entries(sheets)) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
}

const workbookPath = path.join(tempDir, 'worktrack-export.xlsx');
XLSX.writeFile(workbook, workbookPath);

try {
  const output = execFileSync(
    'node',
    ['server/scripts/importSheets.js'],
    {
      cwd: root,
      env: { ...process.env, IMPORT_DIR: tempDir, IMPORT_DRY_RUN: '1' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  const failures = requiredModels
    .filter(([model, column]) => !new RegExp(`${model}: dry-run \\d+ row\\(s\\); columns=.*${column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(output))
    .map(([model, column]) => `${model} dry-run missing preserved column ${column}`);

  if (!/Import dry-run complete\./.test(output)) failures.push('Dry-run did not complete.');
  if (failures.length) {
    console.error(output);
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log(output.trim());
  console.log('Import dry-run verification passed.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
