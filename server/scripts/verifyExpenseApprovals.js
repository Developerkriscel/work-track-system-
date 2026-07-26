import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { processExpenseApprovalFromMongo } from '../services/expenses.service.js';
import { insertRow, upsertRow } from '../services/legacyStore.service.js';

const failures = [];
const cleanupUsers = new Set();
const cleanupExpenses = new Set();
const cleanupAttendance = new Set();

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function today() {
  return '2099-01-15';
}

async function seedUser({ employeeId, name, role = 'User', department = 'Operations' }) {
  cleanupUsers.add(employeeId);
  await upsertRow('User', 'Employee ID', employeeId, {
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': name,
    Name: name,
    Role: role,
    Department: department,
    Status: 'Active',
    Password: 'Verify@123'
  });
}

async function seedAttendance(employeeId, employeeName) {
  const attendanceId = tempId(`ATT_${employeeId}`);
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
process.env.WORKTRACK_REFERENCE_DATE = today();

const adminId = tempId('EXP_ADM');
const ownerId = tempId('EXP_OWN');
const expenseId = tempId('EXP_ITEM');

try {
  await seedUser({ employeeId: adminId, name: 'Expense Approver', role: 'HR', department: 'HR' });
  await seedUser({ employeeId: ownerId, name: 'Expense Owner', role: 'User', department: 'Development' });
  await seedAttendance(adminId, 'Expense Approver');
  await seedAttendance(ownerId, 'Expense Owner');

  cleanupExpenses.add(expenseId);
  await insertRow('Expense', {
    ExpenseID: expenseId,
    'Expense ID': expenseId,
    'Employee ID': ownerId,
    'Employee Name': 'Expense Owner',
    Date: today(),
    Type: 'Travel',
    Amount: '275.50',
    Description: 'Pending expense for approval verification',
    Status: 'Pending'
  });

  const approval = await processExpenseApprovalFromMongo(expenseId, 'Approved', 'Looks good', adminId);
  assert(approval.success, 'Expense approval should succeed for an authorized approver with active attendance.');
  assert(approval.item?.Status === 'Approved', 'Expense status should update to Approved.');
  assert(String(approval.item?.Approver || '') === 'Expense Approver', 'Expense approver should persist the approving employee name.');
  assert(String(approval.item?.['Admin Remarks'] || '') === 'Looks good', 'Expense admin remarks should persist.');

  const approvedDoc = await LegacyModels.Expense.findOne({
    $or: [{ 'data.ExpenseID': expenseId }, { 'data.Expense ID': expenseId }]
  }).lean();
  assert(approvedDoc?.data?.Status === 'Approved', 'Approved expense should be persisted to MongoDB.');
  assert(approvedDoc?.data?.Approver === 'Expense Approver', 'Approved expense Mongo document should carry approver name.');
} catch (error) {
  failures.push(`Expense approval verification failed: ${error.message}`);
} finally {
  if (cleanupExpenses.size) {
    await LegacyModels.Expense.deleteMany({
      $or: [...cleanupExpenses].map((expenseIdValue) => ({
        $or: [{ legacyId: expenseIdValue }, { 'data.ExpenseID': expenseIdValue }, { 'data.Expense ID': expenseIdValue }]
      }))
    });
  }

  if (cleanupAttendance.size) {
    await LegacyModels.Attendance.deleteMany({
      $or: [...cleanupAttendance].map((attendanceIdValue) => ({
        $or: [{ legacyId: attendanceIdValue }, { 'data.AttendanceID': attendanceIdValue }]
      }))
    });
  }

  if (cleanupUsers.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanupUsers].map((employeeIdValue) => ({
        $or: [{ legacyId: employeeIdValue }, { 'data.Employee ID': employeeIdValue }, { 'data.User ID': employeeIdValue }]
      }))
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log('Expense approval verification passed.');
