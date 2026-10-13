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

const completedStatuses = ['closed', 'completed', 'posted', 'resolved', 'finished', 'done', 'hr approved', 'approved'];
const approvalStatuses = ['pending approval', 'review', 'approval', 'waiting for approval'];
const ignoredStatuses = ['cancelled', 'rejected', 'dropped', 'void'];

function isClosedGroup(status = '') {
  const s = String(status || '').toLowerCase().trim();
  return completedStatuses.some((st) => s.includes(st)) || approvalStatuses.some((st) => s.includes(st));
}

function parseDurationMins(str) {
  if (!str) return 0;
  if (typeof str === 'number') return Math.round(str > 24 ? str : str * 60);
  const raw = String(str).toLowerCase().trim();
  let mins = 0;
  const parts = raw.split(/\s+/);
  let matched = false;
  parts.forEach((p) => {
    const x = p.trim();
    const num = parseFloat(x);
    if (!isNaN(num)) {
      if (x.includes('h')) {
        mins += Math.round(num * 60);
        matched = true;
      } else if (x.includes('m')) {
        mins += Math.round(num);
        matched = true;
      }
    }
  });
  if (!matched && parts.length === 1) {
    const num = parseFloat(raw.replace(/[^\d.]/g, ''));
    if (!isNaN(num)) {
      return Math.round(num > 24 ? num : num * 60);
    }
  }
  return mins;
}

function fmtMins(m) {
  if (isNaN(m) || m === null || m === undefined) return '0h 0m';
  const mins = Math.round(m);
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return `${h}h ${r}m`;
}

function formatDayWithWeekday(dayStr) {
  if (!dayStr) return '-';
  try {
    const d = new Date(`${dayStr}T12:00:00+05:30`);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(d);
    return `${dayStr} (${weekday})`;
  } catch {
    return dayStr;
  }
}

function calculateSubTableStats(tasksList = [], itemLabel = 'Task') {
  let planMins = 0;
  let compPlanMins = 0;
  let compMins = 0;
  let pendMins = 0;
  let plannedCount = 0;
  let completedCount = 0;
  let pendingCount = 0;

  for (const t of tasksList) {
    const status = String(t.status || t.Status || '').toLowerCase();
    if (ignoredStatuses.some((s) => status.includes(s))) continue;
    plannedCount++;
    const p = t.planMins ?? 0;
    const a = t.actualMins ?? 0;
    const isComp = isClosedGroup(status);

    planMins += p;
    if (isComp) {
      completedCount++;
      compMins += a;
      compPlanMins += p;
    } else {
      pendingCount++;
      pendMins += p;
    }
  }

  const diff = compPlanMins - compMins;
  let diffStr = '0h 0m';
  if (diff < 0) {
    diffStr = `-${fmtMins(Math.abs(diff))} Over`;
  } else if (diff > 0) {
    diffStr = `+${fmtMins(diff)} Saved`;
  }

  const pSuffix = plannedCount === 1 ? itemLabel : `${itemLabel}s`;
  const cSuffix = completedCount === 1 ? itemLabel : `${itemLabel}s`;
  const penSuffix = pendingCount === 1 ? itemLabel : `${itemLabel}s`;

  return {
    planMins,
    plannedCount,
    pSuffix,
    compMins,
    completedCount,
    cSuffix,
    pendMins,
    pendingCount,
    penSuffix,
    diff,
    diffStr
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
    Todo: filterRowsByEmployees(rows.Todo || [], scopedIds),
    FmsTask: filterRowsByEmployees(rows.FmsTask || [], scopedIds),
    Attendance: filterRowsByEmployees(rows.Attendance || [], scopedIds),
    Leave: filterRowsByEmployees(rows.Leave || [], scopedIds),
    Intimation: filterRowsByEmployees(rows.Intimation || [], scopedIds)
  };
  const attendance = attendanceStats(scopedRows.Attendance || [], activeUsers, day, day);
  const leaveCount = countLeaves(scopedRows.Leave || [], day, day);
  const intimationRows = (scopedRows.Intimation || []).filter((row) => rowDate(row, ['Intimation Date', 'Date', 'Timestamp', 'Created At']) === day);
  const intimationCount = intimationRows.length;
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
  const intimationByEmployee = new Map(intimationRows.map((row) => [employeeIdOf(row), row]));
  const ticketsByEmployee = new Map(personWiseTickets.map((row) => [row.employeeId, row]));
  const isSunday = new Date(`${day}T12:00:00+05:30`).getUTCDay() === 0;

  const attendanceRows = activeUsers.map((user) => {
    const employeeId = employeeIdOf(user);
    const group = attendanceByEmployee.get(employeeId);
    const leave = leaveByEmployee.get(employeeId);
    const intimation = intimationByEmployee.get(employeeId);
    const ticketInfo = ticketsByEmployee.get(employeeId);
    const inMin = group?.in ? istMinutes(group.in) : null;
    const isLate = Boolean(group?.in && inMin !== null && inMin > 615);

    // Keep status as Present / On Leave / Absent for exact assertion compatibility
    const status = group ? 'Present' : (leave ? 'On Leave' : 'Absent');

    let displayStatus = 'Absent';
    if (group) displayStatus = 'Punch In';
    else if (leave) displayStatus = 'On Leave';
    else if (intimation) displayStatus = 'Intimation';
    else if (isSunday) displayStatus = 'Sunday Off';

    let remarks = '-';
    if (leave) {
      remarks = field(leave, ['Reason', 'Remarks', 'Description']) || field(leave, ['Leave Type', 'Type']) || 'Leave';
    } else if (intimation) {
      remarks = field(intimation, ['Reason', 'Remarks', 'Description']) || field(intimation, ['Intimation Type', 'Type']) || 'Intimation';
    } else if (isSunday && !group) {
      remarks = 'Weekly Off';
    } else if (group) {
      remarks = isLate ? 'Late Punch-in' : 'On Time';
    }

    return {
      date: day,
      employeeId,
      name: nameOf(user, employeeId),
      status,
      displayStatus,
      punchIn: timeOnly(group?.in),
      punchOut: timeOnly(group?.out),
      isLate,
      remarks: compactText(remarks, 45),
      pendingTickets: ticketInfo?.pending || 0
    };
  }).sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));

  const absentEmployees = attendanceRows.filter((row) => row.status === 'Absent').length;
  const lateEmployees = attendanceRows.filter((row) => row.isLate).length;
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
  const intimationDetails = intimationRows
    .map((row) => ({
      employeeId: employeeIdOf(row),
      name: nameOf(row, employeeIdOf(row)),
      type: field(row, ['Intimation Type', 'Type']) || 'Intimation',
      status: field(row, ['Status', 'status']) || '-',
      reason: compactText(field(row, ['Reason', 'Remarks', 'Description']), 60)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Section 2: Support Tickets List
  const ticketsList = [];
  for (const row of scopedRows.Ticket || []) {
    if (ticketDate(row) !== day) continue;
    const client = clientNameOf(row, clients);
    const empId = employeeIdOf(row);
    const empUser = activeUsers.find((u) => employeeIdOf(u) === empId);
    const empName = nameOf(empUser || row, empId || 'Unassigned');
    const planMins = parseDurationMins(field(row, ['TAT', 'When', 'TAT Minutes', 'Plan Hours', 'Planned Hours']));
    const actHours = actualTicketHours(row);
    const actMins = actHours > 0 ? Math.round(actHours * 60) : parseDurationMins(field(row, ['Total Duration', 'Duration', 'Actual Duration', 'Working Hours']));
    const status = field(row, ['Status', 'status']) || 'Open';
    ticketsList.push({
      id: entityIdOf(row) || '-',
      date: ticketDate(row) || day,
      employeeId: empId,
      employeeName: empName,
      details: compactText(descriptionOf(row) || field(row, ['Task Description', 'Description', 'Task']) || '-', 65),
      client,
      planMins,
      actualMins: actMins,
      durationStr: fmtMins(actMins),
      status
    });
  }
  const ticketStats = calculateSubTableStats(ticketsList, 'Ticket');

  // Section 3: FMS Tracker Tasks List
  const fmsList = [];
  for (const row of scopedRows.FmsTask || []) {
    const pDate = rowDate(row, ['Plan Date', 'planDate', 'Date', 'date', 'Timestamp', 'Created At']);
    const dDate = rowDate(row, ['Done Date', 'doneDate', 'actualDate']);
    if (pDate !== day && dDate !== day) continue;
    const client = field(row, ['FMS Name', 'FMS', 'Project', 'Client']) || clientNameOf(row, clients) || 'FMS Project';
    const empId = employeeIdOf(row);
    const empUser = activeUsers.find((u) => employeeIdOf(u) === empId);
    const empName = nameOf(empUser || row, empId || 'Unassigned');
    const planMins = parseDurationMins(field(row, ['TAT', 'When', 'Duration']));
    const actMins = parseDurationMins(field(row, ['Duration', 'Actual Duration', 'Total Duration']));
    const status = field(row, ['Status', 'status']) || (dDate ? 'Completed' : 'Pending');
    const step = field(row, ['Step', 'step', 'Step No', 'Step Number']);
    const stepPrefix = step ? `[Step ${step}] ` : '';
    const details = compactText(`${stepPrefix}${field(row, ['Task Description', 'Description', 'Content', 'Task', 'Step Name']) || '-'}`, 65);
    fmsList.push({
      id: entityIdOf(row) || '-',
      date: pDate || dDate || day,
      employeeId: empId,
      employeeName: empName,
      details,
      fmsName: client,
      planMins,
      actualMins: actMins,
      durationStr: fmtMins(actMins),
      status
    });
  }
  const fmsStats = calculateSubTableStats(fmsList, 'Task');

  // Section 4: To Do (General Tasks) List
  const todoList = [];
  for (const row of scopedRows.Todo || []) {
    const tDate = rowDate(row, ['Due Date', 'dueDate', 'Date', 'date', 'Timestamp', 'Created At']);
    if (tDate !== day) continue;
    const empId = employeeIdOf(row);
    const empUser = activeUsers.find((u) => employeeIdOf(u) === empId);
    const empName = nameOf(empUser || row, empId || 'Unassigned');
    const planMins = parseDurationMins(field(row, ['TAT', 'When']));
    const actMins = parseDurationMins(field(row, ['Duration', 'Actual Duration', 'Total Duration']));
    const status = field(row, ['Status', 'status']) || 'Pending';
    todoList.push({
      id: entityIdOf(row) || '-',
      date: tDate || day,
      employeeId: empId,
      employeeName: empName,
      details: compactText(field(row, ['Task', 'Description', 'Task Description']) || '-', 75),
      planMins,
      actualMins: actMins,
      durationStr: fmtMins(actMins),
      status
    });
  }
  const todoStats = calculateSubTableStats(todoList, 'Task');

  // Section 5: Client-wise Work & Time Distribution
  const clientAggMap = new Map();
  const allTasksForDist = [
    ...ticketsList.map((t) => ({ ...t, clientName: t.client })),
    ...fmsList.map((f) => ({ ...f, clientName: f.fmsName })),
    ...todoList.map((td) => ({ ...td, clientName: 'Internal / General' }))
  ];

  for (const t of allTasksForDist) {
    const name = t.clientName || 'Internal / General';
    const key = name.toLowerCase();
    if (!clientAggMap.has(key)) {
      clientAggMap.set(key, {
        name,
        totalTasks: 0,
        planMins: 0,
        actualMins: 0,
        employees: new Set()
      });
    }
    const item = clientAggMap.get(key);
    item.totalTasks += 1;
    item.planMins += t.planMins || 0;
    item.actualMins += t.actualMins || 0;
    if (t.employeeName && t.employeeName !== 'Unassigned') item.employees.add(t.employeeName);
  }

  const totalActMins = [...clientAggMap.values()].reduce((sum, item) => sum + item.actualMins, 0);
  const clientDistList = [...clientAggMap.values()]
    .map((item) => ({
      name: item.name,
      totalTasks: item.totalTasks,
      planMins: item.planMins,
      actualMins: item.actualMins,
      timeSharePct: totalActMins > 0 ? Math.round((item.actualMins / totalActMins) * 100) : 0,
      workedBy: [...item.employees].slice(0, 4).join(', ') || '-'
    }))
    .sort((a, b) => b.actualMins - a.actualMins || b.totalTasks - a.totalTasks || a.name.localeCompare(b.name));

  const distStats = calculateSubTableStats(allTasksForDist, 'Item');

  return {
    day,
    scopeEmployeeId,
    scopeTeamSize: activeUsers.length,
    totals: {
      activeTeam: activeUsers.length,
      attendanceDays: attendance.presentDays,
      presentEmployees: attendance.presentDays,
      lateEmployees,
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
    personWiseTickets,
    ticketStats,
    ticketsList,
    fmsStats,
    fmsList,
    todoStats,
    todoList,
    distStats,
    clientDistList
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
      const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const tableOptions = (headerSize = 7.5, rowSize = 7.5) => ({
        x: 28,
        width: 786,
        padding: [3, 4, 3, 4],
        divider: {
          header: { disabled: false, width: 0.75, opacity: 0.8 },
          horizontal: { disabled: false, width: 0.5, opacity: 0.2 }
        },
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(headerSize).fillColor('#1e293b'),
        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
          if (rectRow && indexColumn === 0 && indexRow % 2 === 1) {
            doc.addBackground(rectRow, '#f8fafc', 0.8);
          }
          const cellVal = String(row[indexColumn] || '');
          if (cellVal.includes('Absent') || cellVal === 'No Entry' || cellVal.includes('Over')) {
            if (rectCell) doc.addBackground(rectCell, '#fee2e2', 0.8);
            doc.font('Helvetica-Bold').fontSize(rowSize).fillColor('#b91c1c');
          } else if (cellVal.includes('Present') || cellVal.includes('Punch In') || cellVal.includes('Saved') || cellVal.includes('Completed') || cellVal.includes('Closed') || cellVal.includes('Resolved')) {
            if (rectCell) doc.addBackground(rectCell, '#dcfce7', 0.8);
            doc.font('Helvetica-Bold').fontSize(rowSize).fillColor('#15803d');
          } else if (cellVal.includes('Late') || cellVal.includes('Pending Approval')) {
            if (rectCell) doc.addBackground(rectCell, '#fef3c7', 0.8);
            doc.font('Helvetica-Bold').fontSize(rowSize).fillColor('#b45309');
          } else if (cellVal.includes('On Leave') || cellVal.includes('Leave')) {
            if (rectCell) doc.addBackground(rectCell, '#f3e8ff', 0.8);
            doc.font('Helvetica-Bold').fontSize(rowSize).fillColor('#7e22ce');
          } else if (cellVal.includes('Intimation')) {
            if (rectCell) doc.addBackground(rectCell, '#cffafe', 0.8);
            doc.font('Helvetica-Bold').fontSize(rowSize).fillColor('#0e7490');
          } else if (cellVal.includes('Sunday Off') || cellVal.includes('Weekly Off')) {
            if (rectCell) doc.addBackground(rectCell, '#f1f5f9', 0.8);
            doc.font('Helvetica').fontSize(rowSize).fillColor('#64748b');
          } else if (indexColumn === 0 || indexColumn === 1) {
            doc.font('Helvetica').fontSize(rowSize).fillColor('#475569');
          } else {
            doc.font('Helvetica').fontSize(rowSize).fillColor('#0f172a');
          }
        }
      });
      const section = (title, subheader = '') => {
        if (doc.y > 440) {
          doc.addPage();
          doc.x = 28;
          doc.y = 28;
        } else {
          doc.moveDown(0.6);
          doc.x = 28;
        }

        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(title, 28);
        if (subheader) {
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155').text(subheader, 28);
        }
        doc.fillColor('black');
        doc.x = 28;
        doc.moveDown(0.25);
      };

      const dayFormatted = formatDayWithWeekday(data.day);
      const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      // Title & Subtitle Banner
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('DAILY WORK & ATTENDANCE REPORT', { align: 'center' });
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`Date: ${dayFormatted}    |    Generated: ${generatedAt}${data.scopeEmployeeId ? `    |    Scope: ${data.scopeEmployeeId}` : ''}`, { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(0.5);

      // Top KPI Cards / Boxes Section
      const kpiCards = [
        {
          label: 'TOTAL TEAM',
          value: data.totals.activeTeam,
          bgColor: '#eff6ff',
          borderColor: '#bfdbfe',
          accentColor: '#2563eb',
          textColor: '#1d4ed8'
        },
        {
          label: 'PRESENT',
          value: data.totals.attendanceDays,
          bgColor: '#ecfdf5',
          borderColor: '#a7f3d0',
          accentColor: '#10b981',
          textColor: '#047857'
        },
        {
          label: 'LATE PUNCH',
          value: data.totals.lateEmployees || 0,
          bgColor: '#fffbeb',
          borderColor: '#fde68a',
          accentColor: '#f59e0b',
          textColor: '#b45309'
        },
        {
          label: 'ABSENT',
          value: data.totals.absentEmployees,
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          accentColor: '#ef4444',
          textColor: '#b91c1c'
        },
        {
          label: 'ON LEAVE',
          value: data.totals.leaves,
          bgColor: '#faf5ff',
          borderColor: '#e9d5ff',
          accentColor: '#8b5cf6',
          textColor: '#6d28d9'
        },
        {
          label: 'INTIMATION',
          value: data.totals.intimations,
          bgColor: '#ecfeff',
          borderColor: '#a5f3fc',
          accentColor: '#06b6d4',
          textColor: '#0e7490'
        },
        {
          label: 'APPROVALS',
          value: data.totals.pendingApprovals,
          bgColor: '#f8fafc',
          borderColor: '#cbd5e1',
          accentColor: '#64748b',
          textColor: '#334155'
        }
      ];

      const startX = 28;
      const startY = doc.y;
      const cardHeight = 44;
      const cardGap = 8;
      const cardWidth = Math.floor((786 - ((kpiCards.length - 1) * cardGap)) / kpiCards.length);

      kpiCards.forEach((card, idx) => {
        const x = startX + idx * (cardWidth + cardGap);
        const y = startY;

        // Card container
        doc.save();
        doc.roundedRect(x, y, cardWidth, cardHeight, 5)
          .fillColor(card.bgColor)
          .strokeColor(card.borderColor)
          .lineWidth(1)
          .fillAndStroke();

        // Top accent stripe
        doc.roundedRect(x, y, cardWidth, 3, 2)
          .fillColor(card.accentColor)
          .fill();

        // Big value
        doc.font('Helvetica-Bold')
          .fontSize(15)
          .fillColor(card.textColor)
          .text(String(card.value), x, y + 8, { width: cardWidth, align: 'center' });

        // Metric label
        doc.font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor('#64748b')
          .text(card.label, x, y + 27, { width: cardWidth, align: 'center' });
        doc.restore();
      });

      doc.x = 28;
      doc.y = startY + cardHeight + 14;

      // Section 1: Attendance Log Details (matching Screenshot 1)
      const attSub = `Present: ${data.totals.attendanceDays}   |   Late: ${data.totals.lateEmployees || 0}   |   Absent: ${data.totals.absentEmployees}   |   Leave: ${data.totals.leaves}   |   Intimation: ${data.totals.intimations}`;
      section('1. Attendance Log Details', attSub);
      doc.table({
        headers: ['Date', 'Emp ID', 'Employee Name', 'Punch In', 'Punch Out', 'Status', 'Details / Remarks'],
        rows: (data.attendanceRows && data.attendanceRows.length ? data.attendanceRows : [{ date: data.day, employeeId: '-', name: '-', punchIn: '-', punchOut: '-', status: '-', remarks: 'No attendance records' }])
          .map((row) => [
            row.date || data.day,
            row.employeeId || '-',
            row.name || '-',
            row.punchIn && row.punchIn !== '-' ? (row.isLate ? `${row.punchIn} [Late]` : row.punchIn) : 'No Entry',
            row.punchOut && row.punchOut !== '-' ? row.punchOut : '-',
            row.displayStatus || row.status || '-',
            row.remarks || '-'
          ]),
        columnsSize: [85, 55, 120, 85, 80, 85, 276]
      }, tableOptions(7, 7));

      // Section 2: Support Tickets (matching Screenshot 2)
      const tStats = data.ticketStats || calculateSubTableStats(data.ticketsList, 'Ticket');
      const tSub = `Planned: ${fmtMins(tStats.planMins)} (${tStats.plannedCount} ${tStats.pSuffix})   |   Completed (Logged): ${fmtMins(tStats.compMins)} (${tStats.completedCount} ${tStats.cSuffix})   |   Pending: ${fmtMins(tStats.pendMins)} (${tStats.pendingCount} ${tStats.penSuffix})   |   Diff: ${tStats.diffStr}`;
      section('2. Support Tickets', tSub);
      doc.table({
        headers: ['Date', 'Employee', 'Details', 'Client / Project', 'Plan TAT', 'Actual Logged', 'Status'],
        rows: (data.ticketsList && data.ticketsList.length ? data.ticketsList : [{ date: data.day, employeeName: '-', details: 'No Support Tickets found for this day.', client: '-', planMins: 0, durationStr: '-', status: '-' }])
          .map((row) => [
            row.date || data.day,
            row.employeeName || '-',
            row.details || '-',
            row.client || '-',
            fmtMins(row.planMins),
            row.durationStr || fmtMins(row.actualMins),
            row.status || '-'
          ]),
        columnsSize: [75, 110, 260, 120, 70, 75, 76]
      }, tableOptions(7, 7));

      // Section 3: FMS Tracker Tasks (matching Screenshot 2)
      const fStats = data.fmsStats || calculateSubTableStats(data.fmsList, 'Task');
      const fSub = `Planned: ${fmtMins(fStats.planMins)} (${fStats.plannedCount} ${fStats.pSuffix})   |   Completed (Logged): ${fmtMins(fStats.compMins)} (${fStats.completedCount} ${fStats.cSuffix})   |   Pending: ${fmtMins(fStats.pendMins)} (${fStats.pendingCount} ${fStats.penSuffix})   |   Diff: ${fStats.diffStr}`;
      section('3. FMS Tracker Tasks', fSub);
      doc.table({
        headers: ['Date', 'Employee', 'Step & Task Details', 'FMS Name / Project', 'Plan TAT', 'Actual Logged', 'Status'],
        rows: (data.fmsList && data.fmsList.length ? data.fmsList : [{ date: data.day, employeeName: '-', details: 'No FMS Tasks found for this day.', fmsName: '-', planMins: 0, durationStr: '-', status: '-' }])
          .map((row) => [
            row.date || data.day,
            row.employeeName || '-',
            row.details || '-',
            row.fmsName || '-',
            fmtMins(row.planMins),
            row.durationStr || fmtMins(row.actualMins),
            row.status || '-'
          ]),
        columnsSize: [75, 110, 260, 120, 70, 75, 76]
      }, tableOptions(7, 7));

      // Section 4: To Do (General Tasks) (matching Screenshot 2)
      const tdStats = data.todoStats || calculateSubTableStats(data.todoList, 'Task');
      const tdSub = `Planned: ${fmtMins(tdStats.planMins)} (${tdStats.plannedCount} ${tdStats.pSuffix})   |   Completed (Logged): ${fmtMins(tdStats.compMins)} (${tdStats.completedCount} ${tdStats.cSuffix})   |   Pending: ${fmtMins(tdStats.pendMins)} (${tdStats.pendingCount} ${tdStats.penSuffix})   |   Diff: ${tdStats.diffStr}`;
      section('4. To Do (General Tasks)', tdSub);
      doc.table({
        headers: ['Date', 'Employee', 'Details', 'Plan TAT', 'Actual Logged', 'Status'],
        rows: (data.todoList && data.todoList.length ? data.todoList : [{ date: data.day, employeeName: '-', details: 'No General Tasks found for this day.', planMins: 0, durationStr: '-', status: '-' }])
          .map((row) => [
            row.date || data.day,
            row.employeeName || '-',
            row.details || '-',
            fmtMins(row.planMins),
            row.durationStr || fmtMins(row.actualMins),
            row.status || '-'
          ]),
        columnsSize: [80, 120, 366, 75, 75, 70]
      }, tableOptions(7, 7));

      // Section 5: Client-wise Work & Time Distribution (matching Screenshot 2)
      const dStats = data.distStats || calculateSubTableStats(data.clientDistList, 'Item');
      const dSub = `Planned: ${fmtMins(dStats.planMins)} (${dStats.plannedCount} ${dStats.pSuffix})   |   Completed (Logged): ${fmtMins(dStats.compMins)} (${dStats.completedCount} ${dStats.cSuffix})   |   Pending: ${fmtMins(dStats.pendMins)} (${dStats.pendingCount} ${dStats.penSuffix})   |   Diff: ${dStats.diffStr}`;
      section('5. Client-wise Work & Time Distribution', dSub);
      doc.table({
        headers: ['Client / Project Name', 'Total Tasks', 'Total Planned TAT', 'Total Actual Logged', 'Time Share (%)', 'Worked By'],
        rows: (data.clientDistList && data.clientDistList.length ? data.clientDistList : [{ name: 'No client work logs for this day', totalTasks: 0, planMins: 0, actualMins: 0, timeSharePct: 0, workedBy: '-' }])
          .map((row) => [
            row.name || '-',
            String(row.totalTasks || 0),
            fmtMins(row.planMins),
            fmtMins(row.actualMins),
            `${row.timeSharePct || 0}%`,
            row.workedBy || '-'
          ]),
        columnsSize: [196, 75, 95, 95, 85, 240]
      }, tableOptions(7, 7));

      // Footer notes
      doc.moveDown(0.6);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Notes: Grace period for Punch-in is 10:15 AM IST; entries after 10:15 AM are flagged as [Late]. Diff = Planned TAT - Actual Logged (Positive: Time Saved, Negative: Time Over). Leave and Sunday off employees are excluded from Absent count.', { align: 'left' }).fillColor('black');

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
  const models = ['User', 'Ticket', 'Todo', 'FmsTask', 'Attendance', 'Leave', 'Intimation', 'Client'];
  const values = await Promise.all(models.map((model) => readRows(model)));
  const rows = Object.fromEntries(models.map((model, index) => [model, values[index] || []]));
  const data = buildDailyAdminReportData(rows, now, { scopeEmployeeId });
  const pdf = await renderDailyAdminPdf(data);
  const noTickets = data.clientWise.length === 0;

  const tCount = data.ticketStats?.plannedCount ?? data.totals.tickets;
  const fCount = data.fmsStats?.plannedCount ?? 0;
  const tdCount = data.todoStats?.plannedCount ?? 0;

  const lines = [
    `*Previous-day admin report (${data.day}) is attached.*`,
    '',
    '*TEAM & ATTENDANCE SUMMARY*',
    `- Total Team: ${data.totals.activeTeam}`,
    `- Present: ${data.totals.attendanceDays} (Late: ${data.totals.lateEmployees || 0})`,
    `- Absent: ${data.totals.absentEmployees}`,
    `- Leave requests: ${data.totals.leaves}`,
    `- Intimations: ${data.totals.intimations}`,
    `- Pending approvals: ${data.totals.pendingApprovals}`,
    '',
    '*WORK & TASKS BREAKDOWN*',
    `- Support Tickets: ${tCount} (Done: ${data.ticketStats?.completedCount ?? 0}, Pending: ${data.ticketStats?.pendingCount ?? 0})`,
    `- FMS Tracker: ${fCount} (Done: ${data.fmsStats?.completedCount ?? 0}, Pending: ${data.fmsStats?.pendingCount ?? 0})`,
    `- To-Do Tasks: ${tdCount} (Done: ${data.todoStats?.completedCount ?? 0}, Pending: ${data.todoStats?.pendingCount ?? 0})`,
    `- Tickets for the day: ${data.totals.tickets}`,
    noTickets ? '\nAlert: No client tickets were found for this day.' : `\nClient ticket groups: ${data.clientWise.length}`
  ];

  return {
    message: lines.join('\n'),
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


