import { attendanceSchedule, attendanceSnapshot } from './whatsappAttendanceSchedule.js';
import { requestApprovalDecision } from './approvals.service.js';
import { rowMessage, dailyMessage, noTicketAfterPresentMessage } from './whatsappTemplateRenderer.js';
const text = (value) => String(value ?? '').trim();
export const field = (row, keys) => keys.map((key) => text(row?.[key])).find(Boolean) || '';
export const employeeIdOf = (row) => field(row, ['Employee ID', 'User ID', 'EMP Code', 'EmpID', 'empId', 'employeeId']);
export const isActive = (user) => Boolean(user) && !/^(inactive|disabled|terminated|deleted)$/i.test(field(user, ['Status', 'status']));
export const statusOf = (row) => field(row, ['Status', 'status']);
export const isFinished = (row) => /^(completed|closed|done|approved|rejected|cancelled|canceled|resolved|inactive)$/i.test(statusOf(row)) || Boolean(field(row, ['Done Date', 'doneDate']));
export const entityOf = (row) => field(row, ['Ticket ID', 'Task ID', 'ExpenseID', 'AttendanceID', 'LeaveID', 'IntimationID', 'TodoID', 'ID', 'rowId']);
export function approversFor(row, users, model) {
  if (model === 'Ticket') return [employeeIdOf(row)].filter(Boolean);
  const owner = users.find((user) => employeeIdOf(user) === employeeIdOf(row));
  const eligible = users.filter((user) => isActive(user) && /^(admin|hr|super admin|manager)$/i.test(field(user, ['Role', 'role'])));
  // Expense approval is restricted to Admin/HR/Super Admin in the existing module.
  return eligible.filter((user) => model !== 'Expense' || !/^manager$/i.test(field(user, ['Role', 'role'])))
    .filter((user) => {
      if (employeeIdOf(user) === employeeIdOf(row)) return false;
      if (model === 'Expense') return !/^super admin$/i.test(field(owner, ['Role', 'role'])) || /^super admin$/i.test(field(user, ['Role', 'role']));
      const request = model === 'Attendance' ? { ...row, Status: field(row, ['Admin Approval', 'Status']) } : row;
      return requestApprovalDecision(user, request, users, model).actionable;
    }).map(employeeIdOf);
}

export function buildRowAlerts({ model, before, after }, users = []) {
  if (!['Ticket', 'Attendance', 'Expense', 'FmsTask', 'Leave', 'Intimation'].includes(model)) return [];
  if (model === 'Ticket' && /^(yes|true)$/i.test(field(after, ['Auto Ticket', 'Is Auto Ticket']))) return [];
  const employeeId = employeeIdOf(after);
  const entityId = entityOf(after);
  if (!employeeId || !entityId) return [];
  const events = [];
  const emit = (type, title, recipient = employeeId, suffix = '') => events.push({ employeeId: recipient, alertType: type, entityId, event: `${title}:${suffix}`, message: rowMessage({ model, before, after, recipient, users, type, title }) });
  const changed = before && statusOf(before) !== statusOf(after);
  if (model === 'Ticket') {
    if (!before || employeeIdOf(before) !== employeeId) emit('ticket', 'Ticket assigned');
    else if (changed) emit('ticket', `Ticket status: ${statusOf(before)} → ${statusOf(after)}`);
  }
  if (model === 'FmsTask') {
    if (!before || employeeIdOf(before) !== employeeId) emit('fms', 'FMS task assigned');
    else if (changed) emit('fms', `FMS task ${statusOf(after)}`);
  }
  if (model === 'Attendance' && !before) {
    const action = field(after, ['Action', 'action']);
    if (/punch\s*(in|out)/i.test(action)) emit('attendance', action);
  }
  if (model === 'Expense' && (!before || changed)) emit('expense', before ? `Expense ${statusOf(after)}` : 'Expense submitted');
  const approval = (row) => model === 'Attendance' ? field(row, ['Admin Approval']) : statusOf(row);
  const pending = (row) => model === 'Ticket' ? /^(pending approval|hr approved)$/i.test(approval(row)) : /^(pending|submitted|need approval)$/i.test(approval(row));
  const supportsApproval = ['Ticket', 'Attendance', 'Expense', 'Leave', 'Intimation'].includes(model);
  if (supportsApproval && pending(after) && (!before || !pending(before) || approval(before) !== approval(after) || field(before, ['Reassigned To', 'Task Approver']) !== field(after, ['Reassigned To', 'Task Approver']))) {
    for (const id of approversFor(after, users, model)) emit('approval', `${model} approval requested`, id);
  }
  if (supportsApproval && before && approval(before) !== approval(after) && /^(approved|hr approved|rejected|rework|closed)$/i.test(approval(after))) emit('approval', `${model} ${approval(after)}`);
  return events;
}

export function istClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function dateKey(value) {
  const s = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const d = new Date(s);
  return s && Number.isFinite(d.getTime()) ? istClock(d).day : '';
}

function isHoliday(rows = {}, day = '') {
  return (rows.Holiday || []).some((row) => {
    const status = field(row, ['Status', 'status']);
    const holidayDay = dateKey(field(row, ['Date', 'Holiday Date', 'holidayDate', 'date']));
    return holidayDay === day && !/^(inactive|deleted|cancelled|canceled)$/i.test(status);
  });
}
function ticketDay(row) {
  return dateKey(field(row, ['Plan Date', 'planDate', 'Date', 'Ticket Date', 'Created Date', 'Created At', 'createdAt', 'Timestamp', 'timestamp']));
}

function hasTicketForDay(rows, employeeId, day) {
  return (rows.Ticket || []).some((row) => employeeIdOf(row) === employeeId
    && !/^(yes|true)$/i.test(field(row, ['Auto Ticket', 'Is Auto Ticket']))
    && !/^(cancelled|canceled|deleted|inactive)$/i.test(statusOf(row))
    && ticketDay(row) === day);
}

function noTicketAfterPresentAlerts(rows, now, day) {
  const cutoffMs = 30 * 60_000;
  return attendanceSnapshot(rows, day, now.getTime())
    .filter((state) => state.hasIn && Number.isFinite(state.punchInAt) && now.getTime() >= state.punchInAt + cutoffMs)
    .filter((state) => !hasTicketForDay(rows, employeeIdOf(state.user), day))
    .map((state) => ({
      employeeId: employeeIdOf(state.user),
      alertType: 'reminder',
      entityId: day,
      event: `no-ticket-after-present:${day}`,
      message: noTicketAfterPresentMessage(state.user, day, state.punchInAt, now)
    }));
}

export function buildDailyAlerts(rows, now = new Date(), reminderTime = '10:00', missedOutTime = process.env.WHATSAPP_MISSED_OUT_TIME_IST || '18:15') {
  const { day, time } = istClock(now);
  if (new Date(`${day}T12:00:00+05:30`).getUTCDay() === 0 || isHoliday(rows, day)) return [];
  const events = [];
  const activeEmployeeIds = new Set((rows.User || []).filter(isActive).map(employeeIdOf));
  if (time >= reminderTime) {
    const groups = new Map();
    for (const model of ['Ticket', 'Todo', 'FmsTask']) for (const row of rows[model] || []) {
      if (isFinished(row) || !activeEmployeeIds.has(employeeIdOf(row)) || /^(yes|true)$/i.test(field(row, ['Auto Ticket', 'Is Auto Ticket']))) continue;
      // Waiting for an approver is not an actionable task reminder for the assignee.
      if (model === 'Ticket' && /^(pending approval|hr approved)$/i.test(statusOf(row))) continue;
      const due = dateKey(field(row, model === 'Todo' ? ['Due Date', 'dueDate', 'Date'] : ['Plan Date', 'planDate', 'Date', 'Due Date']));
      if (due && due > day) continue;
      const alertType = 'reminder';
      const employeeId = employeeIdOf(row);
      const key = employeeId;
      if (!groups.has(key)) groups.set(key, { employeeId, alertType, items: [] });
      groups.get(key).items.push({ model, row });
    }
    for (const { employeeId, alertType, items } of groups.values()) events.push({ employeeId, alertType, entityId: day, event: `pending-tasks:${day}`, message: dailyMessage(rows.User.find((user) => employeeIdOf(user) === employeeId), items, day, now) });
  }
  events.push(...noTicketAfterPresentAlerts(rows, now, day));
  events.push(...attendanceSchedule(rows, now, { day, time }, { missedIn: process.env.WHATSAPP_MISSED_IN_TIME_IST || '10:15', missedOut: missedOutTime, summary: process.env.WHATSAPP_ATTENDANCE_SUMMARY_TIME_IST || '10:30' }));
  return events;
}


