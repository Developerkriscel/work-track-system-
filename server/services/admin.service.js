import bcrypt from 'bcryptjs';
import { deleteRow, listRows, upsertRow } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const isHashed = (value) => /^\$2[aby]\$\d{2}\$/.test(safe(value));

function canActorManageUser(actorRole = '', targetUser = {}) {
  const actor = safe(actorRole).toLowerCase();
  if (actor === 'admin' || actor === 'super admin') return true;
  const targetRole = safe(first(targetUser, ['Role', 'role', 'Designation'])).toLowerCase();
  if (actor === 'hr' && (targetRole === 'admin' || targetRole === 'super admin')) return false;
  return actor === 'hr';
}

function withoutPassword(row = {}) {
  const { Password, password, ...safeRow } = row;
  return safeRow;
}

function normalizeAdminUser(userData = {}) {
  const employeeId = first(userData, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId', 'id'], '');
  const employeeName = first(userData, ['Employee Name', 'Name', 'employeeName', 'name'], '');
  const managerId = first(userData, ['Manager ID', 'Manager', 'managerId'], '');
  const taskApprover = first(userData, ['Task Approver', 'Approver', 'taskApprover'], '');
  const mobile = first(userData, ['Mobile Number', 'Mobile', 'mobile', 'Phone No', 'phone'], '');
  const email = first(userData, ['Email', 'email', 'Official mail id if any', 'Personal Email ID'], '');
  const role = first(userData, ['Role', 'role', 'Designation'], 'User');
  return {
    ...userData,
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': employeeName,
    Name: first(userData, ['Name', 'Employee Name', 'employeeName', 'name'], employeeName),
    'Manager ID': managerId,
    Manager: first(userData, ['Manager', 'Manager ID', 'managerId'], managerId),
    'Task Approver': taskApprover,
    Department: first(userData, ['Department', 'department'], ''),
    Role: role,
    Password: first(userData, ['Password', 'password'], ''),
    Status: first(userData, ['Status', 'status'], 'Active'),
    'Mobile Number': mobile,
    Mobile: mobile,
    Email: email
  };
}

function isRealUserRow(userData = {}) {
  const normalized = normalizeAdminUser(userData);
  const employeeId = safe(normalized['Employee ID']);
  const employeeName = safe(normalized['Employee Name']);
  if (!employeeId || !employeeName) return false;
  if (/^(tmp_|test_|verify_|debug_)/i.test(employeeId)) return false;
  if (/^tmp\b/i.test(employeeName)) return false;
  if (/verification|debug admin emp/i.test(employeeName)) return false;
  return true;
}

function normalizeVisibleUser(userData = {}) {
  return withoutPassword(normalizeAdminUser(userData));
}

async function listAdminUsers() {
  const users = await listRows('User');
  return users
    .map(normalizeVisibleUser)
    .filter(isRealUserRow)
    .sort((left, right) => {
      const leftName = safe(left['Employee Name'] || left['Employee ID']);
      const rightName = safe(right['Employee Name'] || right['Employee ID']);
      return leftName.localeCompare(rightName);
    });
}

export async function getAllUsersForAdmin(_adminId = '') {
  return ok({ data: await listAdminUsers() });
}

export async function getAllManagersList() {
  const users = await listAdminUsers();
  return users
    .filter((user) => /manager|admin|super admin|hr/i.test(safe(user.Role)))
    .map((user) => ({
      id: user['Employee ID'],
      name: user['Employee Name'],
      role: user.Role
    }));
}

export async function getEmpMasterData(_category = 'Master') {
  return ok({ data: await listAdminUsers() });
}

export async function getNextEmpCode(category = 'EMP') {
  const users = await listAdminUsers();
  const prefixMap = {
    Master: 'MS',
    EMP: 'EMP',
    Employee: 'EMP',
    Freelancer: 'FR',
    Intern: 'IN'
  };
  const prefix =
    prefixMap[category] ||
    String(category || 'EMP').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() ||
    'EMP';
  const max = users.reduce((highest, user) => {
    const raw = first(user, ['EMP Code', 'Employee ID', 'User ID']);
    const match = String(raw).match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 100);
  const nextCode = `${prefix}${max + 1}`;
  return ok({ code: nextCode, nextCode });
}

export async function saveOrUpdateUser(userData = {}, _adminId = '') {
  const normalized = normalizeAdminUser(userData);
  const employeeId = normalized['Employee ID'] || `EMP_${Date.now()}`;
  const existing = (await listRows('User')).find((user) => safe(first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId'])).toLowerCase() === safe(employeeId).toLowerCase());
  if (!safe(normalized['Employee Name'])) return { success: false, message: 'Employee Name is required.' };
  if (!safe(normalized.Department)) return { success: false, message: 'Department is required.' };
  if (safe(normalized.Password)) {
    if (!isHashed(normalized.Password)) normalized.Password = await bcrypt.hash(normalized.Password, 10);
  } else if (existing?.Password || existing?.password) {
    normalized.Password = existing.Password || existing.password;
  }
  const row = await upsertRow('User', 'Employee ID', employeeId, {
    ...normalized,
    'Employee ID': employeeId,
    Status: normalized.Status || 'Active'
  });
  return ok({ message: 'User saved.', item: row });
}

export async function saveEmpMasterData(category, formData = {}, adminId = '') {
  const merged = {
    ...formData,
    Category: category || formData.Category || 'Master'
  };
  return saveOrUpdateUser(merged, adminId);
}

export async function deleteUserByEmployeeId(identifier = '', actorRole = '') {
  const employeeId = safe(identifier);
  if (!employeeId) return { success: false, message: 'Employee ID is required.' };

  const users = await listRows('User');
  const target = users.find((user) => safe(first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId'])).toLowerCase() === employeeId.toLowerCase());
  if (!target) return { success: false, message: 'User record not found.' };
  if (!canActorManageUser(actorRole, target)) {
    return { success: false, message: 'HR can not edit or delete Admin or Super Admin user details.' };
  }

  const deleted = await deleteRow('User', 'Employee ID', employeeId);
  if (!deleted) return { success: false, message: 'User record could not be deleted.' };

  return ok({
    message: `User ${employeeId} deleted successfully.`,
    item: deleted
  });
}
