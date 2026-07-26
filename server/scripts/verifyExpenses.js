import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { getExpensesForUser, recordExpense } from '../services/expenses.service.js';
import { insertRow, upsertRow } from '../services/legacyStore.service.js';

const failures = [];
const cleanupUsers = new Set();
const cleanupAttendance = new Set();
const cleanupExpenses = new Set();
const cleanupFiles = new Set();

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function seedUser({
  employeeId,
  name,
  role = 'User',
  department = 'Operations',
  status = 'Active'
}) {
  cleanupUsers.add(employeeId);
  await upsertRow('User', 'Employee ID', employeeId, {
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': name,
    Name: name,
    Role: role,
    Department: department,
    Status: status,
    Password: 'Verify@123'
  });
}

async function seedAttendanceGate(employeeId, employeeName) {
  const attendanceId = `EXP_GATE_${employeeId}_${Date.now()}`;
  cleanupAttendance.add(attendanceId);
  await insertRow('Attendance', {
    AttendanceID: attendanceId,
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': employeeName,
    Date: `${today()}T09:00:00+05:30`,
    Time: `${today()}T09:00:00+05:30`,
    Action: 'Punch In',
    'Punch In': '09:00 am',
    Status: 'Present'
  });
}

await connectDatabase();

const ownerId = tempId('EXP_EMP');
const outsiderId = tempId('EXP_OUT');
const seededOtherExpenseId = `EXP_OTHER_${Date.now()}`;

cleanupExpenses.add(seededOtherExpenseId);

try {
  await seedUser({
    employeeId: ownerId,
    name: 'Expense Owner',
    department: 'Development'
  });
  await seedUser({
    employeeId: outsiderId,
    name: 'Expense Outsider',
    department: 'HR'
  });

  await seedAttendanceGate(ownerId, 'Expense Owner');

  const blockedCreate = await recordExpense({
    'Employee ID': outsiderId,
    'Employee Name': 'Expense Outsider',
    Date: today(),
    Type: 'Food',
    Amount: '99.00',
    Description: 'Blocked expense without attendance'
  });
  assert(
    !blockedCreate.success && /Attendance Required|Punch In/i.test(String(blockedCreate.message || '')),
    'Expense record should be blocked when attendance gate is not active.'
  );

  await insertRow('Expense', {
    ExpenseID: seededOtherExpenseId,
    'Expense ID': seededOtherExpenseId,
    'Employee ID': outsiderId,
    'Employee Name': 'Expense Outsider',
    Date: today(),
    Type: 'Travel',
    Amount: '123.45',
    Description: 'Other employee seeded expense',
    Status: 'Pending'
  });

  const createResult = await recordExpense({
    'Employee ID': ownerId,
    'Employee Name': 'Expense Owner',
    Date: today(),
    Type: 'Travel',
    Amount: '450.75',
    Description: 'Verifier expense with receipt',
    Receipt: {
      base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      fileName: 'expense-proof.png',
      mimeType: 'image/png'
    }
  });
  assert(createResult.success, 'Employee with active attendance should be able to record an expense.');

  const expenseId = createResult.item?.ExpenseID || createResult.item?.['Expense ID'] || '';
  if (expenseId) cleanupExpenses.add(expenseId);
  assert(!!expenseId, 'Expense record did not return an expense identifier.');
  assert(createResult.item?.Status === 'Pending', 'New expense should default to Pending.');
  assert(
    String(createResult.item?.['Receipt URL'] || '').startsWith('/uploads/expenses/'),
    'Expense receipt should persist as an uploads path.'
  );

  const createdDoc = expenseId
    ? await LegacyModels.Expense.findOne({
        $or: [{ 'data.ExpenseID': expenseId }, { 'data.Expense ID': expenseId }]
      }).lean()
    : null;
  assert(!!createdDoc, 'Created expense was not persisted in MongoDB.');
  assert(createdDoc?.data?.Amount === '450.75', 'Expense amount did not persist.');
  assert(createdDoc?.data?.Description === 'Verifier expense with receipt', 'Expense description did not persist.');

  const receiptUrl = String(createdDoc?.data?.['Receipt URL'] || '');
  if (receiptUrl.startsWith('/uploads/')) {
    const receiptPath = path.join(process.cwd(), receiptUrl.replace(/^\//, '').replace(/\//g, path.sep));
    cleanupFiles.add(receiptPath);
    assert(fs.existsSync(receiptPath), 'Uploaded expense receipt file was not written to disk.');
  }

  const ownerList = await getExpensesForUser(ownerId);
  assert(ownerList.success, 'Employee should be able to load own expenses.');
  assert(
    ownerList.data.some((item) => String(item.ExpenseID || item['Expense ID']) === expenseId),
    'Employee expense list should include newly created expense.'
  );
  assert(
    !ownerList.data.some((item) => String(item.ExpenseID || item['Expense ID']) === seededOtherExpenseId),
    'Employee expense list should not include other users expenses.'
  );

  const expensesPageSource = fs.readFileSync('client/src/features/expenses/ExpensesPage.jsx', 'utf8');
  const formSource = fs.readFileSync('client/src/features/expenses/components/ExpenseFormPanel.jsx', 'utf8');
  const tableSource = fs.readFileSync('client/src/features/expenses/components/ExpensesHistoryTable.jsx', 'utf8');
  assert(/ExpenseFormPanel/.test(expensesPageSource), 'Expenses page should render the record-expense form panel.');
  assert(/receiptPreview/.test(formSource), 'Expense form should support receipt preview behavior.');
  assert(/target="_blank"/.test(tableSource), 'Expense history should open receipts in a new tab.');
} catch (error) {
  failures.push(`Expenses verification failed: ${error.message}`);
} finally {
  if (cleanupExpenses.size) {
    await LegacyModels.Expense.deleteMany({
      $or: [...cleanupExpenses].map((expenseId) => ({
        $or: [{ legacyId: expenseId }, { 'data.ExpenseID': expenseId }, { 'data.Expense ID': expenseId }]
      }))
    });
  }

  if (cleanupAttendance.size) {
    await LegacyModels.Attendance.deleteMany({
      $or: [...cleanupAttendance].map((attendanceId) => ({
        $or: [{ legacyId: attendanceId }, { 'data.AttendanceID': attendanceId }]
      }))
    });
  }

  if (cleanupUsers.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanupUsers].map((employeeId) => ({
        $or: [{ legacyId: employeeId }, { 'data.Employee ID': employeeId }]
      }))
    });
  }

  cleanupFiles.forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Leave cleanup best-effort; verification result is based on write success.
    }
  });

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log('Expenses employee lifecycle verification passed.');
