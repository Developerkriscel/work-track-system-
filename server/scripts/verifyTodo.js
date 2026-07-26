import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import {
  addBulkTodos,
  addTodo,
  deleteTodoItem,
  editTodoItem,
  getTodos,
  toggleTodoStatus
} from '../services/todo.service.js';
import { insertRow, listRows, upsertRow } from '../services/legacyStore.service.js';

const failures = [];
const cleanupUsers = new Set();
const cleanupAttendance = new Set();
const cleanupTasks = new Set();

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
  const attendanceId = `TODO_GATE_${employeeId}_${Date.now()}`;
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

const ownerId = tempId('TODO_EMP');
const outsiderId = tempId('TODO_OUT');
const firstTaskText = `Verifier todo ${Date.now()}`;
let firstTaskId = '';

try {
  await seedUser({
    employeeId: ownerId,
    name: 'Todo Owner',
    department: 'Development'
  });
  await seedUser({
    employeeId: outsiderId,
    name: 'Todo Outsider',
    department: 'HR'
  });

  await seedAttendanceGate(ownerId, 'Todo Owner');

  const blockedCreate = await addTodo(outsiderId, 'Blocked create', 'Medium', today(), '30');
  assert(
    !blockedCreate.success && /Attendance Required|Punch In/i.test(String(blockedCreate.message || '')),
    'To-Do create should be blocked when attendance gate is not active.'
  );

  const createResult = await addTodo(ownerId, firstTaskText, 'High', today(), '45');
  assert(createResult.success, 'Owner with active attendance should be able to create a To-Do task.');
  firstTaskId = createResult.item?.['Task ID'] || createResult.item?.TodoID || '';
  if (firstTaskId) cleanupTasks.add(firstTaskId);
  assert(!!firstTaskId, 'To-Do create did not return a task identifier.');

  const createdDoc = firstTaskId
    ? await LegacyModels.Todo.findOne({ 'data.Task ID': firstTaskId }).lean()
    : null;
  assert(!!createdDoc, 'Created To-Do task was not persisted in MongoDB.');
  assert(createdDoc?.data?.Priority === 'High', 'Created To-Do priority did not persist.');
  assert(createdDoc?.data?.Status === 'Pending', 'Created To-Do should default to Pending.');

  const readResult = await getTodos(ownerId);
  assert(readResult.success, 'Owner should be able to read To-Do list.');
  assert(
    readResult.data.some((row) => String(row['Task ID'] || row.TodoID) === firstTaskId),
    'Created To-Do task did not appear in owner list.'
  );

  const toggleDone = await toggleTodoStatus(firstTaskId, 'Pending', ownerId);
  assert(toggleDone.success, 'Owner should be able to mark To-Do completed.');
  assert(toggleDone.item?.Status === 'Completed', 'Toggle should change Pending task to Completed.');

  const toggleBack = await toggleTodoStatus(firstTaskId, 'Completed', ownerId);
  assert(toggleBack.success, 'Owner should be able to mark completed To-Do back to Pending.');
  assert(toggleBack.item?.Status === 'Pending', 'Toggle should change Completed task back to Pending.');

  const editResult = await editTodoItem(firstTaskId, 'Verifier todo updated', 'Low', today(), '60', ownerId);
  assert(editResult.success, 'Owner should be able to edit To-Do task.');
  assert(editResult.item?.Task === 'Verifier todo updated', 'Edited To-Do task text did not persist.');
  assert(editResult.item?.Priority === 'Low', 'Edited To-Do priority did not persist.');
  assert(String(editResult.item?.TAT || '') === '60', 'Edited To-Do TAT did not persist.');

  const outsiderToggle = await toggleTodoStatus(firstTaskId, 'Pending', outsiderId);
  assert(!outsiderToggle.success, 'Outsider should not be able to toggle another user To-Do task.');

  const outsiderEdit = await editTodoItem(firstTaskId, 'Nope', 'High', today(), '90', outsiderId);
  assert(!outsiderEdit.success, 'Outsider should not be able to edit another user To-Do task.');

  const outsiderDelete = await deleteTodoItem(firstTaskId, outsiderId);
  assert(!outsiderDelete.success, 'Outsider should not be able to delete another user To-Do task.');

  const bulkResult = await addBulkTodos(ownerId, [
    {
      task: `Bulk todo A ${Date.now()}`,
      priority: 'Medium',
      dueDate: today(),
      tat: '20'
    },
    {
      task: `Bulk todo B ${Date.now()}`,
      priority: 'Low',
      dueDate: today(),
      tat: '25'
    }
  ]);
  assert(bulkResult.success, 'Bulk To-Do creation should succeed for owner with active attendance.');
  const bulkItems = Array.isArray(bulkResult.data) ? bulkResult.data : [];
  bulkItems.forEach((item) => {
    const taskId = item?.['Task ID'] || item?.TodoID;
    if (taskId) cleanupTasks.add(taskId);
  });
  assert(bulkItems.length === 2, 'Bulk To-Do creation should return both created tasks.');

  const deleteResult = await deleteTodoItem(firstTaskId, ownerId);
  assert(deleteResult.success, 'Owner should be able to delete To-Do task.');
  assert(deleteResult.item?.Status === 'Deleted', 'Deleted To-Do should persist Deleted status.');

  const deletedDoc = await LegacyModels.Todo.findOne({ 'data.Task ID': firstTaskId }).lean();
  assert(deletedDoc?.data?.Status === 'Deleted', 'MongoDB did not persist Deleted To-Do status.');

  const todoPageSource = fs.readFileSync('client/src/features/todo/TodoPage.jsx', 'utf8');
  const todoTableSource = fs.readFileSync('client/src/features/todo/components/TodoTable.jsx', 'utf8');
  assert(/AppModal/.test(todoPageSource), 'To-Do page should open add-task flow inside a modal.');
  assert(/type="checkbox"/.test(todoTableSource), 'To-Do table should expose checkbox completion control.');
  assert(/todo-row--completed/.test(todoTableSource), 'Completed To-Do rows should render faded completed styling hook.');
} catch (error) {
  failures.push(`To-Do verification failed: ${error.message}`);
} finally {
  if (cleanupTasks.size) {
    await LegacyModels.Todo.deleteMany({
      $or: [...cleanupTasks].map((taskId) => ({
        $or: [{ legacyId: taskId }, { 'data.Task ID': taskId }, { 'data.TodoID': taskId }]
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

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log('To-Do lifecycle and ownership verification passed.');
