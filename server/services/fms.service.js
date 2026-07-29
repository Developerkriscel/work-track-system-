import { insertRow, listRows, upsertRow } from './legacyStore.service.js';

const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const employeeIdOf = (row = {}) => first(row, ['Employee ID', 'employeeId', 'User ID', 'EmpID', 'EMP Code']);
const employeeNameOf = (row = {}) => first(row, ['Employee Name', 'employeeName', 'Name', 'Full Name'], employeeIdOf(row));
const roleOf = (row = {}) => first(row, ['Role', 'role', 'Designation'], 'User');
const statusOf = (row = {}) => first(row, ['Status', 'status'], 'Active');
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const elevatedFmsRoles = ['super admin', 'admin', 'hr', 'manager'];

function looksLikeTempTask(row = {}) {
  const taskId = first(row, ['Task ID', 'ID', 'rowId', 'taskId', 'FMS ID', 'fmsId']);
  const ownerId = first(row, ['Employee ID', 'EmpID', 'empId', 'employeeId', 'EMP Code']);
  const ownerName = first(row, ['Employee Name', 'employeeName', 'Name', 'User', 'who']);
  const description = first(row, ['taskName', 'Task Description', 'Description', 'description', 'Content', 'content']);
  const haystack = `${taskId} ${ownerId} ${ownerName} ${description}`.toLowerCase();
  return /(^|\s)(tmp_|dbg_|debug|verify)(\s|_|$)/i.test(haystack);
}

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function localDate(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function today() {
  return localDate(referenceNow());
}

function nowIso() {
  return referenceNow().toISOString();
}

function normalizedDate(value) {
  if (!value) return today();
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function splitIds(value = '') {
  return safe(value)
    .toLowerCase()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function fmsCreatorAllowed(role) {
  return elevatedFmsRoles.includes(safe(role).toLowerCase());
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeToken(haystack, needle) {
  const text = safe(haystack).toLowerCase();
  const target = safe(needle).toLowerCase();
  if (!text || !target) return false;
  return new RegExp(`(^|[^a-z0-9_])${escapeRegex(target)}([^a-z0-9_]|$)`, 'i').test(text);
}

function fmsMatchesUser(targetId, targetName, task, firstNameCount = {}) {
  const id = safe(targetId).toLowerCase();
  const name = safe(targetName).toLowerCase();
  const who = first(task, ['who', 'Employee Name', 'User']);
  const empId = first(task, ['empId', 'Employee ID', 'EmpID']);
  if (id && eq(empId, id)) return true;
  if (id && hasWholeToken(who, id)) return true;
  if (name && hasWholeToken(who, name)) return true;
  const firstName = name.split(/\s+/)[0];
  return !!(firstName && firstNameCount[firstName] === 1 && hasWholeToken(who, firstName));
}

function buildSyntheticFmsUser(employeeId, tasks = []) {
  const matchedTask = tasks.find((task) => eq(first(task, ['Employee ID', 'employeeId', 'empId', 'EmpID', 'EMP Code']), employeeId));
  if (!matchedTask) return null;
  return {
    'Employee ID': safe(employeeId).toUpperCase(),
    'User ID': safe(employeeId).toUpperCase(),
    'Employee Name': first(matchedTask, ['Employee Name', 'employeeName', 'who', 'User', 'Assigned To'], safe(employeeId).toUpperCase()),
    Name: first(matchedTask, ['Employee Name', 'employeeName', 'who', 'User', 'Assigned To'], safe(employeeId).toUpperCase()),
    Role: 'User',
    Status: 'Active',
    Department: first(matchedTask, ['Department', 'department'], '')
  };
}

function buildFmsVisibilityContext(employeeId, users = [], tasks = []) {
  const currentUser = users.find((user) => eq(employeeIdOf(user), employeeId)) || buildSyntheticFmsUser(employeeId, tasks);
  if (!currentUser) return { valid: false, role: 'User', teamMembers: [], firstNameCount: {}, currentUser: null };
  const firstNameCount = {};
  users.forEach((user) => {
    if (!eq(statusOf(user), 'Active')) return;
    const firstName = safe(employeeNameOf(user)).toLowerCase().split(/\s+/)[0];
    if (firstName) firstNameCount[firstName] = (firstNameCount[firstName] || 0) + 1;
  });
  const currentId = safe(employeeIdOf(currentUser)).toLowerCase();
  const teamMembers = users.filter((user) => {
    if (!eq(statusOf(user), 'Active')) return false;
    if (eq(employeeIdOf(user), currentId)) return false;
    return splitIds(first(user, ['Manager ID', 'managerId', 'Manager', 'manager'])).includes(currentId) ||
      splitIds(first(user, ['Task Approver', 'taskApprover'])).includes(currentId);
  });
  return {
    valid: true,
    currentUser,
    role: roleOf(currentUser),
    teamMembers,
    firstNameCount
  };
}

function fmsVisibilityDecision(context, task) {
  if (!context.valid) return { canSee: false, isMyTask: false, isTeamTask: false };
  const isMyTask = fmsMatchesUser(employeeIdOf(context.currentUser), employeeNameOf(context.currentUser), task, context.firstNameCount);
  let isTeamTask = false;
  if (['Super Admin', 'HR'].includes(context.role)) {
    isTeamTask = !isMyTask;
  } else if (['Manager', 'Admin'].includes(context.role)) {
    isTeamTask = context.teamMembers.some((member) =>
      fmsMatchesUser(employeeIdOf(member), employeeNameOf(member), task, context.firstNameCount)
    );
  }
  return {
    canSee: ['Super Admin', 'HR'].includes(context.role) || isMyTask || isTeamTask,
    isMyTask,
    isTeamTask
  };
}

function directTeamMembersFor(employeeId, users = []) {
  const currentId = safe(employeeId).toLowerCase();
  return users.filter((user) => {
    if (!eq(statusOf(user), 'Active')) return false;
    if (eq(employeeIdOf(user), currentId)) return false;
    return splitIds(first(user, ['Manager ID', 'managerId', 'Manager', 'manager'])).includes(currentId);
  });
}

function assignableUsersFor(employeeId, role, users = []) {
  const normalizedRole = safe(role).toLowerCase();
  const activeUsers = users.filter((user) => eq(statusOf(user), 'Active'));
  let pool = [];

  if (normalizedRole === 'super admin' || normalizedRole === 'hr') {
    pool = activeUsers;
  } else if (normalizedRole === 'admin' || normalizedRole === 'manager') {
    const allowedIds = new Set([
      safe(employeeId).toLowerCase(),
      ...directTeamMembersFor(employeeId, activeUsers).map((member) => employeeIdOf(member).toLowerCase())
    ]);
    pool = activeUsers.filter((user) => allowedIds.has(employeeIdOf(user).toLowerCase()));
  } else if (safe(employeeId)) {
    const current = activeUsers.find((user) => eq(employeeIdOf(user), employeeId));
    pool = current ? [current] : [];
  }

  const seen = new Set();
  return pool
    .map((user) => {
      const id = employeeIdOf(user);
      return {
        id,
        name: employeeNameOf(user),
        role: roleOf(user),
        department: first(user, ['Department', 'department'], ''),
        status: statusOf(user),
        label: employeeNameOf(user) && employeeNameOf(user) !== id ? `${employeeNameOf(user)} (${id})` : id
      };
    })
    .filter((user) => {
      const key = safe(user.id).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftCurrent = safe(left.id).toLowerCase() === safe(employeeId).toLowerCase();
      const rightCurrent = safe(right.id).toLowerCase() === safe(employeeId).toLowerCase();
      if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;
      return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    });
}

function normalizeFmsCreatePayload(payload = {}) {
  const assigneeId = first(payload, ['Employee ID', 'employeeId', 'Assignee ID', 'assigneeId', 'Assign To'], '');
  const fmsName = first(payload, ['FMS Name', 'fmsName', 'Client Name', 'Client', 'Project'], 'General');
  const taskName = first(payload, ['Task Name', 'taskName', 'Task', 'Description', 'Task Description'], '');
  const taskDescription = first(payload, ['Task Description', 'description', 'Description', 'Task'], taskName);
  const planDate = normalizedDate(first(payload, ['Plan Date', 'planDate', 'Date'], today()));
  const tatMinutes = String(Math.max(0, Number(first(payload, ['TAT', 'tatMinutes', 'When'], 0)) || 0));
  return {
    assigneeId,
    fmsName,
    taskName,
    taskDescription,
    planDate,
    tatMinutes,
    what: first(payload, ['What', 'what', 'Task Category', 'Category', 'Department'], ''),
    how: first(payload, ['How', 'how'], ''),
    stepNo: first(payload, ['Step No', 'stepNo', 'Step'], ''),
    formLink: first(payload, ['Form Link', 'formLink'], ''),
    remarks: first(payload, ['Remarks', 'remarks'], '')
  };
}

function taskOwnerName(task, users = []) {
  const explicit = first(task, ['Employee Name', 'employeeName', 'User', 'Who', 'who', 'Assigned To', 'assignedTo']);
  if (explicit) return explicit;
  const empId = first(task, ['Employee ID', 'EmpID', 'empId', 'employeeId', 'EMP Code']);
  const user = users.find((item) => eq(employeeIdOf(item), empId));
  return employeeNameOf(user) || empId || 'Unassigned';
}

function clientName(task, clients = []) {
  const explicit = first(task, ['Client', 'Client Name', 'CustomerName', 'fmsName', 'clientName']);
  if (explicit) return explicit;
  const clientId = first(task, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const client = clients.find((item) => eq(first(item, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']), clientId));
  return client?.['Client Name'] || 'Internal / General';
}

function normalizeFmsForDashboard(task, users, clients) {
  const status = first(task, ['Status', 'status'], first(task, ['Done Date', 'doneDate', 'actualDate']) ? 'Completed' : 'Pending');
  const date = first(task, ['Plan Date', 'planDate', 'Date', 'date'], today());
  const taskId = first(task, ['Task ID', 'ID', 'rowId', 'taskId', 'FMS ID', 'fmsId']);
  const ownerId = first(task, ['Employee ID', 'EmpID', 'empId', 'employeeId', 'EMP Code']);
  const ownerName = taskOwnerName(task, users);
  const resolvedClientName = clientName(task, clients);
  const description = first(task, ['taskName', 'Task Description', 'Description', 'description', 'Content', 'content']);
  const doneDateRaw = first(task, ['Done Date', 'doneDate', 'actualDate']);
  const planDate = normalizedDate(date);
  const doneDate = safe(doneDateRaw) ? normalizedDate(doneDateRaw) : '';
  return {
    ...task,
    ID: taskId,
    rowId: first(task, ['rowId', 'Task ID', 'ID', 'taskId', 'FMS ID', 'fmsId'], taskId),
    Type: 'FMS',
    Client: resolvedClientName,
    User: ownerName,
    Status: status,
    status,
    Date: planDate,
    date: planDate,
    'Plan Date': planDate,
    planDate,
    TAT: first(task, ['TAT', 'When', 'tatMinutes'], '0'),
    tatMinutes: first(task, ['tatMinutes', 'TAT', 'When'], '0'),
    Duration: first(task, ['Duration', 'Actual Duration', 'duration'], '0h 0m'),
    duration: first(task, ['duration', 'Duration', 'Actual Duration'], '0h 0m'),
    Description: description,
    description,
    'Employee ID': ownerId,
    empId: ownerId,
    employeeId: ownerId,
    'Employee Name': ownerName,
    employeeName: ownerName,
    who: first(task, ['who', 'Who', 'Employee Name', 'employeeName', 'User', 'Assigned To', 'assignedTo'], ownerName),
    what: first(task, ['what', 'What', 'Department', 'department'], ''),
    when: first(task, ['when', 'When', 'TAT', 'tatMinutes'], ''),
    how: first(task, ['how', 'How', 'Channel', 'channel'], ''),
    'Client Name': first(task, ['Client Name', 'Client', 'fmsName', 'clientName'], resolvedClientName),
    fmsName: first(task, ['fmsName', 'Client Name', 'Client', 'clientName'], resolvedClientName),
    clientId: first(task, ['clientId', 'Client_Id', 'Client ID', 'CustomerID'], ''),
    'Task ID': taskId,
    taskId,
    taskName: description,
    stepNo: first(task, ['stepNo', 'Step', 'Step No'], ''),
    actualDate: doneDate,
    doneDate,
    'Done Date': doneDate,
    formLink: first(task, ['formLink', 'Form Link', 'Form link'], '')
  };
}

function attendanceEventTime(row) {
  const date = normalizedDate(first(row, ['Date'], today()));
  const time = first(row, ['Time', 'Punch In', 'Punch Out']);
  const parsed = new Date(time || date);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(String(time || date))) return parsed.getTime();
  return new Date(`${date}T00:00:00+05:30`).getTime();
}

function isAttendanceActive(rowsList, employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return true;
  const todayRows = rowsList
    .filter((row) => eq(row['Employee ID'] || row.EmpID, employeeId) && normalizedDate(row.Date) === today())
    .sort((left, right) => attendanceEventTime(right) - attendanceEventTime(left));
  const latest = todayRows[0];
  if (!latest) return false;
  const action = safe(latest.Action);
  if (/punch\s*out/i.test(action)) return false;
  if (/punch\s*in/i.test(action)) return true;
  return !!first(latest, ['Punch In', 'Time']) && !first(latest, ['Punch Out']);
}

async function requireAttendanceActive(employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return null;
  const attendance = await listRows('Attendance');
  if (isAttendanceActive(attendance, employeeId)) return null;
  return fail('Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!');
}

async function getRows() {
  const [users, clients, fms] = await Promise.all([listRows('User'), listRows('Client'), listRows('FmsTask')]);
  return { users, clients, fms };
}

export async function getFmsTasks(employeeId) {
  const data = await getRows();
  const liveFmsRows = data.fms.filter((item) => !looksLikeTempTask(item));
  const context = buildFmsVisibilityContext(employeeId, data.users, liveFmsRows);
  if (!context.valid) return fail('Access denied: user not found.');
  const items = liveFmsRows
    .map((item) => {
      const row = normalizeFmsForDashboard(item, data.users, data.clients);
      const decision = fmsVisibilityDecision(context, row);
      row._isMyTask = decision.isMyTask;
      row._isTeamTask = decision.isTeamTask;
      row._canSee = decision.canSee;
      row._role = context.role;
      return row;
    })
    .filter((row) => row._canSee);
  return ok({ data: items, meta: { role: context.role, teamCount: context.teamMembers.length, canCreate: fmsCreatorAllowed(context.role) } });
}

export async function getFmsAssignableUsers(employeeId) {
  const data = await getRows();
  const liveFmsRows = data.fms.filter((item) => !looksLikeTempTask(item));
  const context = buildFmsVisibilityContext(employeeId, data.users, liveFmsRows);
  if (!context.valid) return fail('Access denied: user not found.');
  if (!fmsCreatorAllowed(context.role)) {
    return fail('Access denied: only Admin, HR, Manager, and Super Admin can create FMS tasks.');
  }
  return ok({
    data: assignableUsersFor(employeeId, context.role, data.users),
    meta: { role: context.role, teamCount: context.teamMembers.length, canCreate: true }
  });
}

export async function createFmsTask(payload = {}, employeeId) {
  const data = await getRows();
  const liveFmsRows = data.fms.filter((item) => !looksLikeTempTask(item));
  const context = buildFmsVisibilityContext(employeeId, data.users, liveFmsRows);
  if (!context.valid) return fail('Access denied: user not found.');
  if (!fmsCreatorAllowed(context.role)) {
    return fail('Access denied: only Admin, HR, Manager, and Super Admin can create FMS tasks.');
  }

  const form = normalizeFmsCreatePayload(payload);
  const assignableUsers = assignableUsersFor(employeeId, context.role, data.users);
  const assignee = assignableUsers.find((user) => eq(user.id, form.assigneeId)) || assignableUsers[0];
  if (!assignee) return fail('Assign To is required.');
  if (!form.taskName) return fail('Task Name is required.');
  if (!form.taskDescription) return fail('Task Description is required.');

  const taskId = `FMS_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const creator = context.currentUser;
  const row = await insertRow('FmsTask', {
    'Task ID': taskId,
    ID: taskId,
    rowId: taskId,
    'Employee ID': assignee.id,
    empId: assignee.id,
    employeeId: assignee.id,
    'Employee Name': assignee.name,
    employeeName: assignee.name,
    User: assignee.name,
    who: assignee.name,
    'Client_Id': '',
    'Client ID': '',
    Client: form.fmsName,
    'Client Name': form.fmsName,
    clientName: form.fmsName,
    fmsName: form.fmsName,
    what: form.what,
    when: form.tatMinutes,
    how: form.how,
    stepNo: form.stepNo,
    'Task Name': form.taskName,
    taskName: form.taskName,
    'Task Description': form.taskDescription,
    Description: form.taskDescription,
    description: form.taskDescription,
    'Plan Date': form.planDate,
    Date: form.planDate,
    planDate: form.planDate,
    TAT: form.tatMinutes,
    tatMinutes: form.tatMinutes,
    Status: 'Pending',
    status: 'Pending',
    'Done Date': '',
    doneDate: '',
    actualDate: '',
    Remarks: form.remarks,
    remarks: form.remarks,
    'Form Link': form.formLink,
    formLink: form.formLink,
    'Created By': employeeId,
    createdBy: employeeId,
    'Created By Name': employeeNameOf(creator),
    createdByName: employeeNameOf(creator),
    'Created At': nowIso(),
    createdAt: nowIso(),
    'Last Update Date': nowIso(),
    'Latest Update Date': nowIso(),
    lastUpdateDate: nowIso(),
    'On Time Status': 'Pending',
    onTimeStatus: 'Pending',
    'Delay Days': 0,
    delayDays: 0
  });

  return ok({ message: 'FMS task created.', item: row });
}

export async function markFmsTaskDone(rowId, remarks, employeeId) {
  const gate = await requireAttendanceActive(employeeId);
  if (gate) return gate;
  const data = await getRows();
  const liveFmsRows = data.fms.filter((item) => !looksLikeTempTask(item));
  const context = buildFmsVisibilityContext(employeeId, data.users, liveFmsRows);
  if (!context.valid) return fail('Access denied: user not found.');
  const existing = liveFmsRows
    .map((item) => normalizeFmsForDashboard(item, data.users, data.clients))
    .find((item) => eq(item['Task ID'] || item.ID || item.rowId, rowId));
  if (!existing) return fail('FMS task not found.');
  const decision = fmsVisibilityDecision(context, existing);
  if (!decision.canSee) return fail('Access denied: this FMS task is not assigned to you or your hierarchy.');
  if (!decision.isMyTask) return fail('View only: manager/team FMS tasks can be viewed, but only assigned user can complete them.');
  if (first(existing, ['Done Date', 'actualDate'])) return fail('Task is already completed.');

  const planDate = normalizedDate(first(existing, ['Plan Date', 'Date'], today()));
  const actualDate = today();
  const delayDays = Math.max(
    0,
    Math.ceil(
      (new Date(`${actualDate}T00:00:00+05:30`) - new Date(`${planDate}T00:00:00+05:30`)) / (24 * 60 * 60 * 1000)
    )
  );
  const row = await upsertRow('FmsTask', 'Task ID', rowId, {
    'Task ID': rowId,
    taskId: rowId,
    Status: 'Completed',
    status: 'Completed',
    'Done Date': actualDate,
    doneDate: actualDate,
    'Last Update Date': nowIso(),
    actualDate,
    'Delay Days': delayDays,
    delayDays,
    'On Time Status': delayDays > 0 ? 'Late' : 'On Time',
    onTimeStatus: delayDays > 0 ? 'Late' : 'On Time',
    Remarks: remarks || '',
    'Completed By': employeeId
  });
  return ok({ message: 'FMS task completed.', item: row });
}
