import bcrypt from 'bcryptjs';
import { listRows, upsertRow } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const isHashed = (value) => /^\$2[aby]\$\d{2}\$/.test(safe(value));

function withoutPassword(row = {}) {
  const { Password, password, ...safeRow } = row;
  return safeRow;
}

function normalizeAdminUser(userData = {}) {
  const employeeId = first(userData, ['Employee ID', 'User ID', 'employeeId', 'userId', 'id'], '');
  return {
    ...userData,
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': first(userData, ['Employee Name', 'employeeName', 'name'], ''),
    'Manager ID': first(userData, ['Manager ID', 'Manager', 'managerId'], ''),
    'Task Approver': first(userData, ['Task Approver', 'Approver', 'taskApprover'], ''),
    Department: first(userData, ['Department', 'department'], ''),
    Role: first(userData, ['Role', 'role'], 'User'),
    Password: first(userData, ['Password', 'password'], ''),
    Status: first(userData, ['Status', 'status'], 'Active'),
    'Mobile Number': first(userData, ['Mobile Number', 'Mobile', 'mobile'], ''),
    Email: first(userData, ['Email', 'email'], '')
  };
}

export async function getAllUsersForAdmin(_adminId = '') {
  const users = await listRows('User');
  return ok({ data: users.map(withoutPassword) });
}

export async function getAllManagersList() {
  const users = await listRows('User');
  return users
    .filter((user) => /manager|admin|super admin|hr/i.test(safe(user.Role)))
    .map((user) => ({
      id: user['Employee ID'],
      name: user['Employee Name'],
      role: user.Role
    }));
}

export async function getEmpMasterData(_category = 'Master') {
  const users = await listRows('User');
  return ok({ data: users.map(withoutPassword) });
}

export async function getNextEmpCode(category = 'EMP') {
  const users = await listRows('User');
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
  const existing = (await listRows('User')).find((user) => safe(first(user, ['Employee ID', 'User ID', 'employeeId', 'userId'])).toLowerCase() === safe(employeeId).toLowerCase());
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
