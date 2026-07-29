import { insertRow, listRows, sheetAttendance, upsertRow } from './legacyStore.service.js';
import { checkUserAttendanceActive } from './attendance.service.js';

const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
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

const elevatedRoles = new Set(['admin', 'super admin', 'hr', 'manager']);

function userId(user = {}) {
  return first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']);
}

function userRole(user = {}) {
  return safe(first(user, ['Role', 'role'], 'User')).toLowerCase();
}

function assignedIds(value) {
  return safe(value).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function isHigherRoleProtected(admin, employee) {
  const adminRole = userRole(admin);
  const employeeRole = userRole(employee);
  return employeeRole === 'super admin' && adminRole !== 'super admin';
}

function canReviewEmployee(admin, employee, users) {
  const adminId = userId(admin).toUpperCase();
  const role = userRole(admin);
  const employeeRole = userRole(employee);
  if (!elevatedRoles.has(role)) return false;
  if (isHigherRoleProtected(admin, employee)) return false;
  if (role === 'super admin') return true;
  if (role === 'hr') return employeeRole !== 'super admin';
  const team = users.filter((user) => {
    const managers = assignedIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
    const approvers = assignedIds(first(user, ['Task Approver', 'taskApprover']));
    return managers.includes(adminId.toLowerCase()) || approvers.includes(adminId.toLowerCase());
  });
  return team.some((user) => eq(userId(user), userId(employee)));
}

function isPendingTicketStatus(status = '') {
  return /pending approval|hr approved/i.test(safe(status));
}

function isPendingLeaveStatus(status = '') {
  return /^pending$/i.test(safe(status));
}

function isPendingIntimationStatus(status = '') {
  return /submitted|pending/i.test(safe(status));
}

function isPendingAttendanceStatus(status = '') {
  return /need approval|pending/i.test(safe(status));
}

function requestApprovalDecision(admin, row, users, type) {
  const role = userRole(admin);
  const employeeId = first(row, ['Employee ID', 'employeeId', 'EmpID']);
  const employee = users.find((user) => eq(userId(user), employeeId));
  const status = safe(first(row, ['Status', 'status']));
  if (employee && isHigherRoleProtected(admin, employee)) {
    return { visible: false, actionable: false, canApprove: false };
  }
  const canSeeEmployee =
    role === 'super admin' ||
    role === 'admin' ||
    (role === 'hr' && userRole(employee) !== 'super admin') ||
    (role === 'manager' && employee ? canReviewEmployee(admin, employee, users) : false);

  let pending = false;
  if (/leave/i.test(type)) pending = isPendingLeaveStatus(status);
  else if (/intimation/i.test(type)) pending = isPendingIntimationStatus(status);
  else if (/attendance/i.test(type)) pending = isPendingAttendanceStatus(status);

  if (/leave|intimation/i.test(type)) {
    if (!canSeeEmployee) {
      return { visible: false, actionable: false, canApprove: false };
    }

    if (pending) {
      return { visible: true, actionable: true, canApprove: true };
    }

    return { visible: true, actionable: false, canApprove: false };
  }

  if (!pending) {
    return { visible: false, actionable: false, canApprove: false };
  }

  if (role === 'super admin' || role === 'hr' || role === 'admin') {
    return { visible: true, actionable: true, canApprove: true };
  }

  if (role === 'manager') {
    const canSeeEmployee = employee ? canReviewEmployee(admin, employee, users) : false;
    if (!canSeeEmployee) {
      return { visible: false, actionable: false, canApprove: false };
    }
    return { visible: true, actionable: true, canApprove: true };
  }

  return { visible: false, actionable: false, canApprove: false };
}

function ticketApprovalDecision(admin, ticket, users) {
  const adminId = userId(admin).toUpperCase();
  const role = userRole(admin);
  const ownerId = safe(first(ticket, ['Employee ID', 'employeeId', 'EmpID'])).toUpperCase();
  const owner = users.find((user) => userId(user).toUpperCase() === ownerId);
  if (!owner) return { visible: false, actionable: false, canApprove: false };
  if (isHigherRoleProtected(admin, owner)) {
    return { visible: false, actionable: false, canApprove: false };
  }
  const ownTicket = ownerId === adminId;
  const taskApprover = safe(first(owner, ['Task Approver', 'taskApprover']));
  const managerId = safe(first(owner, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
  const designated = safe(taskApprover || managerId).split(',')[0].trim().toUpperCase();
  const reassignedTo = safe(first(ticket, ['Reassigned To', 'reassignedTo'])).toUpperCase();
  const isDesignated = (reassignedTo || designated) === adminId;
  const teamIds = users
    .filter((user) => assignedIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'])).includes(adminId.toLowerCase()) ||
      assignedIds(first(user, ['Task Approver', 'taskApprover'])).includes(adminId.toLowerCase()))
    .map((user) => userId(user).toUpperCase());
  const isTeamTicket = teamIds.includes(ownerId);
  const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
  const isHrTicket = ownerDepartment === 'hr' || ownerDepartment.includes('hr intern') || ownerDepartment.includes('human resource');

  if (role === 'super admin') {
    // Super Admin is the global approval authority in the MERN panel. Keep
    // self-approval blocked, but do not require a missing legacy approver
    // mapping before showing the real approval controls.
    return { visible: true, actionable: !ownTicket, canApprove: !ownTicket };
  }
  if (role === 'hr') {
    const actionable = !ownTicket && (isDesignated || isHrTicket);
    return { visible: true, actionable, canApprove: actionable };
  }
  if (role === 'manager' || role === 'admin') {
    const visible = isDesignated || isTeamTicket;
    const actionable = isDesignated && !ownTicket;
    return { visible, actionable, canApprove: actionable };
  }
  return { visible: false, actionable: false, canApprove: false };
}

function formatApprovalTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(String(value))) {
    return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return safe(value) || '-';
}

function attendanceTimestamp(dateValue, timeValue) {
  const date = normalizedDate(dateValue);
  const raw = safe(timeValue);
  if (!raw) return '';
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)) return iso.toISOString();
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return raw;
  let hour = Number(match[1]);
  if (match[4]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
  if (match[4]?.toLowerCase() === 'am' && hour === 12) hour = 0;
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${match[2]}:${match[3] || '00'}+05:30`).toISOString();
}

function durationBetween(inValue, outValue, dateValue) {
  const start = new Date(attendanceTimestamp(dateValue, inValue));
  const end = new Date(attendanceTimestamp(dateValue, outValue));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return '';
  const minutes = Math.floor((end - start) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
  const attendanceState = await checkUserAttendanceActive(employeeId);
  if (attendanceState.active) return null;
  return fail('Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!');
}

function asTicketRow(row = {}, clients = []) {
  const ticketId = first(row, ['Ticket ID', 'Task ID', 'ID', 'ticketId', 'taskId']);
  const clientId = first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const clientFromMaster = clients.find((item) => eq(item.Client_Id || item['Client ID'], clientId))?.['Client Name'] || '';
  const client = first(row, ['Name', 'Client Name', 'Client', 'clientName'], clientFromMaster);
  const employeeId = first(row, ['Employee ID', 'EmpID', 'employeeId']);
  const employeeName = first(row, ['Employee Name', 'User', 'employeeName'], employeeId);
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
    'Reassigned By': first(row, ['Reassigned By', 'reassignedBy'])
  };
}

async function getRows() {
  const [leaves, intimations, attendance, tickets, users, clients] = await Promise.all([
    listRows('Leave'),
    listRows('Intimation'),
    listRows('Attendance'),
    listRows('Ticket'),
    listRows('User'),
    listRows('Client')
  ]);
  return { leaves, intimations, attendance, tickets, users, clients };
}

export async function getPendingApprovals(adminId) {
  const data = await getRows();
  const admin = data.users.find((user) => eq(userId(user), adminId));
  if (!admin || !elevatedRoles.has(userRole(admin))) return fail('Access Denied');

  const attendanceGroups = new Map();
  data.attendance
    .filter((row) => requestApprovalDecision(admin, row, data.users, 'Attendance').visible)
    .forEach((row) => {
      const employee = first(row, ['Employee ID', 'employeeId', 'EmpID']);
      const date = normalizedDate(first(row, ['Date', 'date']));
      const key = `${safe(employee).toUpperCase()}|${date}`;
      const group = attendanceGroups.get(key) || {
        'Employee ID': employee,
        'Employee Name': first(row, ['Employee Name', 'employeeName', 'Name'], employee),
        DateStr: date,
        PunchIn: '-',
        PunchOut: '-',
        Duration: '-',
        Status: first(row, ['Status', 'status'], 'Need Approval'),
        AttendanceID: key,
        AttendanceIDs: [],
        _canApprove: false,
        _isActionableByMe: false
      };
      const decision = requestApprovalDecision(admin, row, data.users, 'Attendance');
      group.AttendanceIDs.push(first(row, ['AttendanceID', 'ID', 'attendanceId']));
      group._canApprove = group._canApprove || decision.canApprove;
      group._isActionableByMe = group._isActionableByMe || decision.actionable;
      if (/punch\s*in/i.test(first(row, ['Action', 'action']))) {
        group.PunchIn = formatApprovalTime(first(row, ['Time', 'Punch In', 'InTime']));
      }
      if (/punch\s*out/i.test(first(row, ['Action', 'action']))) {
        group.PunchOut = formatApprovalTime(first(row, ['Time', 'Punch Out', 'OutTime']));
        group.Duration = first(row, ['Total Working Hours', 'Duration'], group.Duration) || group.Duration;
      }
      attendanceGroups.set(key, group);
    });

  return ok({
    leaves: data.leaves
      .map((row) => {
        const decision = requestApprovalDecision(admin, row, data.users, 'Leave');
        return decision.visible ? { ...row, _canApprove: decision.canApprove, _isActionableByMe: decision.actionable } : null;
      })
      .filter(Boolean),
    intimations: data.intimations
      .map((row) => {
        const decision = requestApprovalDecision(admin, row, data.users, 'Intimation');
        return decision.visible ? { ...row, _canApprove: decision.canApprove, _isActionableByMe: decision.actionable } : null;
      })
      .filter(Boolean),
    attendance: Array.from(attendanceGroups.values()),
    tickets: data.tickets
      .filter((row) => ticketApprovalDecision(admin, row, data.users).visible && isPendingTicketStatus(first(row, ['Status'])))
      .map((row) => {
        const decision = ticketApprovalDecision(admin, row, data.users);
        return { ...asTicketRow(row, data.clients), _canApprove: decision.canApprove, _isActionableByMe: decision.actionable, _canTransferApproval: decision.actionable };
      })
      .sort((left, right) => Number(right._isActionableByMe) - Number(left._isActionableByMe)),
    users: data.users.map((user) => ({
      id: first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']),
      name: first(user, ['Employee Name', 'name', 'Name'], first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']))
    }))
  });
}

export async function processApprovalAction(actionData = {}) {
  const type = actionData.type || actionData.Type;
  const id = actionData.id || actionData.ID;
  const status = actionData.status || actionData.Status || actionData.action;
  const adminId = actionData.adminId || actionData.AdminID || actionData['Admin ID'] || actionData.approvedBy || actionData['Approved By'];
  const users = await listRows('User');
  const admin = users.find((user) => eq(userId(user), adminId));
  if (!admin || !elevatedRoles.has(userRole(admin))) return fail('Unauthorized: Admin/HR access required.');
  const remarks = first(actionData, ['remarks', 'Remarks', 'Admin Remarks']);
  const approved = safe(status).toLowerCase() === 'approved';
  
  let newStatus = status;
  if (approved) {
    if (/attendance/i.test(type)) newStatus = 'Present';
    else if (userRole(admin) === 'hr') newStatus = 'HR Approved';
    else newStatus = 'Approved';
  }

  const actualAction = newStatus;
  const update = { 
    ...actionData, 
    Status: newStatus,
    status: newStatus,
    'Admin Remarks': remarks, 
    'Last Update Date': nowIso() 
  };

  if (/leave/i.test(type)) {
    const leaveRows = await listRows('Leave');
    const row = leaveRows.find((item) => eq(first(item, ['LeaveID', 'Leave ID', 'ID', 'leaveId']), id));
    if (!row) return fail('Leave request not found.');
    const decision = requestApprovalDecision(admin, row, users, 'Leave');
    if (!decision.actionable) return fail('Access Denied: You cannot action this leave request.');
    return ok({ message: `Leave request ${actualAction}.`, item: await upsertRow('Leave', 'LeaveID', id, { ...update, LeaveID: id, 'Leave ID': id, 'Admin Approval': actualAction }) });
  }
  if (/intimation/i.test(type)) {
    const intimationRows = await listRows('Intimation');
    const row = intimationRows.find((item) => eq(first(item, ['IntimationID', 'Intimation ID', 'ID', 'intimationId']), id));
    if (!row) return fail('Intimation request not found.');
    const decision = requestApprovalDecision(admin, row, users, 'Intimation');
    if (!decision.actionable) return fail('Access Denied: You cannot action this intimation request.');
    return ok({ message: `Intimation request ${actualAction}.`, item: await upsertRow('Intimation', 'IntimationID', id, { ...update, IntimationID: id, 'Intimation ID': id, 'Admin Approval': actualAction }) });
  }
  if (/attendance/i.test(type)) {
    const attendanceRows = await listRows('Attendance');
    const [targetEmployee, targetDate] = safe(id).includes('|') ? safe(id).split('|', 2) : ['', ''];
    const targets = attendanceRows.filter((row) => {
      const sameDate = targetDate && normalizedDate(first(row, ['Date', 'date'])) === targetDate;
      const sameId = !targetDate && eq(first(row, ['AttendanceID', 'ID', 'attendanceId']), id);
      return (sameId || (sameDate && eq(first(row, ['Employee ID', 'employeeId', 'EmpID']), targetEmployee)));
    });
    if (!targets.length) return fail('Error: Could not match attendance date in database.');

    const attendanceDecision = requestApprovalDecision(admin, targets[0], users, 'Attendance');
    if (!attendanceDecision.actionable) return fail('Unauthorized: You cannot approve this employee attendance.');

    const date = targetDate || normalizedDate(first(targets[0], ['Date', 'date']));
    let punchIn = targets.find((row) => /punch\s*in/i.test(first(row, ['Action', 'action'])));
    let punchOut = targets.find((row) => /punch\s*out/i.test(first(row, ['Action', 'action'])));
    const correctedRows = new Map();
    if (actionData.newPunchIn && punchIn) {
      const iso = attendanceTimestamp(date, actionData.newPunchIn);
      const rowId = first(punchIn, ['AttendanceID', 'ID', 'attendanceId']);
      punchIn = await upsertRow('Attendance', 'AttendanceID', rowId, {
        ...punchIn, Date: iso, Time: iso, 'Punch In': actionData.newPunchIn
      });
      correctedRows.set(rowId, punchIn);
    }
    if (actionData.newPunchOut && punchOut) {
      const iso = attendanceTimestamp(date, actionData.newPunchOut);
      const rowId = first(punchOut, ['AttendanceID', 'ID', 'attendanceId']);
      punchOut = await upsertRow('Attendance', 'AttendanceID', rowId, {
        ...punchOut, Date: iso, Time: iso, 'Punch Out': actionData.newPunchOut
      });
      correctedRows.set(rowId, punchOut);
    }
    const attendanceEmployeeId = targetEmployee || first(targets[0], ['Employee ID', 'employeeId', 'EmpID']);
    const attendanceEmployeeName = first(targets[0], ['Employee Name', 'employeeName', 'Name'], attendanceEmployeeId);
    if (actionData.newPunchIn && !punchIn) {
      const rowId = `ATT_CORRECTION_${Date.now()}_IN`;
      const iso = attendanceTimestamp(date, actionData.newPunchIn);
      const created = sheetAttendance({
        AttendanceID: rowId,
        employeeId: attendanceEmployeeId,
        employeeName: attendanceEmployeeName,
        date: iso,
        action: 'Punch In',
        inTime: actionData.newPunchIn,
        status: update.Status,
        photo: first(targets[0], ['Photo Url', 'Photo URL', 'Photo']),
        lat: first(targets[0], ['Lattitude', 'Latitude']),
        long: first(targets[0], ['Longitude'])
      });
      created.Date = iso;
      created.Time = iso;
      created['Admin Approval'] = actualAction;
      created['Admin Remarks'] = remarks;
      punchIn = await insertRow('Attendance', created);
      targets.push(punchIn);
      correctedRows.set(rowId, punchIn);
    }
    if (actionData.newPunchOut && !punchOut) {
      const rowId = `ATT_CORRECTION_${Date.now()}_OUT`;
      const iso = attendanceTimestamp(date, actionData.newPunchOut);
      const created = sheetAttendance({
        AttendanceID: rowId,
        employeeId: attendanceEmployeeId,
        employeeName: attendanceEmployeeName,
        date: iso,
        action: 'Punch Out',
        outTime: actionData.newPunchOut,
        status: update.Status,
        photo: first(targets[0], ['Photo Url', 'Photo URL', 'Photo']),
        lat: first(targets[0], ['Lattitude', 'Latitude']),
        long: first(targets[0], ['Longitude'])
      });
      created.Date = iso;
      created.Time = iso;
      created['Admin Approval'] = actualAction;
      created['Admin Remarks'] = remarks;
      punchOut = await insertRow('Attendance', created);
      targets.push(punchOut);
      correctedRows.set(rowId, punchOut);
    }
    const inValue = punchIn && first(punchIn, ['Punch In', 'InTime', 'Time']);
    const outValue = punchOut && first(punchOut, ['Punch Out', 'OutTime', 'Time']);
    const duration = durationBetween(inValue, outValue, date);
    const updated = [];
    for (const row of targets) {
      const rowId = first(row, ['AttendanceID', 'ID', 'attendanceId']);
      const sourceRow = correctedRows.get(rowId) || row;
      const rowUpdate = {
        ...sourceRow,
        ...update,
        AttendanceID: rowId,
        Status: update.Status,
        'Admin Approval': actualAction,
        'Admin Remarks': remarks
      };
      if (/punch\s*out/i.test(first(row, ['Action', 'action'])) && duration) {
        rowUpdate.Duration = duration;
        rowUpdate['Total Working Hours'] = duration;
      }
      updated.push(await upsertRow('Attendance', 'AttendanceID', rowId, rowUpdate));
    }
    return ok({ message: `Attendance ${actualAction} successfully.`, item: updated[updated.length - 1], data: updated });
  }
  return ok({ message: 'Action processed.' });
}

export async function adminTicketAction(ticketId, adminId, action, remarks) {
  const gate = await requireAttendanceActive(adminId);
  if (gate) return gate;
  const data = await getRows();
  const ticket = data.tickets.find((item) => eq(item['Ticket ID'], ticketId));
  if (!ticket) return fail('Ticket not found.');
  const adminUser = data.users.find((user) => eq(userId(user), adminId));
  if (!adminUser) return fail('Admin user not found.');
  if (!/pending approval|hr approved/i.test(first(ticket, ['Status']))) return fail('Only pending approval tickets can be actioned.');
  const decision = ticketApprovalDecision(adminUser, ticket, data.users);
  if (!decision.actionable) return fail('Access Denied: You are not the designated approver for this ticket.');
  if (!safe(remarks) && /reject|rework/i.test(action)) return fail('Rework remarks are required.');
  const statusMap = { approve: 'Closed', approved: 'Closed', reject: 'Rework', rework: 'Rework', close: 'Closed' };
  const status = statusMap[String(action).toLowerCase()] || action || 'Updated';
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    Status: status,
    Remarks: `${first(ticket, ['Remarks', 'remarks']) || ''}${first(ticket, ['Remarks', 'remarks']) ? '\n' : ''}[${first(adminUser, ['Role', 'role'], 'Admin')} ${first(adminUser, ['Employee Name', 'Name'], adminId)} - ${referenceNow().toLocaleString('en-IN')}]: ${action} - ${remarks || ''}`,
    'Last Update Date': nowIso(),
    'Last Action By': first(adminUser, ['Employee Name', 'Name'], adminId)
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: first(adminUser, ['Employee Name', 'Name'], adminId),
    ActionType: status,
    Remarks: remarks,
    Timestamp: nowIso()
  });
  return ok({ message: 'Ticket action completed.', item: row });
}

export async function getTaskApproversList() {
  const users = await listRows('User');
  const referencedIds = new Set();
  users.forEach((user) => {
    [
      first(user, ['Task Approver', 'taskApprover', 'Approver ID']),
      first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'])
    ].forEach((value) => assignedIds(value).forEach((id) => referencedIds.add(id.toUpperCase())));
  });
  return users
    .filter((user) => {
      const id = userId(user).toUpperCase();
      const role = userRole(user);
      const active = eq(first(user, ['Status', 'status'], 'Active'), 'Active');
      return active && (referencedIds.has(id) || elevatedRoles.has(role));
    })
    .map((user) => ({ id: userId(user), name: first(user, ['Employee Name', 'Name', 'name'], userId(user)), role: first(user, ['Role', 'role'], 'User') }));
}

export async function transferTicketApproval(ticketId, targetManagerId, currentManagerId, remarks) {
  const gate = await requireAttendanceActive(currentManagerId);
  if (gate) return gate;
  const tickets = await listRows('Ticket');
  const ticket = tickets.find((item) => eq(item['Ticket ID'], ticketId));
  if (!ticket) return fail('Ticket not found.');
  const users = await listRows('User');
  const currentManager = users.find((user) => eq(userId(user), currentManagerId));
  const targetManager = users.find((user) => eq(userId(user), targetManagerId) && eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
  if (!currentManager || !targetManager) return fail('Manager details not found.');
  if (!/pending approval|hr approved/i.test(first(ticket, ['Status']))) return fail('Only pending approval tickets can be transferred.');
  if (!ticketApprovalDecision(currentManager, ticket, users).actionable) return fail('Access Denied: You are not the designated approver for this ticket.');
  if (!safe(remarks)) return fail('Transfer remarks are required.');
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    'Reassigned To': targetManagerId,
    'Reassigned By': currentManagerId,
    Remarks: `[[Approval transferred by ${currentManagerId}]] ${remarks || ''}`,
    'Last Update Date': nowIso()
  });
  return ok({ message: 'Approval transferred.', item: row });
}
