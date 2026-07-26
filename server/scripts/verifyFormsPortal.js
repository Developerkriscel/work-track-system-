import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import {
  addForm,
  canManageFormsPortal,
  deleteForm,
  getFormsAssignableUsers,
  getFormsForEmployee,
  saveForm
} from '../services/formsPortal.service.js';
import { upsertRow } from '../services/legacyStore.service.js';

const failures = [];
const cleanupEmployeeIds = new Set();
const cleanupSheetNames = new Set();

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

async function seedUser({
  employeeId,
  name,
  role,
  department = 'Quality',
  status = 'Active'
}) {
  cleanupEmployeeIds.add(employeeId);
  await upsertRow('User', 'Employee ID', employeeId, {
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': name,
    Name: name,
    Role: role,
    Status: status,
    Department: department,
    Password: 'Verify@123'
  });
}

await connectDatabase();

const ms101Id = 'MS101';
const selectedUserId = tempId('FP_EMP');
const blockedUserId = tempId('FP_HIDE');
const superAdminId = tempId('FP_SA');
const formSheetName = `Forms Verify ${Date.now()}`;
const updatedPurpose = `Updated purpose ${Date.now()}`;
const originalLink = 'https://docs.google.com/forms/d/e/verify-forms-portal/viewform';
const updatedLink = 'https://script.google.com/macros/s/verify-forms-portal/exec';

cleanupSheetNames.add(formSheetName);

try {
  await seedUser({
    employeeId: ms101Id,
    name: 'Forms Legacy Admin',
    role: 'User',
    department: 'Operations'
  });
  await seedUser({
    employeeId: selectedUserId,
    name: 'Visible Employee',
    role: 'User',
    department: 'Development'
  });
  await seedUser({
    employeeId: blockedUserId,
    name: 'Hidden Employee',
    role: 'User',
    department: 'HR'
  });
  await seedUser({
    employeeId: superAdminId,
    name: 'Forms Super Admin',
    role: 'Super Admin',
    department: 'Management'
  });

  assert(await canManageFormsPortal(ms101Id), 'MS101 should be allowed to manage Forms Portal for legacy parity.');
  assert(await canManageFormsPortal(superAdminId), 'Super Admin should be allowed to manage Forms Portal.');
  assert(!(await canManageFormsPortal(selectedUserId)), 'Regular employee should not be allowed to manage Forms Portal.');

  const deniedAdd = await addForm(
    {
      Department: 'Development',
      'Sheet name': `${formSheetName} DENIED`,
      For: 'Denied add check',
      'Form link': originalLink,
      'Visibility Type': 'ALL',
      Viewer: 'ALL'
    },
    selectedUserId
  );
  assert(!deniedAdd.success, 'Regular employee should be denied when adding a form.');

  const addResult = await addForm(
    {
      Department: 'Development',
      'Sheet name': formSheetName,
      For: 'Selected-user visibility check',
      'Form link': originalLink,
      'Visibility Type': 'SELECTED_USERS',
      'Visible Users': selectedUserId,
      Viewer: selectedUserId,
      Status: 'Active'
    },
    ms101Id
  );
  assert(addResult.success, 'MS101 should be able to add a form.');

  const selectedView = await getFormsForEmployee(selectedUserId);
  assert(
    selectedView.success && selectedView.data.some((row) => row['Sheet name'] === formSheetName),
    'Selected employee should see the assigned form.'
  );

  const hiddenView = await getFormsForEmployee(blockedUserId);
  assert(
    hiddenView.success && !hiddenView.data.some((row) => row['Sheet name'] === formSheetName),
    'Unassigned employee should not see a selected-users form.'
  );

  const superAdminView = await getFormsForEmployee(superAdminId);
  assert(
    superAdminView.success && superAdminView.data.some((row) => row['Sheet name'] === formSheetName),
    'Super Admin should see all forms regardless of assigned users.'
  );

  const assignableUsers = await getFormsAssignableUsers(ms101Id);
  assert(assignableUsers.success, 'MS101 should be allowed to load assignable users.');
  assert(
    assignableUsers.data.some((user) => user.id === selectedUserId) &&
      assignableUsers.data.some((user) => user.id === blockedUserId),
    'Assignable users list should include active users from MongoDB.'
  );

  const deniedUsers = await getFormsAssignableUsers(selectedUserId);
  assert(!deniedUsers.success, 'Regular employee should be denied when loading assignable users.');

  const saveResult = await saveForm(
    {
      Department: 'Development',
      'Sheet name': formSheetName,
      For: updatedPurpose,
      'Form link': updatedLink,
      'Visibility Type': 'ALL',
      Viewer: 'ALL',
      Status: 'Active'
    },
    superAdminId
  );
  assert(saveResult.success, 'Super Admin should be able to update form access.');

  const afterUpdateHiddenView = await getFormsForEmployee(blockedUserId);
  assert(
    afterUpdateHiddenView.success && afterUpdateHiddenView.data.some((row) => row['Sheet name'] === formSheetName),
    'All-users visibility should make the form visible to previously blocked employees.'
  );

  const updatedForm = afterUpdateHiddenView.data.find((row) => row['Sheet name'] === formSheetName);
  assert(updatedForm?.For === updatedPurpose, 'Updated purpose should persist to MongoDB-backed form data.');
  assert(updatedForm?.['Form link'] === updatedLink, 'Updated form link should persist to MongoDB-backed form data.');

  const deleteResult = await deleteForm(formSheetName, ms101Id);
  assert(deleteResult.success, 'MS101 should be able to delete a form.');

  const afterDeleteView = await getFormsForEmployee(selectedUserId);
  assert(
    afterDeleteView.success && !afterDeleteView.data.some((row) => row['Sheet name'] === formSheetName),
    'Deleted form should no longer appear to employees.'
  );

  const formsPortalTableSource = fs.readFileSync('client/src/features/forms-portal/components/FormsPortalTable.jsx', 'utf8');
  assert(/target="_blank"/.test(formsPortalTableSource), 'Forms table should open external forms in a new tab.');
  assert(/Manage Access/.test(formsPortalTableSource), 'Forms table should expose Manage Access control for admins.');
} catch (error) {
  failures.push(`Forms Portal verification failed: ${error.message}`);
} finally {
  if (cleanupSheetNames.size) {
    await LegacyModels.FormsPortal.deleteMany({
      $or: [...cleanupSheetNames].map((sheetName) => ({ 'data.Sheet name': sheetName }))
    });
  }

  if (cleanupEmployeeIds.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanupEmployeeIds].map((employeeId) => ({ 'data.Employee ID': employeeId }))
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

console.log('Forms Portal lifecycle and access verification passed.');
