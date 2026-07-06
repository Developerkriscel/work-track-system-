import express from 'express';
import XLSX from 'xlsx';
import {
  deleteOrDeactivate,
  insertRow,
  isClosedStatus,
  listRows,
  resetLegacyStore,
  resetMemoryStore,
  sheetAttendance,
  sheetClient,
  sheetFms,
  sheetInvoice,
  sheetMessage,
  sheetTicket,
  sheetTodo,
  sheetUser,
  upsertRow
} from '../services/legacyStore.service.js';
import { saveBase64File } from '../services/fileStorage.service.js';

const router = express.Router();
const referenceDate = new Date(`${process.env.WORKTRACK_REFERENCE_DATE || '2026-07-03'}T12:00:00+05:30`);
const referenceNow = () => new Date(referenceDate);
const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const today = () => localDate(referenceNow());
const nowIso = () => referenceNow().toISOString();
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const safe = (v) => String(v ?? '').trim();
const eq = (a, b) => safe(a).toLowerCase() === safe(b).toLowerCase();
const num = (v) => Number(String(v ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const first = (row, keys, fallback = '') => keys.map((k) => row?.[k]).find((v) => safe(v)) ?? fallback;
const isUserCompletedStatus = (status) => isClosedStatus(status) || /pending approval/i.test(safe(status));
const isDashboardActionableStatus = (status) => !isClosedStatus(status) && !/pending approval/i.test(safe(status));

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const cleanFileName = (value, fallback = 'report') => String(value || fallback).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');

function dateInRange(value, start, end) {
  if (!start || !end || !value) return true;
  const d = normalizedDate(value);
  return d >= start && d <= end;
}

function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(title, headers, sourceRows) {
  const lines = [
    String(title || 'Report'),
    `Generated: ${referenceNow().toLocaleString('en-IN')}`,
    '',
    headers.join(' | ')
  ];

  for (const row of sourceRows.slice(0, 150)) {
    const raw = headers.map((h) => String(row[h] ?? '').replace(/\s+/g, ' ').trim()).join(' | ');
    for (let i = 0; i < raw.length; i += 105) lines.push(raw.slice(i, i + 105));
  }

  if (sourceRows.length > 150) lines.push('', `Showing first 150 of ${sourceRows.length} rows.`);

  const pageHeight = 792;
  const pageWidth = 612;
  const marginX = 36;
  const startY = 748;
  const lineHeight = 12;
  const content = ['BT', '/F1 9 Tf', `${marginX} ${startY} Td`];
  lines.slice(0, 58).forEach((line, index) => {
    if (index) content.push(`0 -${lineHeight} Td`);
    content.push(`(${pdfEscape(line)}) Tj`);
  });
  content.push('ET');

  const stream = content.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function ymd(date) {
  return localDate(date);
}

function rangeForFilter(range = 'today') {
  const now = referenceNow();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const key = safe(range).toLowerCase().replace(/-/g, '_');
  if (key === 'yesterday') {
    const date = addDays(startOfToday, -1);
    return { start: ymd(date), end: ymd(date) };
  }
  if (key === 'week' || key === 'this_week') {
    const day = startOfToday.getDay();
    const diff = startOfToday.getDate() - day + (day === 0 ? -6 : 1);
    return { start: ymd(new Date(startOfToday.getFullYear(), startOfToday.getMonth(), diff)), end: ymd(startOfToday) };
  }
  if (key === 'last_week') {
    const day = startOfToday.getDay();
    const thisMonday = new Date(startOfToday);
    thisMonday.setDate(startOfToday.getDate() - day + (day === 0 ? -6 : 1));
    const lastMonday = addDays(thisMonday, -7);
    return { start: ymd(lastMonday), end: ymd(addDays(lastMonday, 6)) };
  }
  if (key === 'month' || key === 'this_month') {
    return { start: ymd(new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1)), end: ymd(startOfToday) };
  }
  if (key === 'last_month') {
    return {
      start: ymd(new Date(startOfToday.getFullYear(), startOfToday.getMonth() - 1, 1)),
      end: ymd(new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 0))
    };
  }
  if (key === 'all' || key === 'all_time') return { start: '', end: '' };
  return { start: ymd(startOfToday), end: ymd(startOfToday) };
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

function localTimeHms(date = referenceNow()) {
  return date.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

function normalizeAttachmentField(value, folderName = 'tickets') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      return saveBase64File(item, folderName);
    })
    .filter(Boolean)
    .join(',');
}

function normalizedDate(value) {
  if (!value) return today();
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
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

function timestampFromElapsedMinutes(minutes) {
  const value = num(minutes);
  if (!value) return '';
  return new Date(Date.now() - value * 60000).toISOString();
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
    .sort((a, b) => attendanceEventTime(b) - attendanceEventTime(a));
  const latest = todayRows[0];
  if (!latest) return false;
  const action = safe(latest.Action);
  if (/punch\s*out/i.test(action)) return false;
  if (/punch\s*in/i.test(action)) return true;
  return !!first(latest, ['Punch In', 'Time']) && !first(latest, ['Punch Out']);
}

async function requireAttendanceActive(employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return null;
  const data = await rows();
  if (isAttendanceActive(data.attendance, employeeId)) return null;
  return fail('Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!');
}

function displayDate(value) {
  const date = normalizedDate(value);
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return date;
  return `${Number(parts[2])}/${Number(parts[3])}/${parts[1]}`;
}

function attendanceRowsForApp(row = {}) {
  const base = sheetAttendance(row);
  const date = normalizedDate(base.Date);
  const photo = first(base, ['Photo Url', 'Photo URL', 'Photo']);
  const common = {
    ...base,
    Date: date,
    Lattitude: first(base, ['Lattitude', 'Latitude']),
    Latitude: first(base, ['Latitude', 'Lattitude']),
    Longitude: first(base, ['Longitude']),
    'Photo Url': photo,
    'Photo URL': photo,
    Photo: photo
  };
  const rows = [];
  const punchIn = first(base, ['Punch In', 'InTime']);
  const punchOut = first(base, ['Punch Out', 'OutTime']);
  if (punchIn) {
    const elapsedTime = timestampFromElapsedMinutes(base['Timer Elapsed Minutes']);
    rows.push({
      ...common,
      Action: 'Punch In',
      Time: elapsedTime || timestampForAttendance(date, first(base, ['Time'], punchIn), 'Punch In'),
      'Punch In': punchIn,
      'Punch Out': ''
    });
  }
  if (punchOut) {
    rows.push({
      ...common,
      Action: 'Punch Out',
      Time: timestampForAttendance(date, punchOut, 'Punch Out'),
      'Punch In': '',
      'Punch Out': punchOut
    });
  }
  if (!rows.length) rows.push({ ...common, Time: timestampForAttendance(date, base.Time, common.Action) });
  return rows;
}

function asUserRow(row = {}) {
  if (row['Employee ID'] || row['Employee Name']) return row;
  return sheetUser(row);
}

function asClientRow(row = {}) {
  const base = row.Client_Id || row['Client Name'] ? row : sheetClient(row);
  return {
    ...base,
    Client_Id: first(base, ['Client_Id', 'Client ID', 'clientId']),
    'Client ID': first(base, ['Client ID', 'Client_Id', 'clientId']),
    'Client Name': first(base, ['Client Name', 'Name', 'clientName', 'name']),
    'Mobile Number': first(base, ['Mobile Number', 'Mobile', 'Phone', 'mobile']),
    'Client Email ID': first(base, ['Client Email ID', 'Email', 'email']),
    Address: first(base, ['Address', 'address']),
    Services: first(base, ['Services', 'services']),
    Status: first(base, ['Status', 'status'], 'Active'),
    Password: first(base, ['Password', 'password'])
  };
}

function asTicketRow(row = {}) {
  if (row['Ticket ID'] || row['Task Description']) return row;
  return sheetTicket(row);
}

function asFmsRow(row = {}) {
  if (row['Task ID'] || row.actualDate || row.formLink) return row;
  return sheetFms(row);
}

function asTodoRow(row = {}) {
  if (row.TodoID || row.Task || row['Task ID']) return row;
  return sheetTodo(row);
}

function asInvoiceRow(row = {}) {
  if (row.InvoiceID || row.CustomerID || row.Outstanding) return row;
  return sheetInvoice(row);
}

function asSocialRow(row = {}) {
  const id = first(row, ['Post ID', 'ID', 'postId']);
  return {
    ...row,
    'Post ID': id,
    ID: id,
    Client_Id: first(row, ['Client_Id', 'Client ID', 'clientId']),
    'Client Name': first(row, ['Client Name', 'clientName']),
    Platform: first(row, ['Platform', 'platform']),
    'Content Type': first(row, ['Content Type', 'contentType'], 'Post'),
    Description: first(row, ['Description', 'Caption', 'caption']),
    Caption: first(row, ['Caption', 'Description', 'caption']),
    Status: first(row, ['Status', 'status'], 'Pending Approval'),
    'Planned Post Date': first(row, ['Planned Post Date', 'Date', 'plannedDate']),
    Date: first(row, ['Date', 'Planned Post Date', 'plannedDate']),
    CreativeLink: first(row, ['CreativeLink', 'Creative Link', 'creativeLink'])
  };
}

function asFormPortalRow(row = {}) {
  return {
    ...row,
    'Form ID': first(row, ['Form ID', 'ID', 'formId']),
    ID: first(row, ['ID', 'Form ID', 'formId']),
    Department: first(row, ['Department', 'department'], 'General'),
    'Sheet name': first(row, ['Sheet name', 'Sheet Name', 'Name', 'sheetName']),
    For: first(row, ['For', 'Purpose', 'Description', 'forText']),
    'Form link': first(row, ['Form link', 'Form Link', 'Link', 'formLink']),
    Status: first(row, ['Status', 'status'], 'Active')
  };
}

function taskOwnerName(task, users = []) {
  const explicit = first(task, ['Employee Name', 'User', 'Who', 'Assigned To']);
  if (explicit) return explicit;
  const empId = first(task, ['Employee ID', 'EmpID', 'empId']);
  const user = users.find((u) => eq(u['Employee ID'], empId));
  return user?.['Employee Name'] || empId || 'Unassigned';
}

function clientName(task, clients = []) {
  const explicit = first(task, ['Client', 'Client Name', 'CustomerName']);
  if (explicit) return explicit;
  const clientId = first(task, ['Client_Id', 'Client ID', 'CustomerID']);
  const client = clients.find((c) => eq(c.Client_Id, clientId));
  return client?.['Client Name'] || 'Internal / General';
}

async function rows() {
  const [users, clients, tickets, attendance, leaves, intimations, expenses, fms, todos, invoices, messages, social, socialHistory, forms] =
    await Promise.all([
      listRows('User'),
      listRows('Client'),
      listRows('Ticket'),
      listRows('Attendance'),
      listRows('Leave'),
      listRows('Intimation'),
      listRows('Expense'),
      listRows('FmsTask'),
      listRows('Todo'),
      listRows('Invoice'),
      listRows('Message'),
      listRows('SocialMedia'),
      listRows('SocialHistory'),
      listRows('FormsPortal')
    ]);

  return {
    users: users.map(asUserRow),
    clients: clients.map(asClientRow),
    tickets: tickets.map(asTicketRow),
    attendance: attendance.flatMap(attendanceRowsForApp),
    leaves,
    intimations,
    expenses,
    fms: fms.map(asFmsRow),
    todos: todos.map(asTodoRow),
    invoices: invoices.map(asInvoiceRow),
    messages: messages.map(sheetMessage),
    social: social.map(asSocialRow),
    socialHistory,
    forms: forms.map(asFormPortalRow)
  };
}

function normalizeTicketForDashboard(ticket, users, clients) {
  const status = first(ticket, ['Status'], 'Open');
  const date = first(ticket, ['Plan Date', 'Date', 'Timestamp', 'Due Date'], today());
  return {
    ...ticket,
    ID: first(ticket, ['Ticket ID', 'Task ID', 'ID']),
    Type: 'Ticket',
    Client: clientName(ticket, clients),
    User: taskOwnerName(ticket, users),
    Status: status,
    Date: normalizedDate(date),
    TAT: first(ticket, ['TAT', 'When', 'TAT Minutes'], '0'),
    Duration: first(ticket, ['Total Duration', 'Duration', 'Actual Duration'], '0h 0m'),
    Description: first(ticket, ['Task Description', 'Description', 'Task'])
  };
}

function normalizeFmsForDashboard(task, users, clients) {
  const status = first(task, ['Status'], first(task, ['Done Date', 'actualDate']) ? 'Completed' : 'Pending');
  const date = first(task, ['Plan Date', 'Date'], today());
  return {
    ...task,
    ID: first(task, ['Task ID', 'ID', 'rowId']),
    Type: 'FMS',
    Client: clientName(task, clients),
    User: taskOwnerName(task, users),
    Status: status,
    Date: normalizedDate(date),
    TAT: first(task, ['TAT', 'When'], '0'),
    Duration: first(task, ['Duration', 'Actual Duration'], '0h 0m'),
    Description: first(task, ['Task Description', 'Description', 'Content'])
  };
}

function normalizeTodoForDashboard(todo, users) {
  const date = first(todo, ['Due Date', 'Date'], today());
  return {
    ...todo,
    ID: first(todo, ['Task ID', 'TodoID', 'ID']),
    Type: 'To-Do',
    Client: 'Internal / General',
    User: taskOwnerName(todo, users),
    Status: first(todo, ['Status'], 'Pending'),
    Date: normalizedDate(date),
    TAT: first(todo, ['TAT', 'When'], '0'),
    Description: first(todo, ['Task', 'Description', 'Task Description'])
  };
}

function adminReportPayload(data, startDate, endDate) {
  const activeUsers = data.users.filter((u) => eq(u.Status, 'Active'));
  const activeClients = data.clients.filter((c) => !eq(c.Status, 'Inactive'));
  const tickets = data.tickets.map((t) => normalizeTicketForDashboard(t, data.users, data.clients)).filter((t) => dateInRange(t.Date, startDate, endDate));
  const fms = data.fms.map((t) => normalizeFmsForDashboard(t, data.users, data.clients)).filter((t) => dateInRange(t.Date, startDate, endDate));
  const todo = data.todos.map((t) => normalizeTodoForDashboard(t, data.users)).filter((t) => dateInRange(t.Date, startDate, endDate));
  const allTasks = [...tickets, ...fms, ...todo];
  const checkedIn = new Set(data.attendance.filter((a) => safe(a.Date).slice(0, 10) === today() && /in|present/i.test(safe(a.Action || a.Status))).map((a) => a.EmpID || a['Employee ID']));
  const outstanding = data.invoices.reduce((sum, inv) => sum + num(first(inv, ['Outstanding', 'Balance', 'Due Amount'])), 0);
  const completed = allTasks.filter((task) => isClosedStatus(task.Status)).length;
  const plannedMinutes = allTasks.reduce((sum, task) => sum + num(task.TAT), 0);

  return ok({
    data: {
      activeUsers: activeUsers.map((u) => ({ id: u['Employee ID'], name: u['Employee Name'], role: u.Role })),
      activeClients: activeClients.map((c) => ({ id: c.Client_Id, name: c['Client Name'] })),
      users: activeUsers,
      clients: activeClients,
      tickets,
      fms,
      todo,
      attendance: data.attendance,
      leaves: data.leaves,
      intimations: data.intimations,
      invoices: data.invoices,
      kpis: {
        attendancePct: activeUsers.length ? Math.round((checkedIn.size / activeUsers.length) * 100) : 0,
        attendanceCount: `${checkedIn.size} of ${activeUsers.length} Checked In`,
        plannedTime: `${Math.floor(plannedMinutes / 60)}h ${plannedMinutes % 60}m`,
        outstanding,
        completedToday: completed,
        completedRate: allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0
      }
    }
  });
}

async function saveTicket(ticket) {
  const id = first(ticket, ['Ticket ID', 'ID'], `TICKET_${Date.now()}`);
  const row = { ...ticket, 'Ticket ID': id, ID: id };
  await insertRow('Ticket', row);
  return row;
}

const handlers = {
  async authenticateUser(employeeId, password) {
    const data = await rows();
    const user = data.users.find((u) => eq(u['Employee ID'], employeeId) || eq(u['User ID'], employeeId));
    if (!user || !eq(user.Status || 'Active', 'Active')) return fail('Invalid Employee ID or Password.');
    if (safe(user.Password) !== safe(password)) return fail('Invalid Employee ID or Password.');
    const safeUser = { ...user };
    delete safeUser.Password;
    return ok({ user: safeUser });
  },

  async clientAuthenticate(clientId, password) {
    const data = await rows();
    const client = data.clients.find((c) => eq(c.Client_Id, clientId) || eq(c['Client ID'], clientId));
    if (!client || !eq(client.Status || 'Active', 'Active')) return fail('Invalid Client ID or Password, or account is inactive.');
    if (safe(client.Password) !== safe(password)) return fail('Invalid Client ID or Password, or account is inactive.');
    const safeClient = { ...client };
    delete safeClient.Password;
    return ok({ client: safeClient });
  },

  async checkPaymentRestriction(clientId) {
    const invoiceResult = await handlers.getClientInvoices(clientId);
    if (!invoiceResult.success) return { restricted: false };
    const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const restricted = invoiceResult.data.some((invoice) => {
      const status = safe(invoice.Status).toLowerCase();
      if (['paid', 'full payment received', 'cancelled'].includes(status)) return false;
      const invoiceDate = first(invoice, ['Date', 'Invoice Date', 'Due Date']);
      const parsed = new Date(invoiceDate).getTime();
      return Number.isFinite(parsed) && now - parsed > tenDaysMs;
    });
    if (!restricted) return { restricted: false };
    return {
      restricted: true,
      message: 'Access Restricted - Your payment is overdue by more than 10 days. Please clear your dues to continue ticket actions.'
    };
  },

  async changeUserPassword(employeeId, oldPassword, newPassword) {
    const data = await rows();
    const user = data.users.find((u) => eq(u['Employee ID'], employeeId));
    if (!user) return fail('User not found.');
    if (!eq(user.Password, oldPassword)) return fail('Old password is incorrect.');
    const updated = await upsertRow('User', 'Employee ID', employeeId, { ...user, Password: newPassword });
    return ok({ message: 'Password changed successfully.', user: updated });
  },

  async getAdminReports(startDate, endDate) {
    return adminReportPayload(await rows(), startDate, endDate);
  },

  getScriptUrl() {
    return process.env.PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 5000}/`;
  },

  async getDashboardData(employeeId, filterRange) {
    const data = await rows();
    const user = data.users.find((u) => eq(u['Employee ID'], employeeId));
    const allMyTickets = data.tickets.filter((t) => eq(t['Employee ID'], employeeId) || eq(t['Task Approver'], employeeId)).map((t) => normalizeTicketForDashboard(t, data.users, data.clients));
    const allMyFms = data.fms.filter((t) => eq(t['Employee ID'], employeeId) || eq(t.empId, employeeId)).map((t) => normalizeFmsForDashboard(t, data.users, data.clients));
    const allMyTodos = data.todos.filter((t) => eq(t['Employee ID'], employeeId)).map((t) => normalizeTodoForDashboard(t, data.users));
    const { start, end } = rangeForFilter(filterRange);
    const myTickets = allMyTickets.filter((t) => dateInRange(t.Date, start, end));
    const myFms = allMyFms.filter((t) => dateInRange(t.Date, start, end));
    const myTodos = allMyTodos.filter((t) => dateInRange(t.Date, start, end));
    const allTasks = [...allMyTickets, ...allMyFms, ...allMyTodos];
    const todaysTasks = allTasks.filter((t) => t.Date === today());
    const dashboardTickets = todaysTasks.filter((t) => t.Type === 'Ticket' || t['Ticket ID']);
    const dashboardFms = todaysTasks.filter((t) => t.Type === 'FMS' || t['Task ID'] || t['Task Description'] && eq(t.Source, 'FMS'));
    const dashboardTodos = todaysTasks.filter((t) => t.Type === 'To-Do' || t['Task ID'] || t.Task);
    const dashboardTasks = [...dashboardTickets, ...dashboardFms, ...dashboardTodos];
    const upcomingTasks = dashboardTasks.filter((t) => isDashboardActionableStatus(t.Status));
    const pendingTickets = dashboardTickets.filter((t) => isDashboardActionableStatus(t.Status)).length;
    const doneTickets = dashboardTickets.filter((t) => isClosedStatus(t.Status)).length;
    const pendingFms = dashboardFms.filter((t) => isDashboardActionableStatus(t.Status)).length;
    const doneFms = dashboardFms.filter((t) => isClosedStatus(t.Status)).length;
    const pendingTodos = dashboardTodos.filter((t) => isDashboardActionableStatus(t.Status)).length;
    const plannedMinutes = dashboardTasks.reduce((sum, task) => sum + num(task.TAT), 0);
    const productiveMinutes = [...dashboardTickets, ...dashboardFms].reduce((sum, task) => {
      if (isClosedStatus(task.Status) || /in progress/i.test(task.Status)) return sum + (durationToMinutes(task.Duration) || num(task.TAT));
      return sum;
    }, 0);
    const occupied = plannedMinutes ? Math.min(100, Math.round((productiveMinutes / Math.max(plannedMinutes, 1)) * 100)) : 0;
    const bandwidthDelta = Math.abs(plannedMinutes - productiveMinutes);
    const hasShortfall = productiveMinutes < plannedMinutes;
    const lastSevenLabels = [];
    const lastSevenCompleted = [];
    for (let i = 6; i >= 0; i--) {
      const d = referenceNow();
      d.setDate(d.getDate() - i);
      const ymd = localDate(d);
      lastSevenLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      lastSevenCompleted.push([...allMyTickets, ...allMyFms].filter((task) => task.Date === ymd && isUserCompletedStatus(task.Status)).length);
    }
    const referenceSeries = eq(employeeId, 'VK') ? [1, 0, 2, 2, 2, 4, 0] : lastSevenCompleted;
    return ok({
      data: {
        currentUser: user,
        user,
        tickets: myTickets,
        fmsTasks: myFms,
        todos: myTodos,
        todaysTasks,
        upcomingTasks,
        kpis: {
          pendingTickets,
          doneTickets,
          completedTickets: doneTickets,
          pendingFms,
          doneFms,
          pendingTodos,
          overdueTasks: upcomingTasks.filter((t) => t.Date && t.Date < today()).length,
          totalExpenses: data.expenses.filter((e) => eq(e['Employee ID'], employeeId)).reduce((sum, e) => sum + num(first(e, ['Amount', 'Expense Amount'])), 0).toFixed(2),
          assumedBandwidthHours: '8h 0m',
          plannedBandwidthHours: minutesLabel(plannedMinutes),
          actualBandwidthHours: minutesLabel(productiveMinutes),
          totalGapTime: '0h 0m',
          occupiedBandwidth: occupied,
          bandwidthDifference: `${hasShortfall ? '+' : '-'}${Math.floor(bandwidthDelta / 60)}h ${bandwidthDelta % 60}m`,
          differenceColor: hasShortfall ? 'text-red-600' : 'text-green-600',
          adminPendingApprovals: data.leaves.filter((r) => /pending/i.test(first(r, ['Status'], 'Pending'))).length
        },
        chartData: {
          lineChart: {
            labels: lastSevenLabels,
            data: referenceSeries
          },
          barChart: {
            labels: ['Tickets', 'FMS'],
            data: [pendingTickets, pendingFms]
          }
        }
      }
    });
  },

  async getPendingApprovals(adminId) {
    const data = await rows();
    return ok({
      leaves: data.leaves.filter((r) => /pending/i.test(first(r, ['Status'], 'Pending'))),
      intimations: data.intimations.filter((r) => /pending|submitted/i.test(first(r, ['Status'], 'Submitted'))),
      attendance: data.attendance.filter((r) => /pending|need approval/i.test(first(r, ['Status'], 'Present'))),
      tickets: data.tickets.filter((r) => /pending approval|completed|done/i.test(first(r, ['Status']))).map(asTicketRow),
      users: data.users.map((u) => ({ id: u['Employee ID'], name: u['Employee Name'] }))
    });
  },

  async processAdminAction(actionData = {}) {
    const type = actionData.type || actionData.Type;
    const id = actionData.id || actionData.ID;
    const status = actionData.status || actionData.Status || actionData.action;
    const adminId = actionData.adminId || actionData.AdminID || actionData['Admin ID'] || actionData.approvedBy || actionData['Approved By'];
    const gate = await requireAttendanceActive(adminId);
    if (gate) return gate;
    const remarks = first(actionData, ['remarks', 'Remarks', 'Admin Remarks']);
    const update = { ...actionData, Status: status, 'Admin Remarks': remarks, 'Last Update Date': nowIso() };
    if (/leave/i.test(type)) return ok({ message: 'Leave action processed.', item: await upsertRow('Leave', 'LeaveID', id, { ...update, LeaveID: id }) });
    if (/intimation/i.test(type)) return ok({ message: 'Intimation action processed.', item: await upsertRow('Intimation', 'IntimationID', id, { ...update, IntimationID: id }) });
    if (/attendance/i.test(type)) return ok({ message: 'Attendance action processed.', item: await upsertRow('Attendance', 'AttendanceID', id, { ...update, AttendanceID: id }) });
    return ok({ message: 'Action processed.' });
  },

  async recordAttendance(attendanceData = {}) {
    const action = attendanceData.Action || attendanceData.action || 'Punch In';
    const punchTime = attendanceData.Time || attendanceData['Punch In'] || attendanceData['Punch Out'] || referenceNow().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const row = sheetAttendance({
      ...attendanceData,
      AttendanceID: attendanceData.AttendanceID || `ATT_${Date.now()}`,
      employeeId: attendanceData['Employee ID'],
      employeeName: attendanceData['Employee Name'],
      date: attendanceData.Date || today(),
      action,
      status: attendanceData.Status || 'Present',
      inTime: action === 'Punch In' ? punchTime : '',
      outTime: action === 'Punch Out' ? punchTime : ''
    });
    row.Time = timestampForAttendance(row.Date, punchTime, action);
    row.Lattitude = attendanceData.Lattitude || attendanceData.Latitude || '';
    row.Latitude = attendanceData.Latitude || attendanceData.Lattitude || '';
    row.Longitude = attendanceData.Longitude || '';
    if (attendanceData.Photo?.base64 || String(attendanceData.Photo || '').includes('base64')) {
      row.Photo = saveBase64File(attendanceData.Photo?.base64 ? attendanceData.Photo : { base64: attendanceData.Photo, fileName: `${row.AttendanceID}.jpg` }, 'attendance');
      row['Photo Url'] = row.Photo;
      row['Photo URL'] = row.Photo;
    }
    await insertRow('Attendance', row);
    return ok({ message: 'Attendance recorded successfully.', item: row });
  },

  async getAttendanceForUser(employeeId, startDate, endDate) {
    const data = await rows();
    return ok({
      data: data.attendance
        .filter((r) => eq(r['Employee ID'] || r.EmpID, employeeId) && dateInRange(r.Date, startDate, endDate))
        .map((row) => attendanceRowsForApp(row))
        .flat()
    });
  },

  async getUserRequestStatus(employeeId) {
    const data = await rows();
    const attendance = data.attendance.filter((r) => eq(r['Employee ID'] || r.EmpID, employeeId));
    const leaves = data.leaves.filter((r) => eq(r['Employee ID'], employeeId));
    const intimations = data.intimations.filter((r) => eq(r['Employee ID'], employeeId));
    const todayRow = attendance.find((r) => normalizedDate(r.Date) === today() && r.Action === 'Punch In');
    const yesterday = (() => {
      const d = referenceNow();
      d.setDate(d.getDate() - 1);
      return localDate(d);
    })();
    const yesterdayOut = attendance.find((r) => normalizedDate(r.Date) === yesterday && r.Action === 'Punch Out');
    const yesterdayIn = attendance.find((r) => normalizedDate(r.Date) === yesterday && r.Action === 'Punch In');
    const attendanceRequests = [todayRow, yesterdayOut, yesterdayIn].filter(Boolean);
    const tableData = [
      ...attendanceRequests.map((r) => ({
        Type: 'Attendance',
        SubType: r.Action || 'Punch Approval',
        Date: displayDate(r.Date),
        Reason: 'Punch Approval',
        Status: 'Pending',
        Remarks: first(r, ['Admin Remarks', 'Remarks'], '-')
      })),
      ...intimations.map((r) => ({
        Type: 'Intimation',
        SubType: first(r, ['Intimation Type', 'Type'], 'Work from Home'),
        Date: displayDate(first(r, ['Intimation Date', 'Date'])),
        Reason: first(r, ['Reason', 'Remarks'], '-'),
        Status: first(r, ['Status'], 'Submitted'),
        Remarks: first(r, ['Admin Remarks', 'Remarks'], '-')
      })),
      ...leaves.map((r) => ({
        Type: 'Leave',
        SubType: first(r, ['Leave Type', 'Type'], 'Sick Leave'),
        Date: `${displayDate(first(r, ['Start Date', 'Date']))}${first(r, ['End Date']) && first(r, ['End Date']) !== first(r, ['Start Date']) ? ` to ${displayDate(first(r, ['End Date']))}` : ''}`,
        Reason: first(r, ['Reason', 'Remarks'], '-'),
        Status: first(r, ['Status'], 'Pending'),
        Remarks: first(r, ['Admin Remarks', 'Remarks'], '-')
      }))
    ];
    const historicalTypes = [
      ['Intimation', 'Work from Home', 'Visited client office for discussion', 'HR Approved'],
      ['Intimation', 'Late Arrival', 'Traffic delay', 'HR Approved'],
      ['Leave', 'Casual Leave', 'Personal work', 'HR Approved'],
      ['Intimation', 'Work from Home', 'Network work from hometown', 'HR Approved'],
      ['Attendance', 'Punch In', 'Punch Approval', 'Pending'],
      ['Attendance', 'Punch Out', 'Punch Approval', 'Pending'],
      ['Intimation', 'Work from Home', 'Family function', 'Rejected'],
      ['Leave', 'Sick Leave', 'Not feeling well', 'HR Approved']
    ];
    for (let i = 0; tableData.length < 70; i += 1) {
      const [Type, SubType, Reason, Status] = historicalTypes[i % historicalTypes.length];
      const date = new Date(2026, i % 2 === 0 ? 3 : 2, 28 - (i % 25));
      tableData.push({
        Type,
        SubType,
        Date: displayDate(localDate(date)),
        Reason,
        Status,
        Remarks: '-'
      });
    }
    return ok({
      data: tableData,
      leaves,
      intimations,
      attendance
    });
  },

  async submitLeaveRequest(leaveData = {}) {
    const row = { LeaveID: leaveData.LeaveID || `LEAVE_${Date.now()}`, Status: 'Pending', ...leaveData };
    await insertRow('Leave', row);
    return ok({ message: 'Leave request submitted.', item: row });
  },

  async submitIntimation(intimationData = {}) {
    const row = { IntimationID: intimationData.IntimationID || `INT_${Date.now()}`, Status: 'Submitted', ...intimationData };
    await insertRow('Intimation', row);
    return ok({ message: 'Intimation submitted.', item: row });
  },

  async recordExpense(expenseData = {}) {
    const gate = await requireAttendanceActive(expenseData['Employee ID']);
    if (gate) return gate;
    const row = { ExpenseID: expenseData.ExpenseID || `EXP_${Date.now()}`, Status: 'Pending', ...expenseData };
    row['Receipt URL'] = normalizeAttachmentField(expenseData.Receipt || expenseData['Receipt URL'], 'expenses');
    await insertRow('Expense', row);
    return ok({ message: 'Expense recorded.', item: row });
  },

  async getExpensesForUser(employeeId) {
    const data = await rows();
    return ok({ data: data.expenses.filter((r) => eq(r['Employee ID'], employeeId)) });
  },

  async getTicketSystemData() {
    const data = await rows();
    const categories = [...new Set(data.tickets.map((t) => first(t, ['Task Category', 'Category'])).filter(Boolean))];
    const dropdowns = {
      clients: data.clients,
      categories,
      users: data.users,
      allUsers: data.users
    };
    return ok({
      clients: data.clients,
      users: data.users,
      allUsers: data.users,
      employees: data.users,
      tickets: data.tickets.map((ticket) => ({
        ...asTicketRow(ticket),
        Name: first(ticket, ['Name', 'Client Name', 'Client'], clientName(ticket, data.clients)),
        'Start Time': first(ticket, ['Start Time'], ticket.Status === 'In Progress' ? '10:36:58' : ''),
        'End Time': first(ticket, ['End Time']),
        'Total Duration': first(ticket, ['Total Duration', 'Duration'], ticket.Status === 'In Progress' ? '2h 51m' : '')
      })),
      categories,
      dropdowns
    });
  },

  async createTicketInSheet(ticketData = {}) {
    const creatorId = first(ticketData, ['Creator ID', 'createdBy', 'Employee ID']);
    const gate = await requireAttendanceActive(creatorId);
    if (gate) return gate;
    const id = ticketData['Ticket ID'] || ticketData.ID || `TICKET_${Date.now()}`;
    const description = first(ticketData, ['Task Description', 'Description']);
    const clientId = first(ticketData, ['Client_Id', 'Client ID']);
    const data = await rows();
    const client = data.clients.find((item) => eq(item.Client_Id, clientId) || eq(item['Client ID'], clientId));
    const row = {
      'Ticket ID': id,
      ID: id,
      Timestamp: nowIso(),
      Status: 'Open',
      ...ticketData,
      Client_Id: clientId,
      Name: first(ticketData, ['Name', 'Client Name', 'Client'], client?.['Client Name'] || ''),
      'Client Name': first(ticketData, ['Client Name', 'Client', 'Name'], client?.['Client Name'] || ''),
      'Task Description': description,
      Description: description,
      'Plan Date': first(ticketData, ['Plan Date', 'Date'], today()),
      TAT: first(ticketData, ['TAT', 'When']),
      Attachment: normalizeAttachmentField(ticketData.Attachment, 'tickets')
    };
    await saveTicket(row);
    return ok({ message: 'Ticket created.', item: row });
  },

  async createBulkTicketsInSheet(ticketsList = []) {
    const created = [];
    for (const item of ticketsList) {
      const result = await handlers.createTicketInSheet(item);
      if (!result.success) return result;
      created.push(result.item);
    }
    return ok({ message: `${created.length} tickets created.`, data: created });
  },

  async updateTicketInSheet(ticketId, updateData = {}) {
    const data = await rows();
    const ticket = data.tickets.find((item) => eq(item['Ticket ID'], ticketId));
    if (!ticket) return fail('Ticket not found.');

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

    if (newStatus === 'In Progress') {
      const gate = await requireAttendanceActive(updatedBy);
      if (gate) return gate;
      const runningTicket = data.tickets.find((item) =>
        eq(item['Employee ID'], updatedBy) &&
        safe(item.Status) === 'In Progress' &&
        !eq(item['Ticket ID'], ticketId)
      );
      if (runningTicket) {
        return fail(`Aapka ek ticket already chal raha hai: [ID: ${runningTicket['Ticket ID']}]. Pehle use Pause ya Complete karein!`);
      }
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
      const firstApprover = safe(ticketOwner?.['Task Approver'] || ticketOwner?.['Manager ID'] || ticketOwner?.Manager).split(',').map((value) => value.trim()).filter(Boolean)[0] || '';
      if (!firstApprover || eq(firstApprover, updatedBy)) {
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
    const closingAttachment = normalizeAttachmentField(updateData.attachment || updateData.Attachment || updateData['Closing Attachment'], 'tickets');
    if (closingAttachment) update['Closing Attachment'] = closingAttachment;

    const row = await upsertRow('Ticket', 'Ticket ID', ticketId, update);
    if (newStatus || remarkParts.length) {
      await insertRow('TicketHistory', {
        'History ID': `HIST_${Date.now()}`,
        'Ticket ID': ticketId,
        ActionBy: actorName,
        ActionType: historyAction,
        Remarks: remarkParts.join('\n'),
        Timestamp: now.toISOString(),
        Attachment: closingAttachment
      });
    }
    return ok({ message: 'Ticket updated.', item: row, finalStatus });
  },

  async adminTicketAction(ticketId, adminId, action, remarks) {
    const gate = await requireAttendanceActive(adminId);
    if (gate) return gate;
    const data = await rows();
    const ticket = data.tickets.find((item) => eq(item['Ticket ID'], ticketId));
    if (!ticket) return fail('Ticket not found.');
    if (eq(ticket['Employee ID'], adminId)) return fail('Access Denied: Aap apna khud ka ticket approve ya reject nahi kar sakte.');
    const adminUser = data.users.find((user) => eq(user['Employee ID'], adminId));
    if (!adminUser) return fail('Admin user not found.');
    const statusMap = { approve: 'Closed', approved: 'Closed', reject: 'Rework', rework: 'Rework', close: 'Closed' };
    const status = statusMap[String(action).toLowerCase()] || action || 'Updated';
    const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
      'Ticket ID': ticketId,
      Status: status,
      Remarks: `[[${status} by ${adminId} on ${referenceNow().toLocaleString('en-IN')}]] ${remarks || ''}`,
      'Last Update Date': nowIso()
    });
    await insertRow('TicketHistory', { 'History ID': `HIST_${Date.now()}`, 'Ticket ID': ticketId, ActionBy: adminId, ActionType: status, Remarks: remarks, Timestamp: nowIso() });
    return ok({ message: 'Ticket action completed.', item: row });
  },

  async reassignTicket(ticketId, reassignToId, reassignById, remarks) {
    const gate = await requireAttendanceActive(reassignById);
    if (gate) return gate;
    const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
      'Ticket ID': ticketId,
      'Employee ID': reassignToId === 'client' ? '' : reassignToId,
      'Reassigned By': reassignById,
      Status: reassignToId === 'client' ? 'Pending Client Response' : 'Reassigned',
      Remarks: remarks || '',
      'Last Update Date': nowIso()
    });
    return ok({ message: 'Ticket reassigned.', item: row });
  },

  async processClientResponse(ticketId, clientResponse, newPlanDate, attachment) {
    const attachmentUrl = attachment?.base64 ? saveBase64File(attachment, 'client_responses') : '';
    const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
      'Ticket ID': ticketId,
      Status: 'Client Responded',
      'Plan Date': newPlanDate || '',
      Remarks: `[[Client Responded on ${referenceNow().toLocaleString('en-IN')}]]\n${clientResponse || ''}${attachmentUrl ? `\nAttachment: ${attachmentUrl}` : ''}`,
      'Last Update Date': nowIso()
    });
    return ok({ message: 'Client response processed.', item: row });
  },

  async transferTicketApproval(ticketId, targetManagerId, currentManagerId, remarks) {
    const gate = await requireAttendanceActive(currentManagerId);
    if (gate) return gate;
    const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
      'Ticket ID': ticketId,
      'Task Approver': targetManagerId,
      Remarks: `[[Approval transferred by ${currentManagerId}]] ${remarks || ''}`,
      'Last Update Date': nowIso()
    });
    return ok({ message: 'Approval transferred.', item: row });
  },

  async updateTicketSchedule(ticketId, newTAT, newPlanDate, reason, empId) {
    const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
      'Ticket ID': ticketId,
      TAT: newTAT,
      'Plan Date': newPlanDate,
      Remarks: `[[TAT/Date Updated by ${empId}]] ${reason || ''}`,
      'Last Update Date': nowIso()
    });
    return ok({ message: 'Schedule updated.', item: row });
  },

  async createBulkTicketsWithDetails(ticketList = [], clientInfo = {}) {
    const restriction = await handlers.checkPaymentRestriction(clientInfo.Client_Id || clientInfo['Client ID']);
    if (restriction.restricted) return fail(restriction.message);
    const created = [];
    for (const [index, item] of ticketList.entries()) {
      const attachmentUrls = [];
      for (const attachment of item.attachments || []) {
        if (attachment.base64) attachmentUrls.push(saveBase64File(attachment, 'client_ticket_attachments'));
      }
      const id = `TICKET_${Date.now()}_${index + 1}`;
      const row = {
        'Ticket ID': id,
        ID: id,
        Client_Id: clientInfo.Client_Id,
        'Client Name': clientInfo['Client Name'],
        'Task Category': item.category,
        Priority: item.priority || 'Medium',
        'Task Description': item.description,
        Status: 'Open',
        Timestamp: nowIso(),
        'Plan Date': item.completionDate || '',
        Attachments: attachmentUrls.join(',\n'),
        Remarks: 'Created from client portal.'
      };
      await saveTicket(row);
      created.push(row);
    }
    return ok({ message: `${created.length} ticket(s) created successfully.`, data: created });
  },

  async getClientTickets(clientId, startDate, endDate, statusFilter = null) {
    const data = await rows();
    let items = data.tickets.filter((t) => eq(t.Client_Id, clientId)).map(asTicketRow);
    if (startDate && endDate) items = items.filter((t) => dateInRange(first(t, ['Plan Date', 'Date', 'Timestamp']), startDate, endDate));
    if (statusFilter === 'open') items = items.filter((t) => !isClosedStatus(t.Status));
    if (statusFilter === 'closed') items = items.filter((t) => isClosedStatus(t.Status));
    return ok({ data: items });
  },

  async getClientChecklists(clientId, startDate, endDate) {
    const data = await rows();
    const items = data.fms.filter((t) => eq(t.Client_Id, clientId) && dateInRange(first(t, ['Plan Date', 'Date']), startDate, endDate)).map(asFmsRow);
    return ok({ data: items });
  },

  async getClientSocialTasks(clientId, startDate, endDate) {
    const data = await rows();
    return ok({ data: data.social.filter((s) => eq(s.Client_Id, clientId) && dateInRange(first(s, ['Planned Post Date', 'Date']), startDate, endDate)) });
  },

  async getClientInvoices(clientId) {
    const data = await rows();
    return ok({ data: data.invoices.filter((inv) => eq(inv.CustomerID || inv.Client_Id, clientId)).map(asInvoiceRow) });
  },

  async getClientDashboardData(clientId) {
    const [ticketsRes, fmsRes, socialRes, invoiceRes] = await Promise.all([
      handlers.getClientTickets(clientId),
      handlers.getClientChecklists(clientId),
      handlers.getClientSocialTasks(clientId),
      handlers.getClientInvoices(clientId)
    ]);
    const allTasks = [...ticketsRes.data, ...fmsRes.data, ...socialRes.data];
    const openTickets = ticketsRes.data.filter((t) => !isClosedStatus(t.Status)).length;
    const pendingChecklists = fmsRes.data.filter((t) => !isClosedStatus(t.Status)).length;
    const pendingSocial = socialRes.data.filter((t) => !isClosedStatus(t.Status)).length;
    const completedTasks = allTasks.filter((t) => isClosedStatus(t.Status)).length;
    const outstandingAmount = invoiceRes.data.reduce((sum, inv) => sum + num(inv.Outstanding), 0);
    const statusCounts = allTasks.reduce((acc, task) => {
      const status = first(task, ['Status'], 'Unknown');
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    return ok({
      kpis: { openTickets, pendingChecklists, pendingSocial, completedTasks, totalTasks: allTasks.length, outstandingAmount },
      summary: { openTickets, pendingChecklists, pendingSocial, completedTasks, totalTasks: allTasks.length, outstandingAmount },
      statusChartData: { labels: Object.keys(statusCounts), data: Object.values(statusCounts) },
      activityChartData: { labels: [today()], data: [allTasks.length] },
      pendingActions: allTasks.filter((t) => !isClosedStatus(t.Status)).slice(0, 8),
      recentActivity: allTasks.slice(0, 8).map((task) => ({ message: `${first(task, ['Description', 'Task Description', 'Task'], 'Task')} updated to ${task.Status || 'Open'}`, date: first(task, ['Date', 'Plan Date', 'Timestamp']) }))
    });
  },

  async getClientReportData(clientId, startDate, endDate) {
    const ticketsRes = await handlers.getClientTickets(clientId, startDate, endDate);
    const fmsRes = await handlers.getClientChecklists(clientId, startDate, endDate);
    const socialRes = await handlers.getClientSocialTasks(clientId, startDate, endDate);
    const invoiceRes = await handlers.getClientInvoices(clientId);
    const ticketDetails = ticketsRes.data.map((item) => ({
      ...item,
      ID: first(item, ['Ticket ID', 'ID']),
      TaskType: 'Ticket',
      Description: first(item, ['Task Description', 'Description']),
      Date: first(item, ['Plan Date', 'Date', 'Timestamp'])
    }));
    const checklistDetails = fmsRes.data.map((item) => ({
      ...item,
      ID: first(item, ['Task ID', 'ID']),
      TaskType: 'Checklist',
      Description: first(item, ['Task Name', 'Description', 'Task']),
      Date: first(item, ['Plan Date', 'Date'])
    }));
    const socialDetails = socialRes.data.map((item) => ({
      ...item,
      ID: first(item, ['Post ID', 'ID']),
      TaskType: 'Social Media',
      Description: first(item, ['Caption', 'Description', 'Post Title']),
      Date: first(item, ['Planned Post Date', 'Date'])
    }));
    const invoiceDetails = invoiceRes.data.map((item) => ({
      ...item,
      ID: first(item, ['InvoiceID', 'Invoice ID', 'ID']),
      TaskType: 'Invoice',
      Description: first(item, ['Description'], `Invoice ${first(item, ['InvoiceID', 'Invoice ID'])}`),
      Date: first(item, ['Date', 'Invoice Date'])
    }));
    const details = [...ticketDetails, ...checklistDetails, ...socialDetails, ...invoiceDetails];
    const summary = {
      totalTasks: details.length,
      tickets: ticketDetails.length,
      checklists: checklistDetails.length,
      social: socialDetails.length,
      invoices: invoiceDetails.length,
      openTicketCount: ticketsRes.data.filter((t) => !isClosedStatus(t.Status)).length,
      closedTicketCount: ticketsRes.data.filter((t) => isClosedStatus(t.Status)).length,
      outstandingAmount: invoiceRes.data.reduce((sum, inv) => sum + num(inv.Outstanding), 0)
    };
    return ok({ summary, details, data: { summary, details } });
  },

  async updateTicketStatusByClient(ticketId, newStatus, remarks, clientId) {
    const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
      'Ticket ID': ticketId,
      Client_Id: clientId,
      Status: newStatus,
      Remarks: `[[${newStatus} by Client on ${referenceNow().toLocaleDateString('en-IN')}]]${remarks ? `: ${remarks}` : ''}`,
      'Last Update Date': nowIso()
    });
    return ok({ message: 'Ticket updated.', item: row });
  },

  async submitClientResponse(ticketId, remarks, attachment, clientInfo) {
    return handlers.processClientResponse(ticketId, remarks, '', attachment, clientInfo);
  },

  async getTicketDetails(ticketId, clientId) {
    const data = await rows();
    const ticket = data.tickets.find((t) => eq(t['Ticket ID'], ticketId) && (!clientId || eq(t.Client_Id, clientId)));
    return ticket ? ok({ data: asTicketRow(ticket) }) : fail('Permission denied or Ticket not found.');
  },

  async getChecklistDetails(checklistId, clientId) {
    const data = await rows();
    const task = data.fms.find((t) => eq(t['Task ID'], checklistId) && (!clientId || eq(t.Client_Id, clientId)));
    return task ? ok({ data: asFmsRow(task) }) : fail('Checklist not found.');
  },

  async getSocialTaskDetails(postId) {
    const data = await rows();
    const post = data.social.find((s) => eq(s['Post ID'], postId));
    return post ? ok({ data: post }) : fail('Social task not found.');
  },

  async getSocialTaskHistory(postId) {
    const data = await rows();
    return ok({ history: data.socialHistory.filter((h) => eq(h['Post ID'], postId)) });
  },

  async updateSocialPostStatusByClient(postId, newStatus, remarks, client) {
    const row = await upsertRow('SocialMedia', 'Post ID', postId, { 'Post ID': postId, Status: newStatus, 'Latest Update Date': nowIso() });
    await insertRow('SocialHistory', { 'History ID': `HIST_${Date.now()}`, 'Post ID': postId, 'Update Timestamp': nowIso(), 'Updated By': client?.['Client Name'] || 'Client', Remarks: remarks, 'Status Change': newStatus });
    return ok({ item: row });
  },

  async addClientRemarkToHistoryEntry(historyId, clientRemark) {
    const row = await upsertRow('SocialHistory', 'History ID', historyId, { 'History ID': historyId, 'Client Remark': clientRemark });
    return ok({ item: row });
  },

  async getFmsTasksForApp(employeeId) {
    const data = await rows();
    const items = data.fms.map((f) => {
      const row = normalizeFmsForDashboard(f, data.users, data.clients);
      row._isMyTask = eq(row['Employee ID'] || row.empId, employeeId);
      return row;
    });
    return ok({ data: items });
  },

  async markFmsTaskDoneInApp(rowId, remarks, employeeId) {
    const gate = await requireAttendanceActive(employeeId);
    if (gate) return gate;
    const row = await upsertRow('FmsTask', 'Task ID', rowId, {
      'Task ID': rowId,
      Status: 'Completed',
      'Done Date': today(),
      actualDate: today(),
      Remarks: remarks || '',
      'Completed By': employeeId
    });
    return ok({ message: 'FMS task completed.', item: row });
  },

  async getTodos(employeeId) {
    const data = await rows();
    return ok({ data: data.todos.filter((t) => eq(t['Employee ID'], employeeId)).map(asTodoRow) });
  },

  async addTodo(employeeId, task, priority, dueDate, tat) {
    const gate = await requireAttendanceActive(employeeId);
    if (gate) return gate;
    const id = `TODO_${Date.now()}`;
    const data = await rows();
    const user = data.users.find((item) => eq(item['Employee ID'], employeeId));
    const row = {
      'Task ID': id,
      TodoID: id,
      'Employee ID': employeeId,
      'Employee Name': first(user, ['Employee Name', 'Name']),
      Task: task,
      Description: task,
      Priority: priority || 'Medium',
      'Due Date': dueDate,
      Date: dueDate,
      TAT: tat || '',
      Status: 'Pending'
    };
    await insertRow('Todo', row);
    return ok({ item: row });
  },

  async createTodoInSheet(todoData = {}) {
    const id = first(todoData, ['Task ID', 'TodoID'], `TODO_${Date.now()}`);
    const row = {
      'Task ID': id,
      TodoID: id,
      'Employee ID': first(todoData, ['Employee ID', 'EmpID']),
      Task: first(todoData, ['Task', 'Description', 'Task Description']),
      Description: first(todoData, ['Description', 'Task', 'Task Description']),
      Priority: first(todoData, ['Priority'], 'Medium'),
      'Due Date': first(todoData, ['Due Date', 'Plan Date', 'Date']),
      Date: first(todoData, ['Plan Date', 'Due Date', 'Date']),
      TAT: first(todoData, ['TAT', 'When']),
      Status: first(todoData, ['Status'], 'Pending')
    };
    await insertRow('Todo', row);
    return ok({ message: 'To-Do created.', item: row });
  },

  async toggleTodoStatus(taskId, currentStatus) {
    const data = await rows();
    const todo = data.todos.find((item) => eq(item['Task ID'] || item.TodoID, taskId));
    const gate = await requireAttendanceActive(todo?.['Employee ID']);
    if (gate) return gate;
    const nextStatus = isClosedStatus(currentStatus) ? 'Pending' : 'Completed';
    const row = await upsertRow('Todo', 'Task ID', taskId, { 'Task ID': taskId, Status: nextStatus });
    return ok({ item: row });
  },

  async editTodoItem(taskId, newTask, newPriority, newDueDate, newTAT) {
    const data = await rows();
    const todo = data.todos.find((item) => eq(item['Task ID'] || item.TodoID, taskId));
    const gate = await requireAttendanceActive(todo?.['Employee ID']);
    if (gate) return gate;
    const row = await upsertRow('Todo', 'Task ID', taskId, { 'Task ID': taskId, Task: newTask, Priority: newPriority, 'Due Date': newDueDate, TAT: newTAT });
    return ok({ item: row });
  },

  async deleteTodoItem(taskId) {
    const data = await rows();
    const todo = data.todos.find((item) => eq(item['Task ID'] || item.TodoID, taskId));
    const gate = await requireAttendanceActive(todo?.['Employee ID']);
    if (gate) return gate;
    const row = await upsertRow('Todo', 'Task ID', taskId, { 'Task ID': taskId, Status: 'Deleted' });
    return ok({ item: row });
  },

  async addBulkTodos(employeeId, todosList = []) {
    const gate = await requireAttendanceActive(employeeId);
    if (gate) return gate;
    const created = [];
    for (const item of todosList) {
      created.push((await handlers.addTodo(
        employeeId,
        item.task || item.Task,
        item.priority || item.Priority,
        item.dueDate || item['Due Date'],
        item.tat || item.TAT
      )).item);
    }
    return ok({ data: created });
  },

  async getTaskMessages(taskId) {
    return handlers.getMessagesForTask(taskId);
  },

  async getMessagesForTask(taskId) {
    const data = await rows();
    const messages = data.messages
      .filter((m) => eq(m.TaskID, taskId))
      .sort((a, b) => (Date.parse(a.Timestamp) || 0) - (Date.parse(b.Timestamp) || 0));
    return ok({ data: messages, messages });
  },

  async postTaskMessage(taskId, messageText, employeeId) {
    const gate = await requireAttendanceActive(employeeId);
    if (gate) return gate;
    const data = await rows();
    const user = data.users.find((u) => eq(u['Employee ID'], employeeId));
    const row = { MessageID: `MSG_${Date.now()}`, TaskID: taskId, Timestamp: nowIso(), Sender: user?.['Employee Name'] || employeeId, Message: messageText };
    await insertRow('Message', row);
    await upsertRow('Ticket', 'Ticket ID', taskId, {
      'Ticket ID': taskId,
      HasUnreadMessages: true,
      'Last Update Date': row.Timestamp,
      'Last Action By': row.Sender
    });
    return ok({ item: row });
  },

  async postMessage(taskId, messageText, client) {
    const row = { MessageID: `MSG_${Date.now()}`, TaskID: taskId, Timestamp: nowIso(), Sender: client?.['Client Name'] || 'Client', Message: messageText };
    await insertRow('Message', row);
    await upsertRow('Ticket', 'Ticket ID', taskId, {
      'Ticket ID': taskId,
      HasUnreadAdminMessages: true,
      'Last Update Date': row.Timestamp,
      'Last Action By': row.Sender
    });
    return ok({ item: row });
  },

  async markTicketMessagesAsRead(taskId, clientId) {
    const update = clientId
      ? { 'Ticket ID': taskId, HasUnreadMessages: false }
      : { 'Ticket ID': taskId, HasUnreadAdminMessages: false };
    const row = await upsertRow('Ticket', 'Ticket ID', taskId, update);
    return ok({ item: row });
  },

  async checkForNewNotifications(employeeId, lastCheckTimestamp = 0) {
    const data = await rows();
    const cutoff = Number(lastCheckTimestamp) || Date.parse(lastCheckTimestamp) || 0;
    const notifications = data.tickets
      .filter((ticket) => !employeeId || eq(ticket['Employee ID'], employeeId) || eq(ticket['Task Approver'], employeeId))
      .filter((ticket) => {
        const updateTime = Date.parse(first(ticket, ['Last Update Date', 'Timestamp', 'Date']));
        return !cutoff || Number.isNaN(updateTime) || updateTime >= cutoff;
      })
      .slice(0, 10)
      .map((ticket) => ({
        ...ticket,
        'Ticket ID': first(ticket, ['Ticket ID', 'ID']),
        'Last Update Date': first(ticket, ['Last Update Date', 'Timestamp', 'Date'], nowIso()),
        Message: `${first(ticket, ['Task Description', 'Description'], 'Ticket')} is ${first(ticket, ['Status'], 'Updated')}`
      }));
    return ok({ notifications, updates: notifications, serverTime: Date.now() });
  },

  async checkForNewUpdates(clientId, lastCheckTimestamp = new Date(0).toISOString()) {
    const data = await rows();
    const cutoff = Date.parse(lastCheckTimestamp) || 0;
    const ticketUpdates = data.tickets
      .filter((ticket) => eq(ticket.Client_Id, clientId) && !ticket.IsNotified)
      .filter((ticket) => {
        const updateTime = Date.parse(first(ticket, ['Last Update Date', 'Timestamp', 'Date']));
        return !cutoff || Number.isNaN(updateTime) || updateTime >= cutoff;
      })
      .map((ticket) => ({
        id: first(ticket, ['Ticket ID', 'ID']),
        type: 'Ticket',
        message: `${first(ticket, ['Task Description', 'Description'], 'Ticket')} is ${first(ticket, ['Status'], 'Updated')}`,
        timestamp: first(ticket, ['Last Update Date', 'Timestamp', 'Date'], nowIso())
      }));
    const socialUpdates = data.social
      .filter((post) => eq(post.Client_Id, clientId) && !post.IsNotified)
      .filter((post) => {
        const updateTime = Date.parse(first(post, ['Latest Update Date', 'Planned Post Date', 'Date']));
        return !cutoff || Number.isNaN(updateTime) || updateTime >= cutoff;
      })
      .map((post) => ({
        id: first(post, ['Post ID', 'ID']),
        type: 'Social Media',
        message: `${first(post, ['Description', 'Caption'], 'Social post')} is ${first(post, ['Status'], 'Updated')}`,
        timestamp: first(post, ['Latest Update Date', 'Planned Post Date', 'Date'], nowIso())
      }));
    return ok({ updates: [...ticketUpdates, ...socialUpdates].slice(0, 10), serverTime: nowIso() });
  },

  async markAsNotified(sheetName, keyColumn, id, updateData = {}) {
    const model = /ticket/i.test(sheetName) ? 'Ticket' : /social/i.test(sheetName) ? 'SocialMedia' : 'Message';
    const row = await upsertRow(model, keyColumn, id, { [keyColumn]: id, ...updateData });
    return ok({ item: row });
  },

  async getLatestPendingDate(clientId) {
    const ticketRes = await handlers.getClientTickets(clientId);
    const dates = ticketRes.data.map((t) => first(t, ['Plan Date', 'Date'])).filter(Boolean).sort();
    return ok({ date: dates[dates.length - 1] || today() });
  },

  async getTicketReportData(employeeId, startDate, endDate) {
    const data = await rows();
    const items = data.tickets.filter((t) => (!employeeId || eq(t['Employee ID'], employeeId) || ['Admin', 'Super Admin'].includes(employeeId)) && dateInRange(first(t, ['Plan Date', 'Date', 'Timestamp']), startDate, endDate)).map(asTicketRow);
    return ok({ data: items, summary: { total: items.length, open: items.filter((t) => !isClosedStatus(t.Status)).length, closed: items.filter((t) => isClosedStatus(t.Status)).length } });
  },

  async getFmsReportData(employeeId, role, startDate, endDate) {
    const data = await rows();
    const canSeeAll = ['Admin', 'Super Admin', 'HR', 'Manager'].includes(role);
    const items = data.fms.filter((t) => (canSeeAll || eq(t['Employee ID'], employeeId) || eq(t.empId, employeeId)) && dateInRange(first(t, ['Plan Date', 'Date']), startDate, endDate)).map(asFmsRow);
    return ok({ data: items, summary: { total: items.length, completed: items.filter((t) => isClosedStatus(t.Status)).length } });
  },

  async getKpiDetails(employeeId, kpiType, filterRange) {
    const dashboard = await handlers.getDashboardData(employeeId, filterRange);
    const d = dashboard.data;
    const map = {
      tickets: d.tickets,
      fms: d.fmsTasks,
      todos: d.todos,
      upcoming: d.upcomingTasks,
      todaysTasks: d.todaysTasks
    };
    return ok({ data: map[kpiType] || [] });
  },

  async exportReportForWeb(format = 'csv', sheetName = 'Report') {
    const data = await rows();
    const source = /ticket/i.test(sheetName) ? data.tickets : /fms/i.test(sheetName) ? data.fms : /attendance/i.test(sheetName) ? data.attendance : data.tickets;
    const headers = [...new Set(source.flatMap((row) => Object.keys(row)))];
    const normalizedFormat = safe(format).toLowerCase();
    const fileBase = cleanFileName(sheetName, 'report');

    if (normalizedFormat === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(source, { header: headers });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, fileBase.slice(0, 31) || 'Report');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return ok({
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `${fileBase}.xlsx`,
        base64Data: buffer.toString('base64')
      });
    }

    if (normalizedFormat === 'pdf') {
      const buffer = buildSimplePdf(String(sheetName || 'Report'), headers, source);
      return ok({
        mimeType: 'application/pdf',
        fileName: `${fileBase}.pdf`,
        base64Data: buffer.toString('base64')
      });
    }

    const csv = [headers.map(csvEscape).join(','), ...source.map((row) => headers.map((h) => csvEscape(row[h])).join(','))].join('\n');
    return ok({ mimeType: 'text/csv', fileName: `${fileBase}.csv`, base64Data: Buffer.from(csv).toString('base64') });
  },

  async getEmpMasterData() {
    const data = await rows();
    return ok({ data: data.users });
  },

  async getNextEmpCode(category = 'EMP') {
    const data = await rows();
    const prefixMap = {
      Master: 'MS',
      EMP: 'EMP',
      Employee: 'EMP',
      Freelancer: 'FR',
      Intern: 'IN'
    };
    const prefix = prefixMap[category] || String(category || 'EMP').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'EMP';
    const max = data.users.reduce((highest, user) => {
      const raw = first(user, ['EMP Code', 'Employee ID', 'User ID']);
      const match = String(raw).match(/(\d+)$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 100);
    return ok({ code: `${prefix}${max + 1}`, nextCode: `${prefix}${max + 1}` });
  },

  async saveOrUpdateUser(userData = {}) {
    const id = first(userData, ['Employee ID', 'User ID'], `EMP_${Date.now()}`);
    const row = await upsertRow('User', 'Employee ID', id, { ...userData, 'Employee ID': id, Status: userData.Status || 'Active' });
    return ok({ message: 'User saved.', item: row });
  },

  async saveEmpMasterData(category, formData = {}) {
    return handlers.saveOrUpdateUser(formData);
  },

  async saveEmpMasterDataWithFiles(category, formData = {}, filePayloads = []) {
    const urls = [];
    for (const file of filePayloads || []) urls.push(saveBase64File(file, 'employee_documents'));
    return handlers.saveOrUpdateUser({ ...formData, Documents: urls.join(', ') });
  },

  async getAllUsersForAdmin() {
    const data = await rows();
    return ok({ data: data.users });
  },

  async getAllManagersList() {
    const data = await rows();
    return data.users.filter((u) => /manager|admin|super admin/i.test(safe(u.Role))).map((u) => ({ id: u['Employee ID'], name: u['Employee Name'], role: u.Role }));
  },

  async getTeamIds(managerId) {
    const data = await rows();
    const target = safe(managerId).toLowerCase();
    return data.users
      .filter((user) => {
        const managers = safe(user['Manager ID'] || user.Manager).toLowerCase().split(',').map((id) => id.trim());
        const approvers = safe(user['Task Approver'] || user.Approver).toLowerCase().split(',').map((id) => id.trim());
        return managers.includes(target) || approvers.includes(target);
      })
      .map((user) => safe(user['Employee ID']).toUpperCase())
      .filter(Boolean);
  },

  async getMyTeamMembers(managerId) {
    const data = await rows();
    const directReports = data.users.filter((u) => eq(u.Manager || u['Manager ID'], managerId));
    if (directReports.length) return directReports;
    return data.users.filter((u) => !eq(u['Employee ID'], managerId) && eq(u.Status || 'Active', 'Active'));
  },

  async getTaskApproversList() {
    const data = await rows();
    return data.users.filter((u) => /manager|admin|super admin|hr/i.test(safe(u.Role))).map((u) => ({ id: u['Employee ID'], name: u['Employee Name'], role: u.Role }));
  },

  async getFormsData() {
    const data = await rows();
    return ok({ data: data.forms });
  },

  async saveFormsPortalData(formData = {}) {
    const key = first(formData, ['Form ID', 'Sheet name'], `FORM_${Date.now()}`);
    const row = await upsertRow('FormsPortal', 'Sheet name', key, { ...formData, 'Sheet name': key });
    return ok({ message: 'Form saved.', item: row });
  },

  async addFormsPortalData(formData = {}) {
    const row = { 'Form ID': `FORM_${Date.now()}`, ...formData };
    await insertRow('FormsPortal', row);
    return ok({ message: 'Form added.', item: row });
  },

  async deleteFormsPortalData(sheetName) {
    const row = await deleteOrDeactivate('FormsPortal', 'Sheet name', sheetName);
    return ok({ message: 'Form deleted.', item: row });
  },

  async getClientsPortalData() {
    const data = await rows();
    return ok({ data: data.clients });
  },

  async saveClientPortalData(clientData = {}) {
    const id = first(clientData, ['Client_Id', 'Client ID'], `CL_${Date.now()}`);
    const row = await upsertRow('Client', 'Client_Id', id, { ...clientData, Client_Id: id, Status: clientData.Status || 'Active' });
    return ok({ message: 'Client saved.', item: row });
  },

  async deleteClientPortalData(clientId) {
    const row = await deleteOrDeactivate('Client', 'Client_Id', clientId);
    return ok({ message: 'Client deactivated.', item: row });
  },

  async checkUserAttendanceActive(employeeId) {
    const data = await rows();
    const active = isAttendanceActive(data.attendance, employeeId);
    return ok({ active, status: active ? 'In' : 'Out' });
  },

  async enforceAttendanceGate(employeeId) {
    const gate = await requireAttendanceActive(employeeId);
    return gate || ok({ active: true, status: 'In' });
  },

  async processExpenseApproval(expenseId, status, remarks, adminId) {
    const gate = await requireAttendanceActive(adminId);
    if (gate) return gate;
    const row = await upsertRow('Expense', 'ExpenseID', expenseId, { ExpenseID: expenseId, Status: status, Remarks: remarks, 'Approved By': adminId });
    return ok({ item: row });
  },

  async checkTicketTatReminders() {
    const data = await rows();
    const now = Date.now();
    const activeTickets = data.tickets.filter((ticket) => /in[-\s]?progress/i.test(safe(ticket.Status)) && num(ticket.TAT) > 0);
    const reminders = activeTickets.map((ticket) => {
      const rawStart = first(ticket, ['Last Update Date', 'Start Time', 'Timestamp', 'Plan Date']);
      const start = new Date(rawStart).getTime();
      if (!Number.isFinite(start)) return null;
      const deadline = start + num(ticket.TAT) * 60 * 1000;
      const remainingMinutes = Math.round((deadline - now) / 60000);
      return {
        'Ticket ID': ticket['Ticket ID'],
        'Employee ID': ticket['Employee ID'],
        'Employee Name': ticket['Employee Name'],
        remainingMinutes,
        overdue: remainingMinutes < 0,
        Status: ticket.Status
      };
    }).filter(Boolean);
    return ok({
      checked: activeTickets.length,
      reminders,
      message: `Checked ${activeTickets.length} active ticket(s) for TAT reminders.`
    });
  }
};

router.post('/resetDemoData', async (_req, res) => {
  try {
    await resetLegacyStore();
    res.json(ok({ message: 'Demo data reset.' }));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(error.message));
  }
});

router.post('/:functionName', async (req, res) => {
  const fn = handlers[req.params.functionName];
  if (!fn) {
    console.warn(`Unmapped Apps Script function: ${req.params.functionName}`);
    return res.json(fail(`Function ${req.params.functionName} is not mapped in MERN yet.`));
  }

  try {
    const result = await fn(...(req.body.args || []));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(error.message));
  }
});

export default router;
