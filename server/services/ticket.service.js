import { insertRow, listRows, upsertRow } from './legacyStore.service.js';
import { saveBase64File } from './fileStorage.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const splitIds = (value) => safe(value).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
const userId = (user = {}) => first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
const userRole = (user = {}) => safe(first(user, ['Role', 'role', 'Designation'], 'User')).toLowerCase();

function teamIds(employeeId, users = []) {
  const currentId = safe(employeeId).toLowerCase();
  return users
    .filter((user) => splitIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'])).includes(currentId) ||
      splitIds(first(user, ['Task Approver', 'taskApprover'])).includes(currentId))
    .map((user) => userId(user).toLowerCase())
    .filter(Boolean);
}

function directTeamIds(employeeId, users = []) {
  const currentId = safe(employeeId).toLowerCase();
  return users
    .filter((user) => splitIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'])).includes(currentId))
    .map((user) => userId(user).toLowerCase())
    .filter(Boolean);
}

function canSeeTicket(ticket, employeeId, role, users = []) {
  const currentId = safe(employeeId).toLowerCase();
  const ownerId = first(ticket, ['Employee ID', 'EmpID', 'employeeId']).toLowerCase();
  const reassignedBy = first(ticket, ['Reassigned By', 'reassignedBy']).toLowerCase();
  const normalizedRole = safe(role).toLowerCase();
  if (normalizedRole === 'super admin') return true;
  if (ownerId === currentId || reassignedBy === currentId) return true;
  if (normalizedRole === 'admin' || normalizedRole === 'manager') return teamIds(employeeId, users).includes(ownerId);
  if (normalizedRole === 'hr') {
    const owner = users.find((user) => userId(user).toLowerCase() === ownerId);
    const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
    return teamIds(employeeId, users).includes(ownerId) || ownerDepartment === 'hr' || ownerDepartment.includes('human resource');
  }
  return false;
}

function isClientOriginTicket(ticket = {}) {
  const remarks = safe(first(ticket, ['Remarks', 'remarks']));
  const source = safe(first(ticket, ['Source', 'source', 'Ticket Source', 'ticketSource']));
  const origin = safe(first(ticket, ['Origin', 'origin']));
  const clientTicketFlag = safe(first(ticket, ['Client Ticket', 'clientTicket', 'Is Client Ticket', 'isClientTicket']));
  const normalizedRemarks = remarks.toLowerCase();
  const normalizedSource = source.toLowerCase();
  const normalizedOrigin = origin.toLowerCase();
  const normalizedClientTicketFlag = clientTicketFlag.toLowerCase();
  return normalizedOrigin === 'client'
    || normalizedClientTicketFlag === 'yes'
    || normalizedClientTicketFlag === 'true'
    || normalizedSource.includes('client portal')
    || normalizedSource === 'client'
    || normalizedRemarks.includes('created from client portal')
    || normalizedRemarks.includes('created from mern client portal');
}

function assignableIdsFor(employeeId, role, users = []) {
  const normalizedRole = safe(role).toLowerCase();
  const activeUsers = users.filter((user) => eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
  if (normalizedRole === 'super admin') return activeUsers.map((user) => userId(user).toLowerCase()).filter(Boolean);
  if (normalizedRole === 'hr') return activeUsers.map((user) => userId(user).toLowerCase()).filter(Boolean);
  if (normalizedRole === 'admin' || normalizedRole === 'manager' || normalizedRole === 'user') {
    return [safe(employeeId).toLowerCase(), ...directTeamIds(employeeId, activeUsers)];
  }
  return [safe(employeeId).toLowerCase()];
}

async function getTicketScope(ticketId, employeeId, role) {
  const data = await getRows();
  const ticket = data.tickets.find((item) => eq(first(item, ['Ticket ID', 'ID']), ticketId));
  if (!ticket) return { error: fail('Ticket not found.') };
  if (!canSeeTicket(ticket, employeeId, role, data.users)) return { error: fail('Access denied for this ticket.') };
  return { data, ticket };
}

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

function localTimeHms(date = referenceNow()) {
  return date.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function isClosedStatus(status = '') {
  const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
  return closedTerms.some((term) => String(status).toLowerCase().includes(term));
}

function normalizedDate(value) {
  if (!value) return today();
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function timestampForAttendance(dateValue, timeValue, action = 'Punch In') {
  const date = normalizedDate(dateValue);
  const raw = safe(timeValue);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)) return parsed.toISOString();
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridian = match[4]?.toLowerCase();
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  if (!meridian && /out/i.test(action) && hour > 0 && hour < 9) hour += 12;
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+05:30`).toISOString();
}

function attendanceEventTime(row) {
  const date = normalizedDate(first(row, ['Date'], today()));
  const time = first(row, ['Time', 'Punch In', 'Punch Out']);
  const parsed = new Date(time || date);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(String(time || date))) return parsed.getTime();
  const timestamp = timestampForAttendance(date, time || '00:00', row.Action || '');
  const fromTimestamp = new Date(timestamp).getTime();
  return Number.isNaN(fromTimestamp) ? new Date(`${date}T00:00:00+05:30`).getTime() : fromTimestamp;
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

function durationToMinutes(value) {
  const raw = safe(value);
  if (!raw || raw === '-') return 0;
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minutes = raw.match(/(\d+(?:\.\d+)?)\s*m/i);
  if (hours || minutes) return Math.round(num(hours?.[1]) * 60 + num(minutes?.[1]));
  const colon = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  return num(raw);
}

function minutesLabel(minutes) {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function parseTicketStartTime(value, referenceDate = referenceNow()) {
  const raw = safe(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)) return parsed;
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridian = match[4]?.toLowerCase();
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  const start = new Date(referenceDate);
  start.setHours(hour, minute, second, 0);
  if (start > referenceDate) start.setDate(start.getDate() - 1);
  return start;
}

function addTicketSessionDuration(existingDuration, startTime, endTime = referenceNow()) {
  const start = parseTicketStartTime(startTime, endTime);
  const sessionMins = start ? Math.max(0, Math.round((endTime - start) / 60000)) : 0;
  const totalMins = durationToMinutes(existingDuration) + sessionMins;
  return { sessionMins, totalStr: minutesLabel(totalMins) };
}

function asTicketRow(row = {}, clients = []) {
  const ticketId = first(row, ['Ticket ID', 'Task ID', 'ID', 'ticketId', 'taskId']);
  const clientId = first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const clientNameFromMaster =
    clients.find((item) => eq(item.Client_Id || item['Client ID'], clientId))?.['Client Name'] || '';
  const client = first(row, ['Name', 'Client Name', 'Client', 'clientName'], clientNameFromMaster);
  const employeeId = first(row, ['Employee ID', 'EmpID', 'employeeId']);
  const employeeName = first(row, ['Employee Name', 'User', 'employeeName', 'name'], employeeId);
  const description = first(row, ['Task Description', 'Description', 'description']);
  const planDate = first(row, ['Plan Date', 'Date', 'planDate', 'timestamp']);
  const timestamp = first(row, ['Timestamp', 'timestamp', 'Created At', 'Date'], planDate);
  const totalDuration = first(row, ['Total Duration', 'Duration', 'totalDuration', 'duration']);
  return {
    ...row,
    'Ticket ID': ticketId,
    ID: first(row, ['ID', 'Ticket ID', 'ticketId'], ticketId),
    Client_Id: clientId,
    'Client ID': first(row, ['Client ID', 'Client_Id', 'clientId'], clientId),
    Client: client,
    Name: client,
    'Client Name': client,
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': employeeName,
    User: employeeName,
    'Task Category': first(row, ['Task Category', 'Category', 'category'], 'General'),
    Category: first(row, ['Category', 'Task Category', 'category'], 'General'),
    Priority: first(row, ['Priority', 'priority'], 'Normal'),
    'Task Description': description,
    Description: description,
    Status: first(row, ['Status', 'status'], 'Open'),
    Timestamp: timestamp,
    Date: first(row, ['Date', 'Plan Date', 'planDate', 'timestamp'], planDate),
    'Plan Date': planDate,
    'Last Update Date': first(row, ['Last Update Date', 'lastUpdateDate', 'Timestamp', 'timestamp'], timestamp),
    'Start Time': first(row, ['Start Time', 'startTime']),
    'End Time': first(row, ['End Time', 'endTime']),
    'Total Duration': totalDuration,
    Duration: totalDuration,
    Remarks: first(row, ['Remarks', 'remarks']),
    TAT: first(row, ['TAT', 'When', 'tatMinutes']),
    When: first(row, ['When', 'TAT', 'tatMinutes']),
    'Task Approver': first(row, ['Task Approver', 'taskApprover', 'Approver ID']),
    'Reassigned By': first(row, ['Reassigned By', 'reassignedBy']),
    _isClientOrigin: isClientOriginTicket(row)
  };
}

function asClientRow(row = {}) {
  const clientId = first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId', 'customerId']);
  const clientName = first(row, ['Client Name', 'CustomerName', 'Name', 'clientName', 'name'], clientId);
  const normalized = {
    ...row,
    Client_Id: clientId,
    'Client ID': first(row, ['Client ID', 'Client_Id', 'CustomerID', 'clientId'], clientId),
    CustomerID: first(row, ['CustomerID', 'Client_Id', 'Client ID', 'clientId'], clientId),
    'Client Name': clientName,
    CustomerName: first(row, ['CustomerName', 'Client Name', 'Name', 'clientName', 'name'], clientName),
    Name: clientName
  };
  delete normalized.Password;
  delete normalized.password;
  return normalized;
}

function asUserRow(row = {}) {
  const employeeId = userId(row);
  const employeeName = first(row, ['Employee Name', 'Name', 'Full Name', 'employeeName', 'name'], employeeId);
  const normalized = {
    ...row,
    'Employee ID': employeeId,
    'User ID': first(row, ['User ID', 'Employee ID', 'EMP Code', 'employeeId'], employeeId),
    'Employee Name': employeeName,
    Name: employeeName,
    Role: first(row, ['Role', 'role', 'Designation'], 'User'),
    Status: first(row, ['Status', 'status'], 'Active'),
    'Manager ID': first(row, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'], ''),
    'Task Approver': first(row, ['Task Approver', 'taskApprover', 'Approver ID'], '')
  };
  delete normalized.Password;
  delete normalized.password;
  return normalized;
}

async function getRows() {
  const [tickets, clients, users, leaves, intimations, empMasters] = await Promise.all([
    listRows('Ticket'), 
    listRows('Client'), 
    listRows('User'),
    listRows('Leave'),
    listRows('Intimation'),
    listRows('EmpMaster')
  ]);
  
  const mergedUsers = users.map(user => {
    const empData = empMasters.find(e => {
      const uId = first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
      const eId = first(e, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
      return safe(uId).toLowerCase() === safe(eId).toLowerCase();
    });
    return { ...user, ...(empData || {}) };
  });

  return { 
    tickets, 
    clients: clients.map(asClientRow), 
    users: mergedUsers.map(asUserRow),
    leaves,
    intimations
  };
}

async function saveTicket(row) {
  return upsertRow('Ticket', 'Ticket ID', row['Ticket ID'], row);
}

export async function getTicketSystemData(employeeId, role) {
  const data = await getRows();
  const tickets = data.tickets.filter((ticket) => canSeeTicket(ticket, employeeId, role, data.users));
  const categories = [...new Set([
    'Google Sheet', 'Digital Marketing', 'Recruitment', 'Graphic Design', 'Development',
    ...data.tickets.map((ticket) => first(ticket, ['Task Category', 'Category']))
  ].filter(Boolean))];
  const clientMap = new Map(data.clients.map((client) => {
    const id = first(client, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
    return [safe(id).toLowerCase(), client];
  }));
  data.tickets.forEach((ticket) => {
    const id = first(ticket, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
    if (!safe(id) || clientMap.has(safe(id).toLowerCase())) return;
    const name = first(ticket, ['Name', 'Client Name', 'Client', 'clientName'], id);
    clientMap.set(safe(id).toLowerCase(), { 'Client_Id': id, 'Client ID': id, 'Client Name': name, Services: '' });
  });
  const clients = [...clientMap.values()];
  const activeUsers = data.users.filter((user) => eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
  const allowedAssigneeIds = assignableIdsFor(employeeId, role, activeUsers);
  const assignableUsers = activeUsers.filter((user) => allowedAssigneeIds.includes(userId(user).toLowerCase()));
  const dropdowns = {
    clients,
    categories,
    users: assignableUsers,
    allUsers: activeUsers
  };
  const normalizedRole = safe(role).toLowerCase();
  const elevated = ['super admin', 'admin', 'manager', 'hr'].includes(normalizedRole);
  const clientOriginScope = elevated
    ? data.tickets.filter((ticket) => isClientOriginTicket(ticket))
    : tickets.filter((ticket) => isClientOriginTicket(ticket));
  const ownerFor = (ticket) => data.users.find((user) => eq(userId(user), first(ticket, ['Employee ID', 'EmpID', 'employeeId'])));
  const approvalFor = (ticket) => {
    const owner = ownerFor(ticket);
    const reassignedTo = first(ticket, ['Reassigned To', 'reassignedTo']);
    const approver = reassignedTo || first(owner, ['Task Approver', 'Manager ID', 'Manager']);
    return safe(approver).split(',')[0].trim();
  };
  const visibleTickets = tickets.map((ticket) => {
    const row = asTicketRow(ticket, data.clients);
    const isPending = eq(row.Status, 'Pending Approval');
    const isOwner = eq(row['Employee ID'], employeeId);
    const designated = eq(approvalFor(ticket), employeeId);
    const owner = ownerFor(ticket);
    const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
    const superAdminAction = normalizedRole === 'super admin' && !isOwner;
    const hrAction = normalizedRole === 'hr' && (ownerDepartment === 'hr' || ownerDepartment.includes('human resource'));
    const actionable = isPending && !isOwner && (superAdminAction || designated || hrAction);
    return {
      ...row,
      _canApprove: actionable,
      _isActionableByMe: actionable,
      _canTransferApproval: actionable,
      _canSeeTeam: elevated
    };
  });
  const clientOriginTickets = clientOriginScope.map((ticket) => {
    const row = asTicketRow(ticket, data.clients);
    const isPending = eq(row.Status, 'Pending Approval');
    const isOwner = eq(row['Employee ID'], employeeId);
    const designated = eq(approvalFor(ticket), employeeId);
    const owner = ownerFor(ticket);
    const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
    const superAdminAction = normalizedRole === 'super admin' && !isOwner;
    const hrAction = normalizedRole === 'hr' && (ownerDepartment === 'hr' || ownerDepartment.includes('human resource'));
    const actionable = isPending && !isOwner && (superAdminAction || designated || hrAction);
    return {
      ...row,
      _canApprove: actionable,
      _isActionableByMe: actionable,
      _canTransferApproval: actionable,
      _canSeeTeam: elevated
    };
  });
  const todayDate = new Date().toISOString().split('T')[0];
  const isApprovedStatus = (status) => ['approved', 'approve', 'accepted'].includes(String(status || '').toLowerCase().trim());
  const onLeaveUserIds = new Set();
  
  function normalizedDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    const parts = String(dateStr).split(/[-/]/);
    if (parts.length === 3) {
      const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
    }
    return '';
  }

  (data.leaves || []).forEach(row => {
    const status = first(row, ['Status', 'status', 'Approval Status']);
    if (isApprovedStatus(status)) {
      const start = normalizedDate(first(row, ['Start Date', 'StartDate', 'Date', 'date']));
      const end = normalizedDate(first(row, ['End Date', 'EndDate', 'Start Date', 'StartDate', 'Date', 'date']));
      if (start && end && start <= todayDate && todayDate <= end) {
        onLeaveUserIds.add(userId(row).toLowerCase());
      }
    }
  });

  (data.intimations || []).forEach(row => {
    const status = first(row, ['Status', 'status', 'Approval Status']);
    if (isApprovedStatus(status)) {
      const date = normalizedDate(first(row, ['Intimation Date', 'Date', 'date']));
      if (date === todayDate) {
        onLeaveUserIds.add(userId(row).toLowerCase());
      }
    }
  });

  const buddyTickets = [];
  data.users.forEach(u => {
    const uId = userId(u).toLowerCase();
    if (!onLeaveUserIds.has(uId)) return;

    const buddyId = String(first(u, ['Assign Buddy', 'Buddy', 'assignBuddy']) || '').trim().toLowerCase();
    if (!buddyId) return;

    let canViewBuddy = false;
    const currentEmpId = String(employeeId).toLowerCase();
    if (buddyId === currentEmpId || buddyId.includes(currentEmpId) || buddyId.includes(`(${currentEmpId})`)) {
      canViewBuddy = true;
    } else if (normalizedRole === 'super admin') {
      canViewBuddy = true;
    } else if (normalizedRole === 'manager' || normalizedRole === 'admin' || normalizedRole === 'hr') {
      const managerIds = splitIds(first(u, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
      if (managerIds.includes(currentEmpId) || managerIds.some(m => m.includes(currentEmpId))) {
        canViewBuddy = true;
      }
    }

    if (!canViewBuddy) return;

    const buddyUser = data.users.find(bu => userId(bu).toLowerCase() === buddyId);
    const buddyName = buddyUser ? (first(buddyUser, ['Employee Name', 'Name']) || buddyId) : buddyId;

    const userTickets = data.tickets.filter(t => userId(t).toLowerCase() === uId);
    userTickets.forEach(ticket => {
      const row = asTicketRow(ticket, data.clients);
      buddyTickets.push({
        ...row,
        'Employee Name': `${row['Employee Name'] || row['Employee ID']} (On Leave) ➔ Buddy: ${buddyName}`,
        _isBuddyTicket: true,
        _canApprove: false,
        _isActionableByMe: true,
        _canTransferApproval: false,
        _canSeeTeam: false
      });
    });
  });

  return ok({
    clients,
    users: assignableUsers,
    allUsers: activeUsers,
    employees: assignableUsers,
    tickets: visibleTickets,
    buddyTickets,
    teamTickets: elevated ? visibleTickets : [],
    clientOriginTickets,
    canViewTeamTickets: elevated,
    canViewClientTickets: elevated || clientOriginTickets.length > 0,
    categories,
    dropdowns
  });
}

function approvalDecision(data, ticket, actorId) {
  const actor = data.users.find((user) => eq(userId(user), actorId));
  const owner = data.users.find((user) => eq(userId(user), first(ticket, ['Employee ID', 'EmpID', 'employeeId'])));
  if (!actor || !owner) return { allowed: false, message: 'User details not found.' };
  if (eq(userId(owner), actorId) && userRole(actor) !== 'super admin') return { allowed: false, message: 'You cannot approve your own ticket.' };
  const role = userRole(actor);
  const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
  const reassignedTo = first(ticket, ['Reassigned To', 'reassignedTo']);
  const designated = safe(reassignedTo || first(owner, ['Task Approver', 'Manager ID', 'Manager'])).split(',')[0].trim();
  if (role === 'super admin') {
    return { allowed: true, actor, owner };
  }
  const allowed = eq(designated, actorId) || (role === 'hr' && (ownerDepartment === 'hr' || ownerDepartment.includes('human resource')));
  return allowed ? { allowed: true, actor, owner } : { allowed: false, message: 'You are not the designated approver for this ticket.' };
}

export async function adminTicketAction(ticketId, action, remarks, actorId, role) {
  const scope = await getTicketScope(ticketId, actorId, role);
  if (scope.error) return scope.error;
  const { data, ticket } = scope;
  if (!eq(ticket.Status, 'Pending Approval')) return fail('Only pending approval tickets can be actioned.');
  const decision = approvalDecision(data, ticket, actorId);
  if (!decision.allowed) return fail(decision.message);
  if (!safe(remarks)) return fail('Remarks are required for this action.');
  const actorName = first(decision.actor, ['Employee Name', 'Name'], actorId);
  const now = nowIso();
  const approved = ['approve', 'approved'].includes(safe(action).toLowerCase());
  const nextStatus = approved ? 'Closed' : 'Rework';
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    Status: nextStatus,
    'Last Action By': actorName,
    'Last Update Date': now,
    ...(approved ? { 'Close Date': now, 'Completion Date': now } : {}),
    Remarks: `${ticket.Remarks || ''}${ticket.Remarks ? '\n' : ''}[${actorName} - ${now}]: ${approved ? 'Approve' : 'Rework'} - ${remarks}`
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: actorName,
    ActionType: approved ? 'Approved & Closed' : 'Sent for Rework',
    Remarks: remarks,
    Timestamp: now
  });
  return ok({ message: approved ? 'Ticket approved and closed.' : 'Ticket sent for rework.', item: row });
}

export async function transferTicketApproval(ticketId, targetManagerId, remarks, actorId, role) {
  const scope = await getTicketScope(ticketId, actorId, role);
  if (scope.error) return scope.error;
  const { data, ticket } = scope;
  const decision = approvalDecision(data, ticket, actorId);
  if (!decision.allowed) return fail(decision.message);
  if (!safe(targetManagerId) || !safe(remarks)) return fail('Target approver and remarks are required.');
  const target = data.users.find((user) => eq(userId(user), targetManagerId) && eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
  if (!target) return fail('Target approver not found or inactive.');
  const actorName = first(decision.actor, ['Employee Name', 'Name'], actorId);
  const now = nowIso();
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    'Reassigned To': targetManagerId,
    'Reassigned By': actorId,
    'Last Action By': actorName,
    'Last Update Date': now,
    Remarks: `${ticket.Remarks || ''}${ticket.Remarks ? '\n' : ''}[${actorName} - ${now}]: Approval transferred to ${first(target, ['Employee Name', 'Name'], targetManagerId)} - ${remarks}`
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: actorName,
    ActionType: 'Approval Transferred',
    Remarks: `Transferred to ${targetManagerId}. ${remarks}`,
    Timestamp: now
  });
  return ok({ message: `Approval authority transferred to ${first(target, ['Employee Name', 'Name'], targetManagerId)}.`, item: row });
}

export async function createTicket(ticketData = {}) {
  const creatorId = first(ticketData, ['Creator ID', 'createdBy', 'Created By']);
  if (creatorId) {
    const gate = await requireAttendanceActive(creatorId);
    if (gate) return gate;
  }
  const id = ticketData['Ticket ID'] || ticketData.ID || `TICKET_${Date.now()}`;
  const description = first(ticketData, ['Task Description', 'Description']);
  const data = await getRows();
  const clientId = first(ticketData, ['Client_Id', 'Client ID']);
  const client = data.clients.find((item) => eq(item.Client_Id, clientId) || eq(item['Client ID'], clientId));
  let initialAttachments = '';
  if (Array.isArray(ticketData.Attachment)) {
    const attachmentUrls = [];
    for (const item of ticketData.Attachment) {
      if (!item) continue;
      attachmentUrls.push(item?.base64 ? await saveBase64File(item, 'ticket_attachments') : safe(item));
    }
    initialAttachments = attachmentUrls.filter(Boolean).join(',');
  } else {
    initialAttachments = ticketData.Attachment?.base64
      ? await saveBase64File(ticketData.Attachment, 'ticket_attachments')
      : safe(ticketData.Attachment);
  }
  const row = {
    'Ticket ID': id,
    ID: id,
    Timestamp: nowIso(),
    Status: 'Open',
    ...ticketData,
    Attachment: initialAttachments,
    Client_Id: clientId,
    Name: first(ticketData, ['Name', 'Client Name', 'Client'], client?.['Client Name'] || ''),
    'Client Name': first(ticketData, ['Client Name', 'Client', 'Name'], client?.['Client Name'] || ''),
    'Task Description': description,
    Description: description,
    'Plan Date': first(ticketData, ['Plan Date', 'Date'], today()),
    TAT: first(ticketData, ['TAT', 'When'])
  };
  await saveTicket(row);
  return ok({ message: 'Ticket created.', item: row });
}

export async function createBulkTickets(ticketList = []) {
  if (!Array.isArray(ticketList) || !ticketList.length) return fail('At least one ticket is required.');
  const creatorId = first(ticketList[0], ['Creator ID', 'createdBy', 'Created By']);
  if (creatorId) {
    const gate = await requireAttendanceActive(creatorId);
    if (gate) return gate;
  }
  const created = [];
  for (const ticketData of ticketList) {
    const result = await createTicket(ticketData);
    if (!result.success) return result;
    created.push(result.item);
  }
  return ok({ message: `${created.length} tickets created successfully.`, data: created, items: created });
}

export async function updateTicket(ticketId, updateData = {}) {
  const scope = await getTicketScope(ticketId, updateData.updatedBy || updateData['Updated By'], updateData.role);
  if (scope.error) return scope.error;
  const { data, ticket } = scope;

  const newStatus = updateData.newStatus || updateData.Status;
  const updatedBy = safe(updateData.updatedBy || updateData['Updated By'] || updateData.employeeId || '');
  const actor = data.users.find((user) => eq(user['Employee ID'], updatedBy));
  const actorName = actor?.['Employee Name'] || updatedBy || 'System';
  const now = referenceNow();
  const update = {
    'Ticket ID': ticketId,
    'Last Update Date': now.toISOString(),
    'Last Action By': actorName
  };
  let finalStatus = newStatus || ticket.Status;
  let historyAction = finalStatus || 'Update';
  const systemRemarks = [];
  let closingAttachments = [];
  if (Array.isArray(updateData.attachment)) {
    for (const item of updateData.attachment) {
      if (!item) continue;
      closingAttachments.push(item?.base64 ? await saveBase64File(item, 'ticket_closing_attachments') : safe(item));
    }
  } else if (updateData.attachment?.base64) {
    closingAttachments = [await saveBase64File(updateData.attachment, 'ticket_closing_attachments')];
  } else if (safe(updateData.attachment)) {
    closingAttachments = [safe(updateData.attachment)];
  }
  if (closingAttachments.length) update['Closing Attachment'] = closingAttachments.join(',');

  if (newStatus === 'In Progress') {
    const gate = await requireAttendanceActive(updatedBy);
    if (gate) return gate;
    const runningTicket = data.tickets.find((item) =>
      eq(item['Employee ID'], updatedBy) && safe(item.Status) === 'In Progress' && !eq(item['Ticket ID'], ticketId)
    );
    if (runningTicket) return fail(`Aapka ek ticket already chal raha hai: [ID: ${runningTicket['Ticket ID']}]. Pehle use Pause ya Complete karein!`);
    update.Status = 'In Progress';
    update['Start Time'] = localTimeHms(now);
    finalStatus = 'In Progress';
    systemRemarks.push(`[System]: Work Resumed at ${update['Start Time']}.`);
  } else if (newStatus === 'Paused') {
    const session = addTicketSessionDuration(ticket['Total Duration'], ticket['Start Time'], now);
    update.Status = 'Paused';
    update['Total Duration'] = session.totalStr;
    finalStatus = 'Paused';
    systemRemarks.push(`[System]: Paused. Session: ${session.sessionMins} mins added.`);
  } else if (newStatus === 'Completed') {
    const session = addTicketSessionDuration(ticket['Total Duration'], ticket['Start Time'], now);
    update['Total Duration'] = session.totalStr;
    update['End Time'] = localTimeHms(now);
    update['Actual Date'] = localDate(now);
    const ticketOwner = data.users.find((user) => eq(user['Employee ID'], ticket['Employee ID']));
    const firstApprover =
      safe(ticketOwner?.['Task Approver'] || ticketOwner?.['Manager ID'] || ticketOwner?.Manager)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)[0] || '';
    
    const updater = data.users.find((user) => eq(user['Employee ID'], updatedBy));
    const isSuperAdmin = safe(updater?.Role).toLowerCase() === 'super admin';

    if ((!firstApprover || eq(firstApprover, updatedBy)) && !isSuperAdmin) {
      update.Status = 'Closed';
      update['Close Date'] = now.toISOString();
      finalStatus = 'Closed';
      systemRemarks.push(`[System]: Completed. Final Session: ${session.sessionMins} mins.`);
      systemRemarks.push(firstApprover ? '[System]: Auto-Approved & Closed (Action by Approver).' : '[System]: Auto-Approved & Closed (No Approver assigned).');
    } else {
      update.Status = 'Pending Approval';
      finalStatus = 'Pending Approval';
      systemRemarks.push(`[System]: Completed. Final Session: ${session.sessionMins} mins.`);
    }
  } else if (newStatus) {
    update.Status = newStatus;
  }

  const userRemark = updateData.newRemarks || updateData.Remarks || updateData.remarks || '';
  const remarkParts = [];
  if (userRemark) remarkParts.push(`[${actorName} - ${now.toLocaleString('en-IN')}]: ${userRemark}`);
  if (systemRemarks.length) remarkParts.push(...systemRemarks);
  if (remarkParts.length) update.Remarks = `${ticket.Remarks || ''}${ticket.Remarks ? '\n' : ''}${remarkParts.join('\n')}`;

  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, update);
  if (newStatus || remarkParts.length) {
    await insertRow('TicketHistory', {
      'History ID': `HIST_${Date.now()}`,
      'Ticket ID': ticketId,
      ActionBy: actorName,
      ActionType: historyAction,
      Remarks: remarkParts.join('\n'),
      Timestamp: now.toISOString()
    });
  }
  return ok({ message: 'Ticket updated.', item: row, finalStatus });
}

export async function updateTicketSchedule(ticketId, newTAT, newPlanDate, reason, empId, role) {
  const gate = await requireAttendanceActive(empId);
  if (gate) return gate;
  const scope = await getTicketScope(ticketId, empId, role);
  if (scope.error) return scope.error;
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    TAT: newTAT,
    'Plan Date': newPlanDate,
    Remarks: `[[TAT/Date Updated by ${empId}]] ${reason || ''}`,
    'Last Update Date': nowIso()
  });
  return ok({ message: 'Schedule updated.', item: row });
}

export async function reassignTicket(ticketId, reassignToId, reassignById, remarks = '', role) {
  const gate = await requireAttendanceActive(reassignById);
  if (gate) return gate;
  const scope = await getTicketScope(ticketId, reassignById, role);
  if (scope.error) return scope.error;
  const { data, ticket } = scope;
  const targetId = safe(reassignToId);
  if (targetId.toLowerCase() !== 'client') {
    const target = data.users.find((user) => eq(userId(user), targetId) && eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
    if (!target) return fail('User not found or inactive.');
    if (!assignableIdsFor(reassignById, role, data.users).includes(targetId.toLowerCase())) {
      return fail('You can only reassign tickets to yourself or your permitted team members.');
    }
  }
  const preserveClientOrigin = isClientOriginTicket(ticket)
    ? {
        Source: first(ticket, ['Source', 'source', 'Ticket Source', 'ticketSource'], 'Client Portal'),
        'Ticket Source': first(ticket, ['Ticket Source', 'ticketSource', 'Source', 'source'], 'Client Portal'),
        Origin: first(ticket, ['Origin', 'origin'], 'Client'),
        'Client Ticket': first(ticket, ['Client Ticket', 'clientTicket', 'Is Client Ticket', 'isClientTicket'], 'Yes')
      }
    : {};
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    'Employee ID': safe(reassignToId).toLowerCase() === 'client' ? '' : reassignToId,
    'Reassigned By': reassignById,
    Status: safe(reassignToId).toLowerCase() === 'client' ? 'Pending Client Response' : 'Reassigned',
    Remarks: remarks,
    'Last Update Date': nowIso(),
    ...preserveClientOrigin
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: reassignById,
    ActionType: 'Reassigned',
    Remarks: remarks,
    Timestamp: nowIso()
  });
  return ok({ message: 'Ticket reassigned.', item: row });
}

export async function processClientResponse(ticketId, clientResponse, newPlanDate, attachment, employeeId, role) {
  const scope = await getTicketScope(ticketId, employeeId, role);
  if (scope.error) return scope.error;
  const { ticket } = scope;
  const attachmentUrl = attachment?.base64 ? await saveBase64File(attachment, 'client_responses') : safe(attachment);
  const originalAssignee = first(ticket, ['Reassigned By', 'Employee ID', 'employeeId']);
  const remark = `\n\n[[Client Responded on ${new Date().toLocaleString('en-IN')}]]\n${clientResponse || ''}${attachmentUrl ? `\nAttachment: ${attachmentUrl}` : ''}`;
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    Status: 'Client Responded',
    'Employee ID': originalAssignee,
    'Last Action By': 'Client',
    'Plan Date': newPlanDate || '',
    Remarks: `${ticket.Remarks || ''}${remark}`,
    'Closing Attachment': attachmentUrl || first(ticket, ['Closing Attachment']),
    HasUnreadAdminMessages: true,
    'Last Update Date': nowIso()
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: 'Client',
    ActionType: 'Client Response',
    Remarks: clientResponse || '',
    Attachment: attachmentUrl,
    Timestamp: nowIso()
  });
  return ok({ message: 'Client response processed.', item: row });
}

export async function getTaskMessages(taskId, employeeId, role) {
  const scope = await getTicketScope(taskId, employeeId, role);
  if (scope.error) return scope.error;
  const messages = (await listRows('Message'))
    .filter((message) => eq(message.TaskID, taskId))
    .sort((left, right) => (Date.parse(left.Timestamp) || 0) - (Date.parse(right.Timestamp) || 0));
  return ok({ data: messages, messages });
}

export async function postTaskMessage(taskId, messageText, employeeId, role) {
  const scope = await getTicketScope(taskId, employeeId, role);
  if (scope.error) return scope.error;
  const gate = await requireAttendanceActive(employeeId);
  if (gate) return gate;
  const users = await listRows('User');
  const user = users.find((item) => eq(item['Employee ID'], employeeId));
  const row = {
    MessageID: `MSG_${Date.now()}`,
    TaskID: taskId,
    Timestamp: nowIso(),
    Sender: user?.['Employee Name'] || employeeId,
    Message: messageText
  };
  await insertRow('Message', row);
  await upsertRow('Ticket', 'Ticket ID', taskId, {
    'Ticket ID': taskId,
    HasUnreadMessages: true,
    'Last Update Date': row.Timestamp,
    'Last Action By': row.Sender
  });
  return ok({ item: row });
}

export async function markTicketMessagesAsRead(taskId, clientId = '', employeeId = '', role = '') {
  if (employeeId) {
    const scope = await getTicketScope(taskId, employeeId, role);
    if (scope.error) return scope.error;
  }
  const row = await upsertRow('Ticket', 'Ticket ID', taskId, {
    'Ticket ID': taskId,
    ...(clientId ? { HasUnreadMessages: false } : { HasUnreadAdminMessages: false })
  });
  return ok({ item: row });
}
