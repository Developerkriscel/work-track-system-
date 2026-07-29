import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { createFmsTask, getFmsAssignableUsers, getFmsTasks, markFmsTaskDone } from '../services/fms.service.js';
import { insertRow, upsertRow } from '../services/legacyStore.service.js';

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

function futureDate(days = 2) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function seedUser({
  employeeId,
  name,
  role = 'User',
  department = 'Operations',
  managerId = '',
  taskApprover = '',
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
    'Manager ID': managerId,
    Manager: managerId,
    'Task Approver': taskApprover,
    Password: 'Verify@123'
  });
}

async function seedAttendanceGate(employeeId, employeeName) {
  const attendanceId = `FMS_GATE_${employeeId}_${Date.now()}`;
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

const managerId = tempId('FMS_MGR');
const employeeId = tempId('FMS_EMP');
const teamMateId = tempId('FMS_TEAM');
const outsiderId = tempId('FMS_OUT');
const completedTaskId = tempId('FMS_DONE');
const pendingTaskId = tempId('FMS_PEND');
const futureTaskId = tempId('FMS_FUT');
const teamTaskId = tempId('FMS_TEAMTASK');
const createdByManagerTaskId = tempId('FMS_CREATED');
const createdByHrTaskId = tempId('FMS_HR_CREATED');
const hrId = tempId('FMS_HR');

cleanupTasks.add(completedTaskId);
cleanupTasks.add(pendingTaskId);
cleanupTasks.add(futureTaskId);
cleanupTasks.add(teamTaskId);
cleanupTasks.add(createdByManagerTaskId);
cleanupTasks.add(createdByHrTaskId);
cleanupUsers.add(hrId);

try {
  await seedUser({
    employeeId: managerId,
    name: 'FMS Manager',
    role: 'Manager',
    department: 'Operations'
  });
  await seedUser({
    employeeId: employeeId,
    name: 'FMS Owner',
    role: 'User',
    department: 'Development',
    managerId,
    taskApprover: managerId
  });
  await seedUser({
    employeeId: teamMateId,
    name: 'FMS Team Mate',
    role: 'User',
    department: 'Development',
    managerId,
    taskApprover: managerId
  });
  await seedUser({
    employeeId: outsiderId,
    name: 'FMS Outsider',
    role: 'User',
    department: 'HR'
  });
  await seedUser({
    employeeId: hrId,
    name: 'FMS HR',
    role: 'HR',
    department: 'HR'
  });

  await seedAttendanceGate(employeeId, 'FMS Owner');
  await seedAttendanceGate(managerId, 'FMS Manager');

  await upsertRow('FmsTask', 'Task ID', completedTaskId, {
    'Task ID': completedTaskId,
    ID: completedTaskId,
    Client_Id: 'CL000',
    Client: 'Kriscel Tech Private Limited',
    'Client Name': 'Kriscel Tech Private Limited',
    'Employee ID': employeeId,
    'Employee Name': 'FMS Owner',
    who: 'FMS Owner',
    'Task Description': 'Completed verification task',
    Description: 'Completed verification task',
    Status: 'Completed',
    'Plan Date': today(),
    Date: today(),
    'Done Date': today(),
    actualDate: today(),
    rowId: completedTaskId,
    fmsName: 'Kriscel Tech Private Limited'
  });

  await upsertRow('FmsTask', 'Task ID', pendingTaskId, {
    'Task ID': pendingTaskId,
    ID: pendingTaskId,
    Client_Id: 'CL000',
    Client: 'Kriscel Tech Private Limited',
    'Client Name': 'Kriscel Tech Private Limited',
    'Employee ID': employeeId,
    'Employee Name': 'FMS Owner',
    who: 'FMS Owner',
    'Task Description': 'Pending verification task',
    Description: 'Pending verification task',
    Status: 'Pending',
    'Plan Date': today(),
    Date: today(),
    rowId: pendingTaskId,
    fmsName: 'Kriscel Tech Private Limited',
    formLink: ''
  });

  await upsertRow('FmsTask', 'Task ID', futureTaskId, {
    'Task ID': futureTaskId,
    ID: futureTaskId,
    Client_Id: 'CL000',
    Client: 'Kriscel Tech Private Limited',
    'Client Name': 'Kriscel Tech Private Limited',
    'Employee ID': employeeId,
    'Employee Name': 'FMS Owner',
    who: 'FMS Owner',
    'Task Description': 'Future verification task',
    Description: 'Future verification task',
    Status: 'Pending',
    'Plan Date': futureDate(3),
    Date: futureDate(3),
    rowId: futureTaskId,
    fmsName: 'Kriscel Tech Private Limited'
  });

  await upsertRow('FmsTask', 'Task ID', teamTaskId, {
    'Task ID': teamTaskId,
    ID: teamTaskId,
    Client_Id: 'CL000',
    Client: 'Kriscel Tech Private Limited',
    'Client Name': 'Kriscel Tech Private Limited',
    'Employee ID': teamMateId,
    'Employee Name': 'FMS Team Mate',
    who: 'FMS Team Mate',
    'Task Description': 'Team member verification task',
    Description: 'Team member verification task',
    Status: 'Pending',
    'Plan Date': today(),
    Date: today(),
    rowId: teamTaskId,
    fmsName: 'Kriscel Tech Private Limited'
  });

  const ownerView = await getFmsTasks(employeeId);
  assert(ownerView.success, 'Owner should be able to load FMS tasks.');
  assert(ownerView.meta?.role === 'User', 'Owner FMS metadata should report the user role.');
  assert(ownerView.data.some((task) => String(task['Task ID'] || task.rowId) === pendingTaskId), 'Owner should see own pending task.');
  assert(ownerView.data.some((task) => String(task['Task ID'] || task.rowId) === futureTaskId), 'Owner should see own future task.');
  assert(ownerView.data.some((task) => String(task['Task ID'] || task.rowId) === completedTaskId), 'Owner should see own completed task.');
  assert(
    ownerView.data.find((task) => String(task['Task ID'] || task.rowId) === completedTaskId)?.Status === 'Completed',
    'Completed owner task should preserve Completed status in Mongo-backed response.'
  );
  assert(
    ownerView.data.find((task) => String(task['Task ID'] || task.rowId) === futureTaskId)?.Status === 'Pending',
    'Future owner task should preserve Pending status until completion.'
  );

  const teamView = await getFmsTasks(managerId);
  assert(teamView.success, 'Manager should be able to load FMS tasks.');
  assert(teamView.meta?.role === 'Manager', 'Manager FMS metadata should report manager role.');
  assert(teamView.data.some((task) => String(task['Task ID'] || task.rowId) === teamTaskId), 'Manager should see team task in FMS view.');

  const managerAssignable = await getFmsAssignableUsers(managerId);
  assert(managerAssignable.success, 'Manager should receive assignable FMS users.');
  assert(managerAssignable.data.some((user) => String(user.id) === managerId), 'Manager assignable list should include self.');
  assert(managerAssignable.data.some((user) => String(user.id) === employeeId), 'Manager assignable list should include direct report.');
  assert(managerAssignable.data.some((user) => String(user.id) === teamMateId), 'Manager assignable list should include team member.');
  assert(!managerAssignable.data.some((user) => String(user.id) === outsiderId), 'Manager assignable list should not include unrelated users.');

  const managerCreate = await createFmsTask(
    {
      assigneeId: teamMateId,
      fmsName: 'CRM FMS',
      taskName: 'Manager created FMS task',
      taskDescription: 'Created during verification.',
      what: 'Call',
      how: 'Manual',
      stepNo: '1',
      planDate: today(),
      tatMinutes: '45',
      remarks: 'Manager seed'
    },
    managerId
  );
  assert(managerCreate.success, 'Manager should be able to create FMS task for direct report.');
  assert(managerCreate.item?.Status === 'Pending', 'Newly created manager FMS task should start as Pending.');
  cleanupTasks.add(managerCreate.item?.['Task ID'] || createdByManagerTaskId);

  const managerCreatedId = managerCreate.item?.['Task ID'] || managerCreate.item?.ID || managerCreate.item?.rowId;
  const managerCreatedDoc = managerCreatedId
    ? await LegacyModels.FmsTask.findOne({ $or: [{ legacyId: managerCreatedId }, { 'data.Task ID': managerCreatedId }] }).lean()
    : null;
  assert(managerCreatedDoc?.data?.['Employee ID'] === teamMateId, 'MongoDB should persist manager-created assignee.');
  assert(managerCreatedDoc?.data?.Status === 'Pending', 'MongoDB should persist manager-created task status.');

  const hrAssignable = await getFmsAssignableUsers(hrId);
  assert(hrAssignable.success, 'HR should receive assignable FMS users.');
  assert(hrAssignable.data.some((user) => String(user.id) === outsiderId), 'HR assignable list should include unrelated active users.');

  const hrCreate = await createFmsTask(
    {
      assigneeId: outsiderId,
      fmsName: 'HR FMS',
      taskName: 'HR created FMS task',
      taskDescription: 'HR should be able to assign org-wide.',
      planDate: today(),
      tatMinutes: '30'
    },
    hrId
  );
  assert(hrCreate.success, 'HR should be able to create FMS task for any active user.');
  cleanupTasks.add(hrCreate.item?.['Task ID'] || createdByHrTaskId);

  const completeDenied = await markFmsTaskDone(teamTaskId, 'Should fail', managerId);
  assert(!completeDenied.success, 'Manager should not be able to complete team member FMS tasks.');

  const outsiderView = await getFmsTasks(outsiderId);
  assert(outsiderView.success, 'Outsider should still receive a successful FMS response if present in user list.');
  assert(!outsiderView.data.some((task) => String(task['Task ID'] || task.rowId) === pendingTaskId), 'Outsider should not see another employee FMS tasks.');
  const outsiderAssignable = await getFmsAssignableUsers(outsiderId);
  assert(!outsiderAssignable.success, 'Regular user should not receive assignable FMS users.');
  const outsiderCreate = await createFmsTask(
    {
      assigneeId: outsiderId,
      fmsName: 'Blocked FMS',
      taskName: 'Should fail',
      taskDescription: 'User create must fail.',
      planDate: today(),
      tatMinutes: '30'
    },
    outsiderId
  );
  assert(!outsiderCreate.success, 'Regular user should not be able to create FMS tasks.');

  const completeResult = await markFmsTaskDone(pendingTaskId, 'Verifier completed task.', employeeId);
  assert(completeResult.success, 'Owner should be able to complete own FMS task.');
  assert(completeResult.item?.Status === 'Completed', 'Completed FMS task should persist Completed status.');
  assert(String(completeResult.item?.['Done Date'] || '').slice(0, 10) === today(), 'Completed FMS task should get today done date.');
  assert(/on time|late/i.test(String(completeResult.item?.['On Time Status'] || completeResult.item?.onTimeStatus || '')), 'Completed FMS task should persist an on-time status.');

  const doneDoc = await LegacyModels.FmsTask.findOne({ 'data.Task ID': pendingTaskId }).lean();
  assert(doneDoc?.data?.Status === 'Completed', 'MongoDB did not persist completed FMS task status.');
  assert(doneDoc?.data?.Remarks === 'Verifier completed task.', 'MongoDB did not persist FMS remarks.');

  const fmsPageSource = fs.readFileSync('client/src/features/fms/FmsPage.jsx', 'utf8');
  const fmsTabsSource = fs.readFileSync('client/src/features/fms/components/FmsTabsPanel.jsx', 'utf8');
  const fmsTableSource = fs.readFileSync('client/src/features/fms/components/FmsTaskTable.jsx', 'utf8');
  const fmsHeaderSource = fs.readFileSync('client/src/features/fms/components/FmsHeader.jsx', 'utf8');
  const fmsCreateDialogSource = fs.readFileSync('client/src/features/fms/components/FmsCreateDialog.jsx', 'utf8');
  assert(/FmsCompletionDialog/.test(fmsPageSource), 'FMS page should open completion dialog for done action.');
  assert(/FmsCreateDialog/.test(fmsPageSource), 'FMS page should wire the create FMS dialog.');
  assert(/teamOnly/.test(fmsTabsSource), 'FMS tabs should preserve team-only tabs.');
  assert(/View Only/.test(fmsTableSource) && /Mark Done/.test(fmsTableSource), 'FMS table should expose both view-only and completion actions.');
  assert(/Add FMS/.test(fmsHeaderSource), 'FMS header should expose Add FMS action for elevated roles.');
  assert(/Assign To \*/.test(fmsCreateDialogSource) && /Create FMS/.test(fmsCreateDialogSource), 'FMS create dialog should expose assignment and submit controls.');
} catch (error) {
  failures.push(`FMS verification failed: ${error.message}`);
} finally {
  if (cleanupTasks.size) {
    await LegacyModels.FmsTask.deleteMany({
      $or: [...cleanupTasks].map((taskId) => ({
        $or: [{ legacyId: taskId }, { 'data.Task ID': taskId }, { 'data.ID': taskId }, { 'data.rowId': taskId }]
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
      $or: [...cleanupUsers].map((employeeIdValue) => ({
        $or: [{ legacyId: employeeIdValue }, { 'data.Employee ID': employeeIdValue }]
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

console.log('FMS lifecycle and hierarchy verification passed.');
