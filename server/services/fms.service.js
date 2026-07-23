import { listRows, upsertRow } from './legacyStore.service.js';

const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const employeeIdOf = (row = {}) => first(row, ['Employee ID', 'employeeId', 'User ID', 'EmpID', 'EMP Code']);
const employeeNameOf = (row = {}) => first(row, ['Employee Name', 'employeeName', 'Name', 'Full Name'], employeeIdOf(row));
const roleOf = (row = {}) => first(row, ['Role', 'role', 'Designation'], 'User');
const statusOf = (row = {}) => first(row, ['Status', 'status'], 'Active');
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function buildFmsVisibilityContext(employeeId, users = []) {
  const currentUser = users.find((user) => eq(employeeIdOf(user), employeeId));
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
  const isMyTask = fmsMatchesUser(context.currentUser['Employee ID'], context.currentUser['Employee Name'], task, context.firstNameCount);
  let isTeamTask = false;
  if (['Super Admin', 'HR'].includes(context.role)) {
    isTeamTask = !isMyTask;
  } else if (['Manager', 'Admin'].includes(context.role)) {
    isTeamTask = context.teamMembers.some((member) =>
      fmsMatchesUser(member['Employee ID'], member['Employee Name'], task, context.firstNameCount)
    );
  }
  return {
    canSee: ['Super Admin', 'HR'].includes(context.role) || isMyTask || isTeamTask,
    isMyTask,
    isTeamTask
  };
}

function taskOwnerName(task, users = []) {
  const explicit = first(task, ['Employee Name', 'employeeName', 'User', 'Who', 'Assigned To']);
  if (explicit) return explicit;
  const empId = first(task, ['Employee ID', 'EmpID', 'empId', 'employeeId']);
  const user = users.find((item) => eq(employeeIdOf(item), empId));
  return employeeNameOf(user) || empId || 'Unassigned';
}

function clientName(task, clients = []) {
  const explicit = first(task, ['Client', 'Client Name', 'CustomerName', 'fmsName']);
  if (explicit) return explicit;
  const clientId = first(task, ['Client_Id', 'Client ID', 'CustomerID']);
  const client = clients.find((item) => eq(item.Client_Id, clientId));
  return client?.['Client Name'] || 'Internal / General';
}

function normalizeFmsForDashboard(task, users, clients) {
  const status = first(task, ['Status'], first(task, ['Done Date', 'actualDate']) ? 'Completed' : 'Pending');
  const date = first(task, ['Plan Date', 'Date'], today());
  return {
    ...task,
    ID: first(task, ['Task ID', 'ID', 'rowId']),
    rowId: first(task, ['rowId', 'Task ID', 'ID']),
    Type: 'FMS',
    Client: clientName(task, clients),
    User: taskOwnerName(task, users),
    Status: status,
    Date: normalizedDate(date),
    'Plan Date': first(task, ['Plan Date', 'Date'], today()),
    planDate: first(task, ['planDate', 'Plan Date', 'Date'], today()),
    TAT: first(task, ['TAT', 'When'], '0'),
    Duration: first(task, ['Duration', 'Actual Duration'], '0h 0m'),
    Description: first(task, ['Task Description', 'Description', 'Content']),
    'Employee ID': first(task, ['Employee ID', 'EmpID', 'empId']),
    empId: first(task, ['empId', 'Employee ID', 'EmpID']),
    'Employee Name': first(task, ['Employee Name', 'User', 'who']),
    who: first(task, ['who', 'Employee Name', 'User']),
    'Client Name': first(task, ['Client Name', 'Client', 'fmsName'], clientName(task, clients)),
    fmsName: first(task, ['fmsName', 'Client Name', 'Client'], clientName(task, clients)),
    'Task ID': first(task, ['Task ID', 'ID', 'rowId']),
    taskName: first(task, ['taskName', 'Task Description', 'Description', 'Content']),
    actualDate: first(task, ['actualDate', 'Done Date']),
    'Done Date': first(task, ['Done Date', 'actualDate']),
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
  const context = buildFmsVisibilityContext(employeeId, data.users);
  if (!context.valid) return fail('Access denied: user not found.');
  const items = data.fms
    .map((item) => {
      const row = normalizeFmsForDashboard(item, data.users, data.clients);
      const decision = fmsVisibilityDecision(context, row);
      row._isMyTask = decision.isMyTask;
      row._isTeamTask = decision.isTeamTask;
      row._role = context.role;
      return row;
    })
    .filter((row) => row._isMyTask || row._isTeamTask || ['Super Admin', 'HR'].includes(context.role));
  return ok({ data: items, meta: { role: context.role, teamCount: context.teamMembers.length } });
}

export async function markFmsTaskDone(rowId, remarks, employeeId) {
  const gate = await requireAttendanceActive(employeeId);
  if (gate) return gate;
  const data = await getRows();
  const context = buildFmsVisibilityContext(employeeId, data.users);
  if (!context.valid) return fail('Access denied: user not found.');
  const existing = data.fms
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
    Status: 'Completed',
    'Done Date': actualDate,
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
