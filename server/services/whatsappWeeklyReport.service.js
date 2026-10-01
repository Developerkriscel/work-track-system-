import crypto from 'node:crypto';
import PDFDocument from 'pdfkit-table';
import { WhatsAppAlertJob } from '../models/whatsappAlertJob.model.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import { listRows } from './legacyStore.service.js';
import { dateKey, employeeIdOf, field, isActive, isFinished, istClock } from './whatsappAlertRules.js';

const text = (value) => String(value ?? '').trim();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const WEEKLY_EVENT_PREFIX = 'weekly-super-admin-report:';
const DAILY_ADMIN_EVENT_PREFIX = 'daily-admin-report:';
const WEEKLY_REPORT_EMPLOYEE_IDS = (process.env.WHATSAPP_WEEKLY_REPORT_EMPLOYEES || 'AS101').split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
const DAILY_REPORT_EMPLOYEE_IDS = (process.env.WHATSAPP_DAILY_REPORT_EMPLOYEES || 'MS101,S103,NL106').split(/[,;|]/).map((item) => item.trim()).filter(Boolean);

function roleOf(user) {
  return field(user, ['Role', 'role', 'User Role']);
}

function nameOf(row, fallback = '') {
  return field(row, ['Employee Name', 'Name', 'Full Name', 'User', 'name']) || fallback;
}

function clientIdOf(row) {
  return field(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
}

function clientNameOf(row, clients = []) {
  const id = clientIdOf(row);
  const client = clients.find((item) => clientIdOf(item) === id || field(item, ['Client_Id', 'Client ID', 'ID']) === id);
  return field(row, ['Client Name', 'Client', 'Name', 'clientName'])
    || field(client, ['Client Name', 'Name', 'Company Name', 'Client'])
    || id
    || 'Unassigned';
}

function parseHours(value) {
  const raw = text(value).toLowerCase();
  if (!raw) return 0;
  const clock = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60 + Number(clock[3] || 0) / 3600;
  const h = raw.match(/([\d.]+)\s*(?:h|hr|hrs|hour|hours)/);
  const m = raw.match(/([\d.]+)\s*(?:m|min|mins|minute|minutes)/);
  if (h || m) return Number(h?.[1] || 0) + Number(m?.[1] || 0) / 60;
  const numeric = Number(raw.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 24 ? numeric / 60 : numeric;
}

function rowDate(row, keys) {
  return dateKey(field(row, keys));
}

function inRange(day, start, end) {
  return Boolean(day) && day >= start && day <= end;
}

function addDays(day, amount) {
  const date = new Date(`${day}T12:00:00+05:30`);
  date.setUTCDate(date.getUTCDate() + amount);
  return istClock(date).day;
}

function previousIstDay(now = new Date()) {
  return addDays(istClock(now).day, -1);
}

function daysBetween(start, end) {
  const startDate = new Date(`${start}T12:00:00+05:30`);
  const endDate = new Date(`${end}T12:00:00+05:30`);
  return Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
}

export function weeklyReportWindow(now = new Date()) {
  const clock = istClock(now);
  const weekday = istWeekday(now);
  // Weekly report covers the completed business week: Monday to Saturday. Sunday is weekly off.
  const offsetToSaturday = { Sun: -1, Mon: -2, Tue: -3, Wed: -4, Thu: -5, Fri: -6, Sat: 0 }[weekday] ?? -1;
  const end = addDays(clock.day, offsetToSaturday);
  const start = addDays(end, -5);
  return {
    end,
    start,
    label: `${start} to ${end}`
  };
}

function istWeekday(now = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(now);
}

function countLeaves(rows = [], start, end) {
  return rows.filter((row) => {
    const from = rowDate(row, ['Start Date', 'From Date', 'Date', 'Leave Date']);
    const to = rowDate(row, ['End Date', 'To Date', 'Date', 'Leave Date']) || from;
    return from && to && from <= end && to >= start;
  }).length;
}

function attendanceStats(rows = [], users = [], start, end) {
  const activeIds = new Set(users.filter(isActive).map(employeeIdOf).filter(Boolean));
  const groups = new Map();
  for (const row of rows) {
    const employeeId = employeeIdOf(row);
    if (!activeIds.has(employeeId)) continue;
    const day = rowDate(row, ['Date', 'Attendance Date', 'Punch Date']);
    if (!inRange(day, start, end)) continue;
    const key = `${employeeId}:${day}`;
    if (!groups.has(key)) groups.set(key, { employeeId, day, in: null, out: null });
    const group = groups.get(key);
    const action = field(row, ['Action', 'action']);
    const timeValue = field(row, ['Time', action.match(/out/i) ? 'Punch Out' : 'Punch In', 'Timestamp']);
    const parsed = timeValue ? new Date(timeValue.includes('T') ? timeValue : `${day}T${timeValue}+05:30`) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) continue;
    if (/out/i.test(action)) group.out = !group.out || parsed > group.out ? parsed : group.out;
    else if (/in/i.test(action)) group.in = !group.in || parsed < group.in ? parsed : group.in;
  }
  let hours = 0;
  for (const group of groups.values()) {
    if (group.in && group.out && group.out > group.in) hours += (group.out - group.in) / 36e5;
  }
  return { presentDays: groups.size, hours, groups: [...groups.values()] };
}

function ticketDate(row) {
  return rowDate(row, ['Plan Date', 'Date', 'Timestamp', 'Created At', 'Created Date']);
}

function ticketCompletedDate(row) {
  return rowDate(row, ['Done Date', 'doneDate', 'Closed Date', 'Completed Date', 'Completion Date', 'Approved Date', 'Last Update Date', 'Updated At', 'updatedAt']);
}

function completedTicket(row) {
  return /^(completed|closed|done|approved|resolved|hr approved)$/i.test(field(row, ['Status', 'status']))
    || Boolean(field(row, ['Done Date', 'doneDate', 'Closed Date', 'Completed Date', 'Completion Date']));
}

function ticketInWeeklyReport(row, start, end) {
  const planned = ticketDate(row);
  const completed = ticketCompletedDate(row);
  return inRange(planned, start, end) || (completedTicket(row) && inRange(completed, start, end));
}

function workDate(row) {
  return rowDate(row, ['Plan Date', 'Due Date', 'Date', 'Timestamp', 'Created At', 'Created Date']);
}

function actualTicketHours(row) {
  return parseHours(field(row, ['Total Duration', 'Duration', 'Actual Duration', 'Working Hours', 'Time Taken']));
}

function timeOnly(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(String(value).includes('T') ? value : `1970-01-01T${value}+05:30`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : '-';
}

function istMinutes(value) {
  if (!value) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const map = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  const minutes = Number(map.hour) * 60 + Number(map.minute);
  return Number.isFinite(minutes) ? minutes : null;
}

function minutesLabel(minutes) {
  if (!Number.isFinite(minutes)) return '-';
  const rounded = Math.round(minutes);
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

function plannedHours(row) {
  return parseHours(field(row, ['Planned Hours', 'Plan Hours', 'Estimated Hours', 'TAT', 'Tat', 'Assigned TAT', 'Expected Duration']));
}

function entityIdOf(row) {
  return field(row, ['Ticket ID', 'Task ID', 'TodoID', 'ID', 'rowId']);
}

function descriptionOf(row) {
  const value = field(row, ['Task Description', 'Description', 'Task', 'Remarks', 'Name']);
  return value.length > 90 ? `${value.slice(0, 87)}...` : value;
}

function compactText(value = '', max = 70) {
  const clean = text(value).replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

function creatorOf(row, users = []) {
  const creatorId = field(row, ['Creator ID', 'Created By ID', 'Assigned By ID', 'Reassigned By', 'Created By', 'Assigned By']);
  const user = users.find((item) => employeeIdOf(item) === creatorId);
  return nameOf(user, creatorId) || field(row, ['Creator Name', 'Created By Name', 'Assigned By Name', 'Created By', 'Assigned By']) || 'Not specified';
}

function shortClientHours(clientHours = []) {
  const parts = clientHours
    .filter((item) => item.hours || item.tickets)
    .sort((a, b) => b.hours - a.hours || b.tickets - a.tickets || a.client.localeCompare(b.client))
    .map((item) => `${item.client}: ${fixed(item.hours)}h (${item.tickets})`);
  const value = parts.join('; ');
  return value.length > 120 ? `${value.slice(0, 117)}...` : value || '-';
}

function shortSamples(items = []) {
  const value = items.slice(0, 3).join('; ');
  const extra = items.length > 3 ? `; +${items.length - 3} more` : '';
  const textValue = `${value}${extra}`;
  return textValue.length > 140 ? `${textValue.slice(0, 137)}...` : textValue || '-';
}

function splitIds(value) {
  return text(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

function scopedEmployeeIds(users = [], scopeEmployeeId = '') {
  const reviewerId = text(scopeEmployeeId);
  const activeIds = new Set(users.filter(isActive).map(employeeIdOf).filter(Boolean));
  if (!reviewerId) return activeIds;
  const scoped = new Set([reviewerId]);
  for (const user of users) {
    const ids = [
      ...splitIds(field(user, ['Manager ID', 'Manager', 'Reporting Manager', 'managerId'])),
      ...splitIds(field(user, ['Task Approver', 'Approver ID', 'taskApprover'])),
      ...splitIds(field(user, ['HR ID', 'HR', 'Admin ID']))
    ];
    if (ids.some((id) => id.toLowerCase() === reviewerId.toLowerCase())) {
      const employeeId = employeeIdOf(user);
      if (employeeId) scoped.add(employeeId);
    }
  }
  return new Set([...scoped].filter((id) => activeIds.has(id)));
}

function filterRowsByEmployees(rows = [], ids = new Set()) {
  if (!ids.size) return [];
  return rows.filter((row) => ids.has(employeeIdOf(row)));
}

function addGroup(map, key, seed, updater) {
  if (!map.has(key)) map.set(key, { ...seed });
  updater(map.get(key));
}

export function buildWeeklyReportData(rows = {}, now = new Date(), { scopeEmployeeId = '' } = {}) {
  const { start, end, label } = weeklyReportWindow(now);
  const users = rows.User || [];
  const clients = rows.Client || [];
  const scopedIds = scopedEmployeeIds(users, scopeEmployeeId);
  const activeUsers = users.filter((user) => scopedIds.has(employeeIdOf(user)));
  const scopedRows = {
    ...rows,
    User: activeUsers,
    Ticket: filterRowsByEmployees(rows.Ticket || [], scopedIds),
    Todo: filterRowsByEmployees(rows.Todo || [], scopedIds),
    FmsTask: filterRowsByEmployees(rows.FmsTask || [], scopedIds),
    Attendance: filterRowsByEmployees(rows.Attendance || [], scopedIds),
    Leave: filterRowsByEmployees(rows.Leave || [], scopedIds),
    Intimation: filterRowsByEmployees(rows.Intimation || [], scopedIds)
  };
  const attendance = attendanceStats(scopedRows.Attendance || [], activeUsers, start, end);
  const leaveCount = countLeaves(scopedRows.Leave || [], start, end);
  const intimationCount = (scopedRows.Intimation || []).filter((row) => inRange(rowDate(row, ['Intimation Date', 'Date', 'Timestamp', 'Created At']), start, end)).length;
  const expectedAttendanceDays = activeUsers.length * daysBetween(start, end);
  const missingAttendanceDays = Math.max(0, expectedAttendanceDays - attendance.presentDays - leaveCount);
  const workModels = [
    ['Ticket', scopedRows.Ticket || []],
    ['Todo', scopedRows.Todo || []],
    ['FMS', scopedRows.FmsTask || []]
  ];
  const pending = workModels.map(([labelName, list]) => [labelName, list.filter((row) => inRange(workDate(row), start, end) && !isFinished(row)).length]);
  const pendingByPersonMap = new Map();
  for (const [labelName, list] of workModels) {
    for (const row of list) {
      const day = workDate(row);
      if (!inRange(day, start, end) || isFinished(row)) continue;
      const employeeId = employeeIdOf(row);
      const key = employeeId || 'unassigned';
      if (!pendingByPersonMap.has(key)) pendingByPersonMap.set(key, {
        employeeId: employeeId || '-',
        name: nameOf(row, employeeId || 'Unassigned'),
        tickets: 0,
        todo: 0,
        fms: 0,
        total: 0,
        oldestDate: day,
        samples: []
      });
      const item = pendingByPersonMap.get(key);
      if (labelName === 'Ticket') item.tickets += 1;
      else if (labelName === 'Todo') item.todo += 1;
      else item.fms += 1;
      item.total += 1;
      if (day && (!item.oldestDate || day < item.oldestDate)) item.oldestDate = day;
      item.samples.push(`${labelName} ${entityIdOf(row) || '-'}: ${descriptionOf(row) || field(row, ['Status', 'status']) || 'Open'}`);
    }
  }
  const pendingByPerson = [...pendingByPersonMap.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const clientMap = new Map();
  const completedClientMap = new Map();
  const personTicketMap = new Map(activeUsers.map((user) => [employeeIdOf(user), {
    employeeId: employeeIdOf(user),
    name: nameOf(user, employeeIdOf(user)),
    hours: 0,
    tickets: 0,
    completed: 0,
    pending: 0,
    clientHours: new Map()
  }])); 
  for (const row of scopedRows.Ticket || []) {
    if (!ticketInWeeklyReport(row, start, end)) continue;
    const name = clientNameOf(row, clients);
    const hours = actualTicketHours(row);
    const employeeId = employeeIdOf(row);
    const employeeName = nameOf(activeUsers.find((user) => employeeIdOf(user) === employeeId) || row, employeeId || 'Unassigned');
    addGroup(clientMap, name.toLowerCase(), { client: name, tickets: 0, completed: 0, pending: 0, hours: 0, employees: new Set() }, (item) => {
      item.tickets += 1;
      if (completedTicket(row)) item.completed += 1;
      else item.pending += 1;
      item.hours += hours;
      if (employeeId) item.employees.add(employeeName);
    });
    if (completedTicket(row)) {
      addGroup(completedClientMap, name.toLowerCase(), { client: name, completed: 0, hours: 0, employees: new Set() }, (item) => {
        item.completed += 1;
        item.hours += hours;
        if (employeeId) item.employees.add(employeeName);
      });
    }
    if (!personTicketMap.has(employeeId)) personTicketMap.set(employeeId, {
      employeeId,
      name: employeeName,
      hours: 0,
      tickets: 0,
      completed: 0,
      pending: 0,
      clientHours: new Map()
    });
    const person = personTicketMap.get(employeeId);
    person.hours += hours;
    person.tickets += 1;
    if (completedTicket(row)) person.completed += 1;
    else person.pending += 1;
    const clientKey = name.toLowerCase();
    if (!person.clientHours.has(clientKey)) person.clientHours.set(clientKey, { client: name, hours: 0, tickets: 0 });
    const clientItem = person.clientHours.get(clientKey);
    clientItem.hours += hours;
    clientItem.tickets += 1;
  }
  const personWiseTickets = [...personTicketMap.values()]
    .filter((row) => row.tickets || row.hours)
    .map((row) => ({
      ...row,
      clientHours: [...row.clientHours.values()]
    }))
    .sort((a, b) => b.hours - a.hours || b.tickets - a.tickets || a.name.localeCompare(b.name));

  const attendanceHoursByPerson = new Map();
  const presentDaysByPerson = new Map();
  const punchInMinutesByPerson = new Map();
  const punchOutMinutesByPerson = new Map();
  for (const group of attendance.groups) {
    presentDaysByPerson.set(group.employeeId, (presentDaysByPerson.get(group.employeeId) || 0) + 1);
    if (group.in) {
      const minute = istMinutes(group.in);
      if (minute !== null) punchInMinutesByPerson.set(group.employeeId, [...(punchInMinutesByPerson.get(group.employeeId) || []), minute]);
    }
    if (group.out) {
      const minute = istMinutes(group.out);
      if (minute !== null) punchOutMinutesByPerson.set(group.employeeId, [...(punchOutMinutesByPerson.get(group.employeeId) || []), minute]);
    }
    if (group.in && group.out && group.out > group.in) {
      attendanceHoursByPerson.set(group.employeeId, (attendanceHoursByPerson.get(group.employeeId) || 0) + ((group.out - group.in) / 36e5));
    }
  }
  const leaveDaysByPerson = new Map();
  const leaveDetails = [];
  for (const row of scopedRows.Leave || []) {
    const from = rowDate(row, ['Start Date', 'From Date', 'Date', 'Leave Date']);
    const to = rowDate(row, ['End Date', 'To Date', 'Date', 'Leave Date']) || from;
    const employeeId = employeeIdOf(row);
    if (employeeId && from && to && from <= end && to >= start) {
      leaveDaysByPerson.set(employeeId, (leaveDaysByPerson.get(employeeId) || 0) + 1);
      leaveDetails.push({
        employeeId,
        name: nameOf(row, employeeId),
        date: from === to ? from : `${from} to ${to}`,
        type: field(row, ['Leave Type', 'Type', 'Day Type']) || 'Leave',
        status: field(row, ['Status', 'status']) || '-',
        reason: compactText(field(row, ['Reason', 'Remarks', 'Description']), 60)
      });
    }
  }
  const intimationDetails = (scopedRows.Intimation || [])
    .filter((row) => inRange(rowDate(row, ['Intimation Date', 'Date', 'Timestamp', 'Created At']), start, end))
    .map((row) => ({
      employeeId: employeeIdOf(row),
      name: nameOf(row, employeeIdOf(row)),
      date: rowDate(row, ['Intimation Date', 'Date', 'Timestamp', 'Created At']),
      type: field(row, ['Intimation Type', 'Type']) || 'Intimation',
      status: field(row, ['Status', 'status']) || '-',
      reason: compactText(field(row, ['Reason', 'Remarks', 'Description']), 60)
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  leaveDetails.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const weekDays = daysBetween(start, end);
  const personMap = new Map(activeUsers.map((user) => {
    const employeeId = employeeIdOf(user);
    const presentDays = presentDaysByPerson.get(employeeId) || 0;
    const leaveRequests = leaveDaysByPerson.get(employeeId) || 0;
    return [employeeId, {
      employeeId,
      name: nameOf(user, employeeId),
      presentDays,
      leaveRequests,
      missingDays: Math.max(0, weekDays - presentDays - leaveRequests),
      avgPunchIn: minutesLabel((punchInMinutesByPerson.get(employeeId) || []).reduce((sum, item) => sum + item, 0) / (punchInMinutesByPerson.get(employeeId) || []).length),
      avgPunchOut: minutesLabel((punchOutMinutesByPerson.get(employeeId) || []).reduce((sum, item) => sum + item, 0) / (punchOutMinutesByPerson.get(employeeId) || []).length),
      pendingWorks: 0,
      planned: 0,
      actual: attendanceHoursByPerson.get(employeeId) || 0
    }];
  }));
  for (const [, list] of workModels) {
    for (const row of list) {
      const day = workDate(row);
      const employeeId = employeeIdOf(row);
      if (!inRange(day, start, end) || !personMap.has(employeeId)) continue;
      personMap.get(employeeId).planned += plannedHours(row);
      if (!isFinished(row)) personMap.get(employeeId).pendingWorks += 1;
    }
  }
  const completedClientWise = [...completedClientMap.values()]
    .map((row) => ({ ...row, employees: [...row.employees].slice(0, 3).join(', ') || '-' }))
    .sort((a, b) => b.hours - a.hours || b.completed - a.completed || a.client.localeCompare(b.client));
  const clientWise = [...clientMap.values()]
    .map((row) => ({ ...row, employees: [...row.employees].slice(0, 4).join(', ') || '-' }))
    .sort((a, b) => b.hours - a.hours || b.tickets - a.tickets || a.client.localeCompare(b.client));
  const personWise = [...personMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const presentEmployees = personWise.filter((row) => row.presentDays > 0).length;
  const absentEmployees = personWise.filter((row) => row.presentDays === 0 && row.leaveRequests === 0).length;

  return {
    start,
    end,
    label,
    scopeEmployeeId,
    scopeTeamSize: activeUsers.length,
    totals: {
      activeTeam: activeUsers.length,
      weekDays,
      expectedAttendanceDays,
      presentDays: attendance.presentDays,
      presentEmployees,
      absentEmployees,
      missingAttendanceDays,
      attendanceDays: attendance.presentDays,
      attendanceHours: attendance.hours,
      leaves: leaveCount,
      intimations: intimationCount,
      pendingTotal: pending.reduce((sum, [, count]) => sum + count, 0),
      tickets: personWiseTickets.reduce((sum, row) => sum + row.tickets, 0),
      completedTickets: personWiseTickets.reduce((sum, row) => sum + row.completed, 0),
      pendingTickets: personWiseTickets.reduce((sum, row) => sum + row.pending, 0)
    },
    pending: pending.map(([type, count]) => ({ type, count })),
    pendingByPerson,
    clientWise,
    completedClientWise,
    leaveDetails,
    intimationDetails,
    personWiseTickets,
    personWise
  };
}

function pendingApprovalCounts(rows = {}) {
  const ticket = (rows.Ticket || []).filter((row) => /^(pending approval|hr approved)$/i.test(field(row, ['Status', 'status']))).length;
  const attendance = (rows.Attendance || []).filter((row) => /^(pending|submitted|need approval)$/i.test(field(row, ['Admin Approval', 'Status', 'status']))).length;
  const leave = (rows.Leave || []).filter((row) => /^(pending|submitted|need approval)$/i.test(field(row, ['Status', 'status']))).length;
  const intimation = (rows.Intimation || []).filter((row) => /^(pending|submitted|need approval)$/i.test(field(row, ['Status', 'status']))).length;
  return {
    ticket,
    attendance,
    leave,
    intimation,
    total: ticket + attendance + leave + intimation
  };
}

export function buildDailyAdminReportData(rows = {}, now = new Date(), { scopeEmployeeId = '' } = {}) {
  const day = istClock(now).day;
  const users = rows.User || [];
  const clients = rows.Client || [];
  const scopedIds = scopedEmployeeIds(users, scopeEmployeeId);
  const activeUsers = users.filter((user) => scopedIds.has(employeeIdOf(user)));
  const scopedRows = {
    ...rows,
    User: activeUsers,
    Ticket: filterRowsByEmployees(rows.Ticket || [], scopedIds),
    Attendance: filterRowsByEmployees(rows.Attendance || [], scopedIds),
    Leave: filterRowsByEmployees(rows.Leave || [], scopedIds),
    Intimation: filterRowsByEmployees(rows.Intimation || [], scopedIds)
  };
  const attendance = attendanceStats(scopedRows.Attendance || [], activeUsers, day, day);
  const leaveCount = countLeaves(scopedRows.Leave || [], day, day);
  const intimationCount = (scopedRows.Intimation || []).filter((row) => rowDate(row, ['Intimation Date', 'Date', 'Timestamp', 'Created At']) === day).length;
  const approvals = pendingApprovalCounts(scopedRows);

  const clientMap = new Map();
  const personTicketMap = new Map(activeUsers.map((user) => [employeeIdOf(user), {
    employeeId: employeeIdOf(user),
    name: nameOf(user, employeeIdOf(user)),
    hours: 0,
    tickets: 0,
    completed: 0,
    pending: 0,
    clientHours: new Map()
  }]));
  let ticketCount = 0;
  const completedClientMap = new Map();
  for (const row of scopedRows.Ticket || []) {
    if (ticketDate(row) !== day) continue;
    ticketCount += 1;
    const name = clientNameOf(row, clients);
    const hours = actualTicketHours(row);
    addGroup(clientMap, name.toLowerCase(), { client: name, tickets: 0, completed: 0, pending: 0, hours: 0 }, (item) => {
      item.tickets += 1;
      if (isFinished(row)) item.completed += 1;
      else item.pending += 1;
      item.hours += hours;
    });
    if (isFinished(row)) {
      addGroup(completedClientMap, name.toLowerCase(), { client: name, completed: 0, hours: 0, employees: new Set() }, (item) => {
        item.completed += 1;
        item.hours += hours;
        if (employeeIdOf(row)) item.employees.add(nameOf(row, employeeIdOf(row)));
      });
    }
    const employeeId = employeeIdOf(row);
    if (!personTicketMap.has(employeeId)) personTicketMap.set(employeeId, {
      employeeId,
      name: nameOf(row, employeeId || 'Unassigned'),
      hours: 0,
      tickets: 0,
      completed: 0,
      pending: 0,
      clientHours: new Map()
    });
    const person = personTicketMap.get(employeeId);
    person.hours += hours;
    person.tickets += 1;
    if (isFinished(row)) person.completed += 1;
    else person.pending += 1;
    const clientKey = name.toLowerCase();
    if (!person.clientHours.has(clientKey)) person.clientHours.set(clientKey, { client: name, hours: 0, tickets: 0 });
    const clientItem = person.clientHours.get(clientKey);
    clientItem.hours += hours;
    clientItem.tickets += 1;
  }
  const personWiseTickets = [...personTicketMap.values()]
    .filter((row) => row.tickets || row.hours)
    .map((row) => ({
      ...row,
      clientHours: [...row.clientHours.values()]
    }))
    .sort((a, b) => b.hours - a.hours || b.tickets - a.tickets || a.name.localeCompare(b.name));

  const attendanceByEmployee = new Map(attendance.groups.map((group) => [group.employeeId, group]));
  const leaveRows = (scopedRows.Leave || []).filter((row) => {
    const from = rowDate(row, ['Start Date', 'From Date', 'Date', 'Leave Date']);
    const to = rowDate(row, ['End Date', 'To Date', 'Date', 'Leave Date']) || from;
    return from && to && from <= day && to >= day;
  });
  const leaveByEmployee = new Map(leaveRows.map((row) => [employeeIdOf(row), row]));
  const ticketsByEmployee = new Map(personWiseTickets.map((row) => [row.employeeId, row]));
  const attendanceRows = activeUsers.map((user) => {
    const employeeId = employeeIdOf(user);
    const group = attendanceByEmployee.get(employeeId);
    const leave = leaveByEmployee.get(employeeId);
    const ticketInfo = ticketsByEmployee.get(employeeId);
    return {
      employeeId,
      name: nameOf(user, employeeId),
      status: group ? 'Present' : leave ? 'On Leave' : 'Absent',
      punchIn: timeOnly(group?.in),
      punchOut: timeOnly(group?.out),
      pendingTickets: ticketInfo?.pending || 0
    };
  }).sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));
  const absentEmployees = attendanceRows.filter((row) => row.status === 'Absent').length;
  const completedClientWise = [...completedClientMap.values()]
    .map((row) => ({ ...row, employees: [...row.employees].slice(0, 3).join(', ') || '-' }))
    .sort((a, b) => b.hours - a.hours || b.completed - a.completed || a.client.localeCompare(b.client));
  const leaveDetails = leaveRows.map((row) => ({
    employeeId: employeeIdOf(row),
    name: nameOf(row, employeeIdOf(row)),
    type: field(row, ['Leave Type', 'Type', 'Day Type']) || 'Leave',
    status: field(row, ['Status', 'status']) || '-',
    reason: compactText(field(row, ['Reason', 'Remarks', 'Description']), 60)
  })).sort((a, b) => a.name.localeCompare(b.name));
  const intimationDetails = (scopedRows.Intimation || [])
    .filter((row) => rowDate(row, ['Intimation Date', 'Date', 'Timestamp', 'Created At']) === day)
    .map((row) => ({
      employeeId: employeeIdOf(row),
      name: nameOf(row, employeeIdOf(row)),
      type: field(row, ['Intimation Type', 'Type']) || 'Intimation',
      status: field(row, ['Status', 'status']) || '-',
      reason: compactText(field(row, ['Reason', 'Remarks', 'Description']), 60)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    day,
    scopeEmployeeId,
    scopeTeamSize: activeUsers.length,
    totals: {
      activeTeam: activeUsers.length,
      attendanceDays: attendance.presentDays,
      absentEmployees,
      attendanceHours: attendance.hours,
      leaves: leaveCount,
      intimations: intimationCount,
      pendingApprovals: approvals.total,
      tickets: ticketCount
    },
    approvals,
    clientWise: [...clientMap.values()].sort((a, b) => b.tickets - a.tickets || a.client.localeCompare(b.client)),
    completedClientWise,
    attendanceRows,
    leaveDetails,
    intimationDetails,
    personWiseTickets
  };
}

function fixed(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

function percent(value, total) {
  if (!total) return '0%';
  return `${Math.round((Number(value || 0) / Number(total || 1)) * 100)}%`;
}

async function renderPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const tableOptions = (headerSize = 8, rowSize = 8) => ({
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(headerSize),
        prepareRow: () => doc.font('Helvetica').fontSize(rowSize)
      });
      const section = (title, note = '') => {
        doc.moveDown(0.7);
        doc.font('Helvetica-Bold').fontSize(12).text(title);
        if (note) doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(note).fillColor('black');
        doc.moveDown(0.25);
      };

      doc.font('Helvetica-Bold').fontSize(18).text('Weekly Team Report', { align: 'center' });
      doc.font('Helvetica').fontSize(10).text(`Week: ${data.label}`, { align: 'center' });
      doc.font('Helvetica').fontSize(8).text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'center' });

      doc.table({
        headers: ['Metric', 'Value', 'Meaning'],
        rows: [
          ['Total employees', data.totals.activeTeam, 'Employees included in this report.'],
          ['Working days', data.totals.weekDays, 'Monday to Saturday. Sunday is weekly off.'],
          ['Present employees', data.totals.presentEmployees, 'Employees with at least one punch-in in this week.'],
          ['Absent employees', data.totals.absentEmployees, 'Employees with no attendance and no leave in this week.'],
          ['Leave records', data.totals.leaves, 'Leaves overlapping this week.'],
          ['Intimations', data.totals.intimations, 'Intimations in this week.'],
          ['Tickets this week', data.totals.tickets, 'Tickets planned/dated inside this week.'],
          ['Completed tickets', data.totals.completedTickets, 'Completed/closed tickets this week.'],
          ['Pending tickets', data.totals.pendingTickets, 'Open tickets this week.']
        ]
      }, tableOptions(8, 8));

      section('Attendance Summary - Punch In / Punch Out', 'Avg Punch In/Out means the employee average punch time across present days this week.');
      doc.table({
        headers: ['Emp ID', 'Name', 'Present Days', 'Absent Days', 'Leave', 'Avg In', 'Avg Out', 'Pending Tickets'],
        rows: (data.personWise.length ? data.personWise : [{ employeeId: '-', name: '-', presentDays: 0, missingDays: 0, leaveRequests: 0, avgPunchIn: '-', avgPunchOut: '-', pendingWorks: 0 }])
          .map((row) => [row.employeeId, row.name, row.presentDays, row.missingDays, row.leaveRequests, row.avgPunchIn, row.avgPunchOut, row.pendingWorks])
      }, tableOptions(7, 7));

      section('User-wise Ticket Summary', 'Shows ticket hours, completed tickets, pending tickets, and client-wise time.');
      doc.table({
        headers: ['Emp ID', 'User', 'Hours', 'Total', 'Completed', 'Pending', 'Client-wise Hours'],
        rows: (data.personWiseTickets.length ? data.personWiseTickets : [{ employeeId: '-', name: '-', hours: 0, tickets: 0, completed: 0, pending: 0, clientHours: [] }])
          .map((row) => [row.employeeId, row.name, fixed(row.hours), row.tickets, row.completed, row.pending, shortClientHours(row.clientHours)])
      }, tableOptions(7, 7));

      section('Client-wise Work Time and Pending Summary', 'Client-wise short summary: total hours, total tickets, completed, pending, and employees who worked. No ticket details are shown.');
      doc.table({
        headers: ['Client', 'Work Hours', 'Tickets', 'Completed', 'Pending', 'Worked By'],
        rows: (data.clientWise.length ? data.clientWise : [{ client: 'No client ticket work this week', hours: 0, tickets: 0, completed: 0, pending: 0, employees: '-' }])
          .map((row) => [row.client, fixed(row.hours), row.tickets, row.completed, row.pending, row.employees])
      }, tableOptions(7, 7));

      section('Pending Work Summary', 'Grouped by employee to avoid long ticket lists.');
      doc.table({
        headers: ['Emp ID', 'User', 'Tickets', 'Todo', 'FMS', 'Total', 'Oldest Date', 'Sample Work'],
        rows: (data.pendingByPerson.length ? data.pendingByPerson : [{ employeeId: '-', name: '-', tickets: 0, todo: 0, fms: 0, total: 0, oldestDate: '-', samples: ['No pending work for this week.'] }])
          .map((row) => [row.employeeId, row.name, row.tickets, row.todo, row.fms, row.total, row.oldestDate || '-', shortSamples(row.samples)])
      }, tableOptions(7, 7));

      section('Leave and Intimation');
      doc.table({
        headers: ['Type', 'Date', 'Emp ID', 'Name', 'Sub Type', 'Status', 'Reason'],
        rows: [
          ...(data.leaveDetails.length ? data.leaveDetails : [{ date: '-', employeeId: '-', name: '-', type: '-', status: '-', reason: 'No leave records.' }]).map((row) => ['Leave', row.date, row.employeeId, row.name, row.type, row.status, row.reason || '-']),
          ...(data.intimationDetails.length ? data.intimationDetails : [{ date: '-', employeeId: '-', name: '-', type: '-', status: '-', reason: 'No intimation records.' }]).map((row) => ['Intimation', row.date, row.employeeId, row.name, row.type, row.status, row.reason || '-'])
        ]
      }, tableOptions(7, 7));

      doc.moveDown(0.7);
      doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text('Notes: Weekly report covers Monday to Saturday only. Sunday is weekly off. Ticket hours come from duration/working-hour fields; missing duration shows as 0.0.', { align: 'left' }).fillColor('black');

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function renderDailyAdminPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const tableOptions = (headerSize = 8, rowSize = 8) => ({
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(headerSize),
        prepareRow: () => doc.font('Helvetica').fontSize(rowSize)
      });
      const section = (title, note = '') => {
        doc.moveDown(0.7);
        doc.font('Helvetica-Bold').fontSize(12).text(title);
        if (note) doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(note).fillColor('black');
        doc.moveDown(0.25);
      };

      doc.font('Helvetica-Bold').fontSize(18).text('Previous Day Team Report', { align: 'center' });
      doc.font('Helvetica').fontSize(10).text(`Report Date: ${data.day}`, { align: 'center' });
      doc.font('Helvetica').fontSize(8).text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'center' });

      doc.table({
        headers: ['Metric', 'Value', 'Meaning'],
        rows: [
          ['Total employees', data.totals.activeTeam, 'Employees included in this report.'],
          ['Present employees', data.totals.attendanceDays, 'Marked punch-in on this date.'],
          ['Absent employees', data.totals.absentEmployees, 'No attendance and no leave found.'],
          ['Leave records', data.totals.leaves, 'Leave overlapping this date.'],
          ['Intimations', data.totals.intimations, 'Intimation records for this date.'],
          ['Tickets for the day', data.totals.tickets, 'Tickets whose Plan Date/Date matches this report date.'],
          ['Completed tickets', data.personWiseTickets.reduce((sum, row) => sum + row.completed, 0), 'Tickets completed/closed on this report date list.'],
          ['Pending tickets', data.personWiseTickets.reduce((sum, row) => sum + row.pending, 0), 'Tickets still open from this report date list.']
        ]
      }, tableOptions(8, 8));

      section('Attendance - Punch In / Punch Out', 'Status is Present, On Leave, or Absent. Pending Tickets are open tickets planned for this date.');
      doc.table({
        headers: ['Emp ID', 'Name', 'Status', 'Punch In', 'Punch Out', 'Pending Tickets'],
        rows: (data.attendanceRows.length ? data.attendanceRows : [{ employeeId: '-', name: '-', status: '-', punchIn: '-', punchOut: '-', pendingTickets: 0 }])
          .map((row) => [row.employeeId, row.name, row.status, row.punchIn, row.punchOut, row.pendingTickets])
      }, tableOptions(7, 7));

      section('User-wise Ticket Summary', 'Shows ticket work for the report date in one easy table.');
      doc.table({
        headers: ['Emp ID', 'User', 'Hours', 'Total', 'Completed', 'Pending', 'Client-wise Hours'],
        rows: (data.personWiseTickets.length ? data.personWiseTickets : [{ employeeId: '-', name: '-', hours: 0, tickets: 0, completed: 0, pending: 0, clientHours: [] }])
          .map((row) => [row.employeeId, row.name, fixed(row.hours), row.tickets, row.completed, row.pending, shortClientHours(row.clientHours)])
      }, tableOptions(7, 7));

      section('Completed Tickets - Client-wise Time', 'Only completed/closed tickets are included here.');
      doc.table({
        headers: ['Client', 'Completed Tickets', 'Work Hours', 'Worked By'],
        rows: (data.completedClientWise.length ? data.completedClientWise : [{ client: 'No completed tickets for this day', completed: 0, hours: 0, employees: '-' }])
          .map((row) => [row.client, row.completed, fixed(row.hours), row.employees])
      }, tableOptions(7, 7));

      section('Leave and Intimation');
      doc.table({
        headers: ['Type', 'Emp ID', 'Name', 'Sub Type', 'Status', 'Reason'],
        rows: [
          ...(data.leaveDetails.length ? data.leaveDetails : [{ employeeId: '-', name: '-', type: '-', status: '-', reason: 'No leave records.' }]).map((row) => ['Leave', row.employeeId, row.name, row.type, row.status, row.reason || '-']),
          ...(data.intimationDetails.length ? data.intimationDetails : [{ employeeId: '-', name: '-', type: '-', status: '-', reason: 'No intimation records.' }]).map((row) => ['Intimation', row.employeeId, row.name, row.type, row.status, row.reason || '-'])
        ]
      }, tableOptions(7, 7));

      section('Pending Approvals');
      doc.table({
        headers: ['Approval Type', 'Pending Count'],
        rows: [
          ['Tickets', data.approvals.ticket],
          ['Attendance', data.approvals.attendance],
          ['Leaves', data.approvals.leave],
          ['Intimations', data.approvals.intimation]
        ]
      }, tableOptions(8, 8));

      doc.moveDown(0.7);
      doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text('Notes: Hours come from ticket duration/working-hour fields. If duration is missing, hours show as 0.0. Leave employees are not counted as absent.', { align: 'left' }).fillColor('black');

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function buildWeeklySuperAdminReportAttachment({ readRows = listRows, now = new Date(), scopeEmployeeId = '' } = {}) {
  const models = ['User', 'Ticket', 'Todo', 'FmsTask', 'Attendance', 'Leave', 'Intimation', 'Client'];
  const values = await Promise.all(models.map((model) => readRows(model)));
  const rows = Object.fromEntries(models.map((model, index) => [model, values[index] || []]));
  const data = buildWeeklyReportData(rows, now, { scopeEmployeeId });
  const pdf = await renderPdf(data);
  return {
    message: `Weekly team report (${data.label}) is attached.\n\nTotal employees: ${data.totals.activeTeam}\nWorking days: ${data.totals.weekDays} (Mon-Sat)\nPresent employees: ${data.totals.presentEmployees}\nAbsent employees: ${data.totals.absentEmployees}\nLeave records: ${data.totals.leaves}\nIntimations: ${data.totals.intimations}\nCompleted tickets: ${data.totals.completedTickets}\nPending tickets: ${data.totals.pendingTickets}`,
    pdfAttachment: {
      base64: pdf.toString('base64'),
      fileName: `weekly-team-report-${data.end}.pdf`,
      contentType: 'application/pdf'
    }
  };
}

export async function buildDailyAdminReportAttachment({ readRows = listRows, now = new Date(), scopeEmployeeId = '' } = {}) {
  const models = ['User', 'Ticket', 'Attendance', 'Leave', 'Intimation', 'Client'];
  const values = await Promise.all(models.map((model) => readRows(model)));
  const rows = Object.fromEntries(models.map((model, index) => [model, values[index] || []]));
  const data = buildDailyAdminReportData(rows, now, { scopeEmployeeId });
  const pdf = await renderDailyAdminPdf(data);
  const noTickets = data.clientWise.length === 0;
  return {
    message: `Previous-day admin report (${data.day}) is attached.\n\nPresent employees: ${data.totals.attendanceDays}\nLeave requests: ${data.totals.leaves}\nIntimations: ${data.totals.intimations}\nPending approvals: ${data.totals.pendingApprovals}\nTickets for the day: ${data.totals.tickets}\n${noTickets ? '\nAlert: No client tickets were found for this day.' : `\nClient ticket groups: ${data.clientWise.length}`}`,
    pdfAttachment: {
      base64: pdf.toString('base64'),
      fileName: `daily-admin-report-${data.day}.pdf`,
      contentType: 'application/pdf'
    }
  };
}

export function isWeeklySuperAdminReportJob(job = {}) {
  return text(job.event).startsWith(WEEKLY_EVENT_PREFIX);
}

export function isDailyAdminReportJob(job = {}) {
  return text(job.event).startsWith(DAILY_ADMIN_EVENT_PREFIX);
}

export function weeklyReportDateForJob(job = {}, fallback = new Date()) {
  const day = text(job.event).replace(WEEKLY_EVENT_PREFIX, '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0]
    || text(job.entityId).replace(/^WEEK-/, '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
  return day ? new Date(`${day}T12:00:00+05:30`) : fallback;
}

export function dailyAdminReportDateForJob(job = {}, fallback = new Date()) {
  const day = text(job.event).replace(DAILY_ADMIN_EVENT_PREFIX, '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0]
    || text(job.entityId).replace(/^DAY-/, '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
  return day ? new Date(`${day}T12:00:00+05:30`) : fallback;
}

export async function queueWeeklySuperAdminReports({ readRows = listRows, now = new Date(), reportTime = process.env.WHATSAPP_WEEKLY_REPORT_TIME_IST || '09:00' } = {}) {
  const clock = istClock(now);
  if (istWeekday(now) !== 'Sun' || clock.time < reportTime) return 0;
  const users = await readRows('User');
  const weeklyRecipients = users.filter((user) => isActive(user) && WEEKLY_REPORT_EMPLOYEE_IDS.some((id) => id.toLowerCase() === employeeIdOf(user).toLowerCase()));
  if (!weeklyRecipients.length) return 0;
  const employeeIds = weeklyRecipients.map(employeeIdOf).filter(Boolean);
  const contacts = await WhatsAppContact.find({ enabled: true, employeeId: { $in: employeeIds } }).lean();
  let queued = 0;
  for (const contact of contacts) {
    if (!contact.alertTypes?.includes('attendance')) continue;
    const user = weeklyRecipients.find((item) => employeeIdOf(item) === contact.employeeId);
    if (!user) continue;
    const event = `${WEEKLY_EVENT_PREFIX}${clock.day}`;
    const key = hash(JSON.stringify([contact.employeeId, 'attendance', 'weekly-report', clock.day]));
    await WhatsAppAlertJob.updateOne(
      { key },
      { $setOnInsert: { key, employeeId: contact.employeeId, contactId: contact._id, alertType: 'attendance', entityId: `WEEK-${clock.day}`, event, message: `Weekly team report for ${weeklyReportWindow(now).label}`, state: 'pending' } },
      { upsert: true }
    );
    queued += 1;
  }
  return queued;
}

export async function queueDailyAdminReports({ readRows = listRows, now = new Date(), reportTime = process.env.WHATSAPP_DAILY_ADMIN_REPORT_TIME_IST || '06:00' } = {}) {
  const clock = istClock(now);
  if (clock.time < reportTime) return 0;
  const users = await readRows('User');
  const admins = users.filter((user) => isActive(user) && DAILY_REPORT_EMPLOYEE_IDS.some((id) => id.toLowerCase() === employeeIdOf(user).toLowerCase()));
  if (!admins.length) return 0;
  const employeeIds = admins.map(employeeIdOf).filter(Boolean);
  const contacts = await WhatsAppContact.find({ enabled: true, employeeId: { $in: employeeIds } }).lean();
  const reportDay = previousIstDay(now);
  let queued = 0;
  for (const contact of contacts) {
    if (!contact.alertTypes?.includes('attendance')) continue;
    const user = admins.find((item) => employeeIdOf(item) === contact.employeeId);
    if (!user) continue;
    const event = `${DAILY_ADMIN_EVENT_PREFIX}${reportDay}`;
    const key = hash(JSON.stringify([contact.employeeId, 'attendance', 'daily-admin-report', reportDay]));
    await WhatsAppAlertJob.updateOne(
      { key },
      { $setOnInsert: { key, employeeId: contact.employeeId, contactId: contact._id, alertType: 'attendance', entityId: `DAY-${reportDay}`, event, message: `Daily admin report for ${reportDay}`, state: 'pending' } },
      { upsert: true }
    );
    queued += 1;
  }
  return queued;
}


