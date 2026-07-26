import { LegacyModels } from '../models/legacyModels.js';
import { listRows, upsertRow } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const isPlaceholderUrl = (value) => /(^|\/\/)(www\.)?example\.com(\/|$)/i.test(safe(value));

function formPortalIdForSheet(sheetName) {
  const cleaned = safe(sheetName).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned ? `FORM_${cleaned}` : `FORM_${Date.now()}`;
}

function normalizeAssignedUsers(value) {
  if (Array.isArray(value)) {
    return value.map((item) => safe(item).toUpperCase()).filter(Boolean);
  }
  return safe(value)
    .split(',')
    .map((item) => safe(item).toUpperCase())
    .filter(Boolean);
}

function normalizeFormPortalPayload(formData = {}) {
  const visibilityTypeRaw = first(formData, ['Visibility Type', 'VisibilityType', 'visibilityType'], '');
  const requestedVisibilityType = safe(visibilityTypeRaw).toUpperCase();
  const visibleUsers = normalizeAssignedUsers(
    first(formData, ['Visible Users', 'VisibleUsers', 'visibleUsers', 'Viewer', 'viewer'], '')
  );

  let visibilityType = requestedVisibilityType;
  if (!visibilityType) visibilityType = visibleUsers.length ? 'SELECTED_USERS' : 'ALL';
  if (visibilityType !== 'ALL') visibilityType = 'SELECTED_USERS';

  return {
    ...formData,
    Department: first(formData, ['Department', 'department'], 'General'),
    'Sheet name': first(formData, ['Sheet name', 'Sheet Name', 'sheetName', 'Category'], ''),
    For: first(formData, ['For', 'Purpose', 'forText'], ''),
    'Form link': first(formData, ['Form link', 'Form Link', 'formLink', 'Link'], ''),
    'Visibility Type': visibilityType,
    'Visible Users': visibilityType === 'ALL' ? '' : visibleUsers.join(', '),
    Viewer: visibilityType === 'ALL' ? 'ALL' : visibleUsers.join(', '),
    Status: first(formData, ['Status', 'status'], 'Active')
  };
}

export async function canManageFormsPortal(employeeId = '') {
  const cleanEmpId = safe(employeeId).toUpperCase();
  if (!cleanEmpId) return false;
  const users = await listRows('User');
  const user = users.find((item) => eq(first(item, ['Employee ID', 'User ID', 'employeeId']), cleanEmpId));
  const role = safe(first(user, ['Role', 'role']));
  return cleanEmpId === 'MS101' || role === 'Super Admin';
}

function serializeForm(form) {
  return {
    ...form,
    'Visibility Type': safe(first(form, ['Visibility Type', 'VisibilityType'], 'ALL')).toUpperCase() || 'ALL',
    'Visible Users': first(form, ['Visible Users', 'VisibleUsers', 'Viewer', 'viewer'], ''),
    Viewer:
      safe(first(form, ['Visibility Type', 'VisibilityType'], 'ALL')).toUpperCase() === 'ALL'
        ? 'ALL'
        : first(form, ['Visible Users', 'VisibleUsers', 'Viewer', 'viewer'], ''),
    'Form link': isPlaceholderUrl(form['Form link'] || form.formLink) ? '' : (form['Form link'] || form.formLink || '')
  };
}

export async function getFormsForEmployee(employeeId = '') {
  const cleanEmpId = safe(employeeId).toUpperCase();
  if (!cleanEmpId) return ok({ data: [] });

  const forms = await listRows('FormsPortal');
  const isFormsAdmin = await canManageFormsPortal(cleanEmpId);
  const visibleForms = forms
    .filter((form) => !eq(form.Status, 'Inactive'))
    .filter((form) => {
      if (isFormsAdmin) return true;
      const visibilityType = safe(first(form, ['Visibility Type', 'VisibilityType'], 'ALL')).toUpperCase();
      if (visibilityType === 'ALL') return true;
      const visibleUsers = normalizeAssignedUsers(first(form, ['Visible Users', 'VisibleUsers', 'Viewer', 'viewer'], ''));
      return visibleUsers.includes(cleanEmpId);
    })
    .map(serializeForm);

  return ok({ data: visibleForms });
}

export async function getFormsAssignableUsers(adminId = '') {
  if (!(await canManageFormsPortal(adminId))) return fail('Access Denied: Only Super Admin can manage form access.');

  const users = await listRows('User');
  return ok({
    data: users
      .filter((user) => !eq(first(user, ['Status', 'status'], 'Active'), 'Inactive'))
      .map((user) => ({
        id: first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId', 'empCode']),
        name: first(user, ['Employee Name', 'Name', 'Full Name', 'name', 'employeeName']),
        department: first(user, ['Department', 'department'], ''),
        role: first(user, ['Role', 'role', 'Designation'], ''),
        status: first(user, ['Status', 'status'], 'Active')
      }))
      .filter((user) => safe(user.id))
      .sort((left, right) => `${left.name} ${left.id}`.localeCompare(`${right.name} ${right.id}`))
  });
}

export async function saveForm(formData = {}, adminId = '') {
  if (!(await canManageFormsPortal(adminId))) return fail('Access Denied: Only Super Admin has rights to update Forms.');

  const sheetName = first(formData, ['Sheet name', 'sheetName', 'Category'], `FORM_${Date.now()}`);
  const formId = first(formData, ['Form ID', 'ID'], formPortalIdForSheet(sheetName));
  const normalized = normalizeFormPortalPayload(formData);
  const row = await upsertRow('FormsPortal', 'Sheet name', sheetName, {
    ...normalized,
    'Form ID': formId,
    'Sheet name': sheetName
  });
  return ok({ message: 'Form saved.', item: row });
}

export async function addForm(formData = {}, adminId = '') {
  if (!(await canManageFormsPortal(adminId))) return fail('Access Denied: Only Super Admin can add forms.');

  const sheetName = first(formData, ['Sheet name', 'sheetName', 'Category'], `FORM_${Date.now()}`);
  const normalized = normalizeFormPortalPayload(formData);
  const row = {
    'Form ID': first(formData, ['Form ID', 'ID'], formPortalIdForSheet(sheetName)),
    ...normalized,
    'Sheet name': sheetName
  };
  const saved = await upsertRow('FormsPortal', 'Sheet name', sheetName, row);
  return ok({ message: 'Form added.', item: saved });
}

export async function deleteForm(sheetName, adminId = '') {
  if (!(await canManageFormsPortal(adminId))) return fail('Access Denied: Only Super Admin can delete records.');

  const forms = await listRows('FormsPortal');
  const target = forms.find((form) => eq(first(form, ['Sheet name', 'Sheet Name', 'sheetName']), sheetName));
  if (!target) return fail('Form record not found.');

  await LegacyModels.FormsPortal.deleteOne({ _id: target._id });
  return ok({ message: 'Form deleted successfully.', item: target });
}
