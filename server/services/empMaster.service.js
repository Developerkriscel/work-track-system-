import { saveBase64File } from './fileStorage.service.js';
import { deleteRow, listRows, registerStoreMutationListener, upsertRow } from './legacyStore.service.js';
import { saveOrUpdateUser } from './admin.service.js';
import { buildRedisKey, deleteByPrefix, getJson, setJson } from './redisCache.service.js';

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
const elevatedRoles = new Set(['admin', 'super admin']);
const editableCategories = new Map([
  ['master', 'Master'],
  ['emp', 'EMP'],
  ['employee', 'EMP'],
  ['freelancer', 'Freelancer'],
  ['intern', 'Intern']
]);
const EMP_MASTER_CACHE_TTL_MS = Number(process.env.WORKTRACK_EMP_MASTER_CACHE_TTL_MS || 60_000);
const empMasterCache = new Map();
const empMasterInflight = new Map();

export const empCategories = ['Master', 'EMP', 'Freelancer', 'Intern'];
export const empStatuses = ['Active', 'Pending', 'Inactive', 'Resigned', 'Terminated'];

function cacheKey(category, adminRole = '') {
  return buildRedisKey('emp-master', safe(category || 'Master').toLowerCase(), safe(adminRole || 'none').toLowerCase());
}

function readMemoryCache(key) {
  const cached = empMasterCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at > EMP_MASTER_CACHE_TTL_MS) {
    empMasterCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeMemoryCache(key, value) {
  empMasterCache.set(key, { at: Date.now(), value });
}

async function withEmpMasterCache(key, loader) {
  const memory = readMemoryCache(key);
  if (memory) return memory;

  const redis = await getJson(key);
  if (redis) {
    writeMemoryCache(key, redis);
    return redis;
  }

  const inflight = empMasterInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const value = await loader();
    writeMemoryCache(key, value);
    await setJson(key, value, EMP_MASTER_CACHE_TTL_MS);
    return value;
  })();

  empMasterInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    empMasterInflight.delete(key);
  }
}

async function clearEmpMasterCaches() {
  empMasterCache.clear();
  empMasterInflight.clear();
  await deleteByPrefix(buildRedisKey('emp-master'));
}

function normalizeCategory(value) {
  const raw = safe(value).toLowerCase();
  if (raw === 'employee' || raw === 'emp') return 'EMP';
  if (raw === 'freelancer') return 'Freelancer';
  if (raw === 'intern') return 'Intern';
  if (raw === 'inactive') return 'Inactive';
  return 'Master';
}

function normalizeEditableCategory(value) {
  return editableCategories.get(safe(value).toLowerCase()) || '';
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

function codeRangeForCategory(category = 'EMP') {
  const targetCategory = normalizeEditableCategory(category);
  if (!targetCategory) return null;
  const boundaries = {
    Master: [1, 100],
    EMP: [1, 100],
    Intern: [101, 200],
    Freelancer: [201, 300]
  };
  return boundaries[targetCategory] || boundaries.EMP;
}

function krisCodeNumber(row = {}) {
  const match = empCode(row)?.match(/^KRIS_(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function nextAvailableCodeFromRows(category = 'EMP', records = [], users = []) {
  const targetCategory = normalizeEditableCategory(category);
  const range = codeRangeForCategory(targetCategory);
  if (!targetCategory || !range) {
    return { success: false, message: 'Please choose a valid employee category.' };
  }

  const [min, max] = range;
  const used = new Set();
  [...records, ...users].forEach((row) => {
    const value = krisCodeNumber(row);
    if (Number.isFinite(value) && value >= min && value <= max) used.add(value);
  });

  for (let next = min; next <= max; next += 1) {
    if (!used.has(next)) {
      const code = `KRIS_${String(next).padStart(3, '0')}`;
      return ok({ code, nextCode: code });
    }
  }

  return { success: false, message: `Limit reached for ${targetCategory} (max KRIS_${max}).` };
}

function canActorEditRow(actorRole = '', row = {}) {
  const normalizedActorRole = safe(actorRole).toLowerCase();
  if (elevatedRoles.has(normalizedActorRole)) return true;
  const targetRole = safe(first(row, ['Role', 'Designation'])).toLowerCase();
  if (normalizedActorRole === 'hr' && elevatedRoles.has(targetRole)) return false;
  return true;
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
    'Manager ID': first(input, ['Manager ID', 'Manager', 'managerId']),
    'Task Approver': first(input, ['Task Approver', 'Approver', 'taskApprover']),
    'Assign Buddy': first(input, ['Assign Buddy', 'Buddy', 'assignBuddy']),
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

async function uploadFiles(row, filePayloads = {}) {
  const next = { ...row };
  if (filePayloads.offer?.base64) next['OFFER LETTER LINK'] = await saveBase64File(filePayloads.offer, 'emp_documents');
  if (filePayloads.appointment?.base64) next['APPOINTMENT LETTER LINK'] = await saveBase64File(filePayloads.appointment, 'emp_documents');
  if (filePayloads.aadhaar?.base64) next['AADHAAR CARD LINK'] = await saveBase64File(filePayloads.aadhaar, 'emp_documents');
  if (filePayloads.pan?.base64) next['PAN CARD LINK'] = await saveBase64File(filePayloads.pan, 'emp_documents');
  if (filePayloads.bank?.base64) next['BANK PROOF LINK'] = await saveBase64File(filePayloads.bank, 'emp_documents');
  if (filePayloads.education?.base64) next['EDUCATION CERTIFICATE LINK'] = await saveBase64File(filePayloads.education, 'emp_documents');
  if (Array.isArray(filePayloads.bunch) && filePayloads.bunch.length) {
    const links = [];
    for (const file of filePayloads.bunch) {
      if (!file) continue;
      if (file?.base64) {
        links.push(await saveBase64File(file, 'emp_documents'));
      } else if (safe(file)) {
        links.push(safe(file));
      }
    }
    if (links.length) next['Documents of Employee'] = links.join(', ');
  }
  return next;
}

async function syncToLoginUser(row, adminId, portalPassword = '', existingUser = null) {
  const loginId = safe(row['User ID']);
  if (!loginId) return null;
  const users = await listRows('User');
  const existing = existingUser || users.find((user) => safe(first(user, ['Employee ID', 'User ID', 'employeeId', 'userId'])).toLowerCase() === loginId.toLowerCase());
  const syncPayload = {
    ...(existing || {}),
    'Employee ID': loginId,
    'User ID': loginId,
    'Employee Name': row.Name || row['Employee Name'],
    Department: row.Department || first(existing, ['Department', 'department']) || '',
    Role: first(row, ['Role', 'Designation', 'role', 'designation'], first(existing, ['Role', 'role'], 'User')),
    Status: userStatusForEmp(row.Status),
    'Manager ID': first(row, ['Manager ID', 'Manager', 'managerId'], first(existing, ['Manager ID', 'Manager', 'managerId'])),
    'Task Approver': first(row, ['Task Approver', 'Approver', 'taskApprover'], first(existing, ['Task Approver', 'taskApprover'])),
    'Mobile Number': row['Phone No'] || row['Mobile Number'] || first(existing, ['Mobile Number', 'Mobile', 'mobile']) || '',
    Email: row['Official mail id if any'] || row.Email || row['Personal Email ID'] || first(existing, ['Email', 'email']) || ''
  };
  if (portalPassword) syncPayload.Password = portalPassword;
  
  const userIdentifier = existing ? existing._id : null;
  return saveOrUpdateUser(syncPayload, adminId, userIdentifier);
}

export async function getEmpMasterData(category = 'Master', adminRole = '') {
  const targetCategory = normalizeCategory(category);
  const key = cacheKey(targetCategory, adminRole);

  return withEmpMasterCache(key, async () => {
    const [records, users] = await Promise.all([
      listRows('EmpMaster'),
      listRows('User')
    ]);
    const normalized = records.map((row) => normalizeEmpMasterRow(row, row.Category));

    let finalData = [];
    if (targetCategory === 'Inactive') {
      const inactiveMasterRows = normalized
        .filter((row) => empCode(row) && inactiveStatuses.has(safe(row.Status).toLowerCase()))
        .map((row) => ({ ...row, _sourceSheet: row.Category }));

      const existingInactiveIds = new Set(inactiveMasterRows.map((row) => safe(empCode(row)).toLowerCase()));
      const inactiveUserRows = users
        .map(projectUserAsMaster)
        .filter((row) => empCode(row) && inactiveStatuses.has(safe(row.Status).toLowerCase()))
        .filter((row) => !existingInactiveIds.has(safe(empCode(row)).toLowerCase()))
        .map((row) => ({ ...row, _sourceSheet: 'User' }));

      finalData = [...inactiveMasterRows, ...inactiveUserRows];
    } else if (targetCategory === 'Master') {
      const allEmpMasterRows = normalized.filter((row) => empCode(row) && activeRow(row));
      const existingEmpCodes = new Set(allEmpMasterRows.map((row) => safe(empCode(row)).toLowerCase()));

      const legacyUsers = users
        .map(projectUserAsMaster)
        .filter((row) => empCode(row) && activeRow(row) && !existingEmpCodes.has(safe(empCode(row)).toLowerCase()));

      finalData = [...allEmpMasterRows, ...legacyUsers];
    } else {
      finalData = normalized.filter((row) => empCode(row) && row.Category === targetCategory && activeRow(row));
    }

    const role = String(adminRole || '').trim().toLowerCase();
    if (role === 'admin') {
      finalData = finalData.filter(u => String(u.Role || '').trim().toLowerCase() !== 'super admin');
    } else if (role === 'hr' || role === 'hr admin') {
      finalData = finalData.filter(u => String(u.Role || '').trim().toLowerCase() !== 'super admin' && String(u.Role || '').trim().toLowerCase() !== 'admin');
    }

    return ok({ category: targetCategory, data: finalData });
  });
}

export async function getNextEmpCode(category = 'EMP') {
  const targetCategory = normalizeEditableCategory(category);
  if (!targetCategory) {
    return { success: false, message: 'Please choose a valid employee category.' };
  }
  const [records, users] = await Promise.all([
    listRows('EmpMaster'),
    listRows('User')
  ]);
  return nextAvailableCodeFromRows(targetCategory, records, users);
}

export async function saveEmpMasterData(category, formData = {}, filePayloads = {}, adminId = '', actorRole = '') {
  const targetCategory = normalizeEditableCategory(category || formData.Category);
  if (!targetCategory) {
    return { success: false, message: 'Please choose a valid employee category.' };
  }
  const [records, users] = await Promise.all([
    listRows('EmpMaster'),
    listRows('User')
  ]);
  const requestedCode = safe(first(formData, ['EMP Code', 'Employee ID', 'User ID', 'empCode', 'employeeId', 'userId']));
  
  let existingEmp = null;
  let existingUser = null;

  if (formData._id) {
    existingEmp = records.find(r => String(r._id) === String(formData._id));
    existingUser = users.find(u => String(u._id) === String(formData._id));
    
    if (existingEmp && !existingUser) {
       const oldUserId = safe(first(existingEmp, ['User ID', 'Employee ID']));
       existingUser = users.find(u => safe(first(u, ['Employee ID', 'User ID'])) === oldUserId);
    }
  }
  
  if (!existingEmp && !existingUser) {
    existingEmp = records.find((row) => safe(empCode(row)).toLowerCase() === requestedCode.toLowerCase());
    existingUser = users.find((row) => safe(first(row, ['Employee ID', 'User ID'])).toLowerCase() === requestedCode.toLowerCase());
  }

  const existing = existingEmp || existingUser || {};
  const portalPassword = safe(first(formData, ['Password', 'password']));
  const autoGeneratedCode = /^(yes|true|1)$/i.test(safe(first(formData, ['_autoGeneratedEmpCode', 'autoGeneratedEmpCode'])));
  const merged = mergePreservingExisting(existing || {}, formData);
  delete merged.Password;
  delete merged.password;
  delete merged._autoGeneratedEmpCode;
  delete merged.autoGeneratedEmpCode;
  const prepared = await uploadFiles(normalizeEmpMasterRow(merged, targetCategory), filePayloads);
  if (!safe(prepared['EMP Code'])) return { success: false, message: 'EMP Code is required.' };
  if (!safe(prepared['User ID'])) return { success: false, message: 'User ID is required.' };
  if (!safe(prepared.Name)) return { success: false, message: 'Employee name is required.' };
  if (safe(prepared.Email) && !/^\S+@\S+\.\S+$/.test(safe(prepared.Email))) {
    return { success: false, message: 'Please enter a valid employee email address.' };
  }
  if ((existingEmp || existingUser) && !canActorEditRow(actorRole, existingEmp || existingUser)) {
    return { success: false, message: 'HR can not edit Admin or Super Admin employee details.' };
  }
  if (!existingEmp && !existingUser && !canActorEditRow(actorRole, prepared)) {
    return { success: false, message: 'HR can not create Admin or Super Admin employee details.' };
  }
  
  let duplicateEmp = records.find((row) => safe(empCode(row)).toLowerCase() === safe(prepared['EMP Code']).toLowerCase() && String(row._id) !== String(existingEmp?._id));
  let duplicateLogin = records.find((row) => safe(first(row, ['User ID', 'Employee ID', 'userId', 'employeeId'])).toLowerCase() === safe(prepared['User ID']).toLowerCase() && String(row._id) !== String(existingEmp?._id));
  let duplicateUser = users.find((user) => safe(first(user, ['Employee ID', 'User ID', 'employeeId', 'userId'])).toLowerCase() === safe(prepared['User ID']).toLowerCase() && String(user._id) !== String(existingUser?._id));

  if (!existingEmp && !existingUser && autoGeneratedCode && prepared['EMP Code'] === prepared['User ID'] && (duplicateEmp || duplicateLogin || duplicateUser)) {
    const nextCode = nextAvailableCodeFromRows(targetCategory, records, users);
    if (!nextCode.success) return nextCode;
    prepared['EMP Code'] = nextCode.code;
    prepared['Employee ID'] = nextCode.code;
    prepared['User ID'] = nextCode.code;
    duplicateEmp = records.find((row) => safe(empCode(row)).toLowerCase() === safe(prepared['EMP Code']).toLowerCase());
    duplicateLogin = records.find((row) => safe(first(row, ['User ID', 'Employee ID', 'userId', 'employeeId'])).toLowerCase() === safe(prepared['User ID']).toLowerCase());
    duplicateUser = users.find((user) => safe(first(user, ['Employee ID', 'User ID', 'employeeId', 'userId'])).toLowerCase() === safe(prepared['User ID']).toLowerCase());
  }

  if (duplicateEmp) return { success: false, message: `EMP Code ${prepared['EMP Code']} is already used by another employee.` };
  if (duplicateLogin) return { success: false, message: `User ID ${prepared['User ID']} is already assigned to another employee.` };
  if (duplicateUser && !existingEmp && safe(prepared['EMP Code']).toLowerCase() !== safe(prepared['User ID']).toLowerCase()) {
    return { success: false, message: `User ID ${prepared['User ID']} already belongs to another login account.` };
  }
  if (!existingUser && !duplicateUser && !portalPassword) {
    return { success: false, message: 'Portal Password is required when creating a new employee login.' };
  }

  const empMasterIdentifier = existingEmp ? existingEmp._id : prepared['EMP Code'];
  const saved = await upsertRow('EmpMaster', 'EMP Code', empMasterIdentifier, prepared);
  
  const userSync = await syncToLoginUser(saved, adminId, portalPassword, existingUser);
  if (userSync && !userSync.success) return userSync;
  return ok({ message: `Employee ${prepared['EMP Code']} saved successfully.`, item: saved });
}

export async function deleteEmpMasterData(identifier = '', adminId = '', actorRole = '') {
  const targetId = safe(identifier);
  if (!targetId) return { success: false, message: 'Employee ID is required.' };

  const [records, users] = await Promise.all([
    listRows('EmpMaster'),
    listRows('User')
  ]);
  const targetRecord = records.find((row) => safe(empCode(row)).toLowerCase() === targetId.toLowerCase())
    || users.find((row) => safe(first(row, ['Employee ID', 'User ID', 'empCode', 'employeeId', 'userId'])).toLowerCase() === targetId.toLowerCase());

  if (!targetRecord) {
    return { success: false, message: 'Employee record not found.' };
  }
  if (!canActorEditRow(actorRole, targetRecord)) {
    return { success: false, message: 'HR can not edit or delete Admin or Super Admin employee details.' };
  }

  const deletedEmp = await deleteRow('EmpMaster', 'EMP Code', targetId);
  const deletedUser = await deleteRow('User', 'Employee ID', targetId);

  if (!deletedEmp && !deletedUser) {
    return { success: false, message: 'Employee record could not be deleted.' };
  }

  return ok({
    message: `Employee ${targetId} deleted successfully.`,
    item: deletedEmp || deletedUser
  });
}

export function primeEmpMasterCaches(role = '') {
  const normalizedRole = safe(role).toLowerCase();
  if (!['admin', 'super admin', 'hr'].includes(normalizedRole)) return Promise.resolve();
  return Promise.allSettled([
    listRows('EmpMaster'),
    listRows('User'),
    getEmpMasterData('Master', role),
    getEmpMasterData('EMP', role),
    getEmpMasterData('Freelancer', role),
    getEmpMasterData('Intern', role),
    getEmpMasterData('Inactive', role)
  ]);
}

registerStoreMutationListener((modelName = '') => {
  if (!['EmpMaster', 'User'].includes(String(modelName || ''))) return;
  void clearEmpMasterCaches();
});
