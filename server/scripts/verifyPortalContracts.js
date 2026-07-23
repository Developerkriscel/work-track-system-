import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { getEmployeeNotifications } from '../services/notifications.service.js';
import {
  getFormsAssignableUsers,
  getFormsForEmployee
} from '../services/formsPortal.service.js';
import { listRows } from '../services/legacyStore.service.js';

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => clean(value)) ?? fallback;
const employeeId = (row) => first(row, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId', 'empCode']);
const active = (row) => !/^inactive$/i.test(first(row, ['Status', 'status'], 'Active'));
const visibleUsers = (form) => first(form, ['Visible Users', 'VisibleUsers', 'Viewer', 'viewer'])
  .split(',')
  .map(upper)
  .filter(Boolean);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await connectDatabase();

try {
  const [users, forms] = await Promise.all([
    listRows('User'),
    listRows('FormsPortal')
  ]);
  const activeUserRows = users.filter(active);
  const activeUsers = activeUserRows.map((row) => upper(employeeId(row))).filter(Boolean);
  const superAdmin = users.find((row) => /^super admin$/i.test(first(row, ['Role', 'role'], '')) && active(row));
  assert(superAdmin, 'No active Super Admin exists for Forms Portal management verification.');
  const superAdminId = upper(employeeId(superAdmin));

  const assignable = await getFormsAssignableUsers(superAdminId);
  assert(assignable.success, assignable.message || 'Assignable-user request failed.');
  const assignableIds = new Set(assignable.data.map((row) => upper(row.id)).filter(Boolean));
  assert(activeUsers.every((id) => assignableIds.has(id)), 'Forms Portal assignable users do not include every active employee.');

  const superAdminForms = await getFormsForEmployee(superAdminId);
  const activeForms = forms.filter((form) => !/^inactive$/i.test(first(form, ['Status', 'status'], 'Active')));
  assert(superAdminForms.data.length === activeForms.length, 'Super Admin cannot see every active form.');

  const selectedForm = activeForms.find((form) => {
    const type = upper(first(form, ['Visibility Type', 'VisibilityType'], 'ALL'));
    return type !== 'ALL' && visibleUsers(form).length;
  });
  if (selectedForm) {
    const allowedId = visibleUsers(selectedForm)[0];
    const deniedId = activeUserRows
      .filter((row) => !/^super admin$/i.test(first(row, ['Role', 'role'], '')))
      .map((row) => upper(employeeId(row)))
      .find((id) => id && !visibleUsers(selectedForm).includes(id));
    const allowedForms = await getFormsForEmployee(allowedId);
    assert(allowedForms.data.some((form) => form['Sheet name'] === selectedForm['Sheet name']), 'Selected employee cannot see assigned form.');
    if (deniedId) {
      const deniedForms = await getFormsForEmployee(deniedId);
      assert(!deniedForms.data.some((form) => form['Sheet name'] === selectedForm['Sheet name']), 'Unselected employee can see restricted form.');
    }
  }

  for (const id of activeUsers) {
    const notifications = await getEmployeeNotifications(id, 0);
    assert(notifications.success && Array.isArray(notifications.notifications), `Notification contract failed for ${id}.`);
  }

  console.log(`Portal contract verification passed: ${assignableIds.size} assignable users, ${activeForms.length} active forms, ${activeUsers.length} notification scopes.`);
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
