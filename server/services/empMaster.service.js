import { saveBase64File } from './fileStorage.service.js';
import { listRows, upsertRow } from './legacyStore.service.js';
import { saveOrUpdateUser } from './admin.service.js';

const safe = (value = '') => String(value ?? '').trim();
function first(row = {}, keys = [], fallback = '') {
  for (const key of keys) {
    if (safe(row?.[key])) return row[key];
  }
  const entries = Object.entries(row || {});
  for (const key of keys) {
    const match = entries.find(([candidate, value]) => candidate.trim().toLowerCase() === key.trim().toLowerCase() && safe(value));
    if (match) return match[1];
  }
  return fallback;
}
const ok = (payload = {}) => ({ success: true, ...payload });
const inactiveStatuses = new Set(['inactive', 'resigned', 'terminated']);

export const empCategories = ['Master', 'EMP', 'Freelancer', 'Intern'];
export const empStatuses = ['Active', 'Pending', 'Inactive', 'Resigned', 'Terminated'];

function normalizeCategory(value) {
  const raw = safe(value).toLowerCase();
  if (raw === 'employee' || raw === 'emp') return 'EMP';
  if (raw === 'freelancer') return 'Freelancer';
  if (raw === 'intern') return 'Intern';
  if (raw === 'inactive') return 'Inactive';
  return 'Master';
}

function empCode(row = {}) {
  return first(row, ['EMP Code', 'Employee ID', 'User ID', 'empCode', 'employeeId', 'userId']);
}

function empName(row = {}) {
  return first(row, ['Name', 'Employee Name', 'Full Name', 'name', 'employeeName', 'fullName']);
}

function activeRow(row = {}) {
  return !inactiveStatuses.has(safe(row.Status || 'Active').toLowerCase());
}

function userStatusForEmp(status) {
  return inactiveStatuses.has(safe(status).toLowerCase()) ? 'Inactive' : 'Active';
}

function normalizeEmpMasterRow(input = {}, category = 'Master') {
  const normalizedCategory = normalizeCategory(category || first(input, ['Category', 'category']));
  const code = safe(first(input, ['EMP Code', 'Employee ID', 'User ID', 'empCode', 'employeeId', 'userId']));
  const userId = safe(first(input, ['User ID', 'Employee ID', 'userId', 'employeeId'], code));
  const name = empName(input);
  const designation = first(input, ['Designation', 'Role', 'designation', 'role']);
  const joiningDate = first(input, ['Date of Joining', 'Joining Date', 'dateOfJoining', 'joiningDate']);
  const mobile = first(input, ['Phone No', 'Mobile Number', 'Mobile', 'phone', 'mobile']);
  const officialEmail = first(input, ['Official mail id if any', 'Email', 'officialEmail', 'email']);
  const personalEmail = first(input, ['Personal Email ID', 'personalEmail']);

  return {
    ...input,
    Category: normalizedCategory,
    'EMP Code': code,
    'Employee ID': code,
    'User ID': userId,
    Name: name,
    'Employee Name': name,
    Designation: designation,
    Role: first(input, ['Role', 'Designation', 'role', 'designation'], designation),
    'Date of Joining': joiningDate,
    'Joining Date': joiningDate,
    'Phone No': mobile,
    'Mobile Number': mobile,
    'Official mail id if any': officialEmail,
    'Personal Email ID': personalEmail,
    Email: officialEmail || personalEmail,
    Department: first(input, ['Department', 'department']),
    Status: first(input, ['Status', 'status'], 'Active') || 'Active'
  };
}

function projectUserAsMaster(user = {}) {
  const code = empCode(user);
  return normalizeEmpMasterRow({
    ...user,
    Category: 'Master',
    'EMP Code': code,
    'User ID': first(user, ['User ID', 'Employee ID', 'userId', 'employeeId'], code),
    Name: empName(user),
    Designation: first(user, ['Designation', 'Role', 'designation', 'role']),
    'Date of Joining': first(user, ['Date of Joining', 'Joining Date', 'dateOfJoining', 'joiningDate']),
    'Phone No': first(user, ['Phone No', 'Mobile Number', 'Mobile', 'phone', 'mobile']),
    'Official mail id if any': first(user, ['Official mail id if any', 'Email', 'officialEmail', 'email'])
  }, 'Master');
}

function mergePreservingExisting(existing = {}, incoming = {}) {
  const next = { ...existing };
  Object.entries(incoming).forEach(([key, value]) => {
    const blank = value === undefined || value === null || (typeof value === 'string' && !value.trim());
    if (!blank || !safe(existing[key])) next[key] = value;
  });
  return next;
}

function uploadFiles(row, filePayloads = {}) {
  const next = { ...row };
  if (filePayloads.offer?.base64) next['OFFER LETTER LINK'] = saveBase64File(filePayloads.offer, 'emp_documents');
  if (filePayloads.appointment?.base64) next['APPOINTMENT LETTER LINK'] = saveBase64File(filePayloads.appointment, 'emp_documents');
  if (Array.isArray(filePayloads.bunch) && filePayloads.bunch.length) {
    const links = filePayloads.bunch
      .map((file) => file?.base64 ? saveBase64File(file, 'emp_documents') : safe(file))
      .filter(Boolean);
    if (links.length) next['Documents of Employee'] = links.join(', ');
  }
  return next;
}

async function syncToLoginUser(row, adminId, portalPassword = '') {
  const loginId = safe(row['User ID']);
  if (!loginId) return null;
  const users = await listRows('User');
  const existing = users.find((user) => safe(first(user, ['Employee ID', 'User ID', 'employeeId', 'userId'])).toLowerCase() === loginId.toLowerCase());
  const syncPayload = {
    ...(existing || {}),
    'Employee ID': loginId,
    'User ID': loginId,
    'Employee Name': row.Name || row['Employee Name'],
    Department: row.Department || first(existing, ['Department', 'department']) || '',
    Role: first(existing, ['Role', 'role'], 'User'),
    Status: userStatusForEmp(row.Status),
    'Manager ID': first(existing, ['Manager ID', 'Manager', 'managerId']),
    'Task Approver': first(existing, ['Task Approver', 'taskApprover']),
    'Mobile Number': row['Phone No'] || row['Mobile Number'] || first(existing, ['Mobile Number', 'Mobile', 'mobile']) || '',
    Email: row['Official mail id if any'] || row.Email || row['Personal Email ID'] || first(existing, ['Email', 'email']) || ''
  };
  if (portalPassword) syncPayload.Password = portalPassword;
  return saveOrUpdateUser(syncPayload, adminId);
}

export async function getEmpMasterData(category = 'Master') {
  const targetCategory = normalizeCategory(category);
  const records = await listRows('EmpMaster');
  const users = await listRows('User');
  const normalized = records.map((row) => normalizeEmpMasterRow(row, row.Category));

  if (targetCategory === 'Inactive') {
    return ok({
      category: targetCategory,
      data: normalized
        .filter((row) => empCode(row) && inactiveStatuses.has(safe(row.Status).toLowerCase()))
        .map((row) => ({ ...row, _sourceSheet: row.Category }))
    });
  }

  if (targetCategory === 'Master') {
    const allEmpMasterRows = normalized.filter((row) => empCode(row) && activeRow(row));
    const existingEmpCodes = new Set(allEmpMasterRows.map((row) => safe(empCode(row)).toLowerCase()));
    
    const legacyUsers = users
      .map(projectUserAsMaster)
      .filter((row) => empCode(row) && activeRow(row) && !existingEmpCodes.has(safe(empCode(row)).toLowerCase()));
      
    return ok({ category: 'Master', data: [...allEmpMasterRows, ...legacyUsers] });
  }

  const categoryRows = normalized.filter((row) => empCode(row) && row.Category === targetCategory && activeRow(row));
  return ok({ category: targetCategory, data: categoryRows });
}

export async function getNextEmpCode(category = 'EMP') {
  const targetCategory = normalizeCategory(category);
  const boundaries = {
    Master: [1, 100],
    EMP: [1, 100],
    Intern: [101, 200],
    Freelancer: [201, 300]
  };
  const [min, max] = boundaries[targetCategory] || boundaries.EMP;
  const records = await listRows('EmpMaster');
  const users = await listRows('User');
  let highest = min - 1;

  const processRow = (row, rowCategory) => {
    if (normalizeCategory(rowCategory) !== targetCategory) return;
    const match = empCode(row)?.match(/^KRIS_(\d+)$/i);
    if (!match) return;
    const value = Number(match[1]);
    if (value >= min && value <= max) highest = Math.max(highest, value);
  };

  records.forEach((row) => processRow(row, row.Category));
  users.forEach((row) => processRow(row, 'Master'));

  const next = highest + 1;
  if (next > max) return { success: false, message: `Limit reached for ${targetCategory} (max KRIS_${max}).` };
  const code = `KRIS_${String(next).padStart(3, '0')}`;
  return ok({ code, nextCode: code });
}

export async function saveEmpMasterData(category, formData = {}, filePayloads = {}, adminId = '') {
  const targetCategory = normalizeCategory(category || formData.Category);
  const records = await listRows('EmpMaster');
  const users = await listRows('User');
  const requestedCode = safe(first(formData, ['EMP Code', 'Employee ID', 'User ID', 'empCode', 'employeeId', 'userId']));
  const existing = records.find((row) => safe(empCode(row)).toLowerCase() === requestedCode.toLowerCase());
  const portalPassword = safe(first(formData, ['Password', 'password']));
  const merged = mergePreservingExisting(existing || {}, formData);
  delete merged.Password;
  delete merged.password;
  const prepared = uploadFiles(normalizeEmpMasterRow(merged, targetCategory), filePayloads);
  if (!safe(prepared['EMP Code'])) return { success: false, message: 'EMP Code is required.' };
  if (!safe(prepared['User ID'])) return { success: false, message: 'User ID is required.' };
  if (!safe(prepared.Name)) return { success: false, message: 'Employee name is required.' };
  if (safe(prepared.Email) && !/^\S+@\S+\.\S+$/.test(safe(prepared.Email))) {
    return { success: false, message: 'Please enter a valid employee email address.' };
  }
  const duplicateLogin = records.find((row) => safe(first(row, ['User ID', 'Employee ID', 'userId', 'employeeId'])).toLowerCase() === safe(prepared['User ID']).toLowerCase() && safe(empCode(row)).toLowerCase() !== safe(prepared['EMP Code']).toLowerCase());
  if (duplicateLogin) return { success: false, message: `User ID ${prepared['User ID']} is already assigned to another employee.` };
  const linkedUser = users.find((user) => safe(first(user, ['Employee ID', 'User ID', 'employeeId', 'userId'])).toLowerCase() === safe(prepared['User ID']).toLowerCase());
  if (linkedUser && !existing && safe(prepared['EMP Code']).toLowerCase() !== safe(prepared['User ID']).toLowerCase()) {
    return { success: false, message: `User ID ${prepared['User ID']} already belongs to another login account.` };
  }
  if (!linkedUser && !portalPassword) {
    return { success: false, message: 'Portal Password is required when creating a new employee login.' };
  }

  const saved = await upsertRow('EmpMaster', 'EMP Code', prepared['EMP Code'], prepared);
  const userSync = await syncToLoginUser(saved, adminId, portalPassword);
  if (userSync && !userSync.success) return userSync;
  return ok({ message: `Employee ${prepared['EMP Code']} saved successfully.`, item: saved });
}
