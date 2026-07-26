import { saveBase64File } from './fileStorage.service.js';
import { insertRow, listRows, upsertRow } from './legacyStore.service.js';
import { checkUserAttendanceActive } from './attendance.service.js';

const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function today() {
  return localDate(referenceNow());
}

function nowIso() {
  return referenceNow().toISOString();
}

function normalizedDate(value) {
  if (!value) return today();
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function attendanceEventTime(row) {
  const date = normalizedDate(first(row, ['Date'], today()));
  const time = first(row, ['Time', 'Punch In', 'Punch Out']);
  const parsed = new Date(time || date);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(String(time || date))) return parsed.getTime();
  return new Date(`${date}T00:00:00+05:30`).getTime();
}

function isAttendanceActive(rowsList, employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return true;
  const todayRows = rowsList
    .filter((row) => eq(row['Employee ID'] || row.EmpID, employeeId) && normalizedDate(row.Date) === today())
    .sort((left, right) => attendanceEventTime(right) - attendanceEventTime(left));
  const latest = todayRows[0];
  if (!latest) return false;
  const action = safe(latest.Action);
  if (/punch\s*out/i.test(action)) return false;
  if (/punch\s*in/i.test(action)) return true;
  return !!first(latest, ['Punch In', 'Time']) && !first(latest, ['Punch Out']);
}

async function requireAttendanceActive(employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return null;
  const attendance = await listRows('Attendance');
  if (isAttendanceActive(attendance, employeeId)) return null;
  return fail('Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!');
}

async function requireManagerApprovalRole(adminId) {
  const users = await listRows('User');
  const admin = users.find((item) => eq(first(item, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']), adminId));
  if (!admin) return { ok: false, message: 'Unauthorized access.' };
  const role = safe(first(admin, ['Role', 'role'], 'User')).toLowerCase();
  if (!['admin', 'super admin', 'hr'].includes(role)) {
    return { ok: false, message: 'Unauthorized access.' };
  }
  const gate = await checkUserAttendanceActive(adminId);
  if (!gate?.active) {
    return { ok: false, message: 'Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!' };
  }
  return { ok: true, admin };
}

function normalizeAttachmentField(value, folderName = 'expenses') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      return saveBase64File(item, folderName);
    })
    .filter(Boolean)
    .join(',');
}

export async function recordExpense(expenseData = {}) {
  const gate = await requireAttendanceActive(expenseData['Employee ID']);
  if (gate) return gate;
  const row = {
    ExpenseID: expenseData.ExpenseID || `EXP_${Date.now()}`,
    Status: 'Pending',
    'Last Update Date': nowIso(),
    ...expenseData
  };
  row['Receipt URL'] = normalizeAttachmentField(expenseData.Receipt || expenseData['Receipt URL'], 'expenses');
  await insertRow('Expense', row);
  return ok({ message: 'Expense recorded.', item: row });
}

export async function getExpensesForUser(employeeId) {
  const expenses = await listRows('Expense');
  return ok({ data: expenses.filter((row) => eq(row['Employee ID'], employeeId)) });
}

export async function processExpenseApprovalFromMongo(expenseId, status, remarks, adminId) {
  const access = await requireManagerApprovalRole(adminId);
  if (!access.ok) return fail(access.message);

  const expenses = await listRows('Expense');
  const expense = expenses.find((row) => eq(first(row, ['ExpenseID', 'Expense ID', 'ID', 'expenseId']), expenseId));
  if (!expense) return fail('Expense record not found.');

  const approvalStatus = safe(status) || 'Pending';
  const updated = await upsertRow('Expense', 'ExpenseID', expenseId, {
    ...expense,
    ExpenseID: expenseId,
    'Expense ID': expenseId,
    Status: approvalStatus,
    Approver: access.admin['Employee Name'] || access.admin['Employee ID'] || adminId,
    'Admin Remarks': remarks || expense['Admin Remarks'] || '',
    'Last Update Date': new Date().toISOString()
  });

  return ok({
    message: `Expense claim ${approvalStatus} successfully.`,
    item: updated
  });
}
