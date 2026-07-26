import XLSX from 'xlsx';
import { listRows } from './legacyStore.service.js';

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const isClosedStatus = (status = '') => closedTerms.some((term) => safe(status).toLowerCase().includes(term));
const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const cleanFileName = (value, fallback = 'report') =>
  String(value || fallback).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function normalizedDate(value) {
  if (!value) return '';
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function dateInRange(value, start, end) {
  if (!start || !end || !value) return true;
  const d = normalizedDate(value);
  return d >= start && d <= end;
}

function splitIds(value) {
  return safe(value)
    .split(/[,;|]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function teamMemberIds(users, managerId) {
  const target = safe(managerId).toLowerCase();
  return users
    .filter((user) => {
      const managers = splitIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
      const approvers = splitIds(first(user, ['Task Approver', 'Approver ID', 'taskApprover']));
      return managers.includes(target) || approvers.includes(target);
    })
    .map((user) => first(user, ['Employee ID', 'User ID', 'employeeId']).toLowerCase())
    .filter(Boolean);
}

function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(title, headers, sourceRows) {
  const lines = [String(title || 'Report'), `Generated: ${referenceNow().toLocaleString('en-IN')}`, '', headers.join(' | ')];
  for (const row of sourceRows.slice(0, 150)) {
    const raw = headers.map((header) => String(row[header] ?? '').replace(/\s+/g, ' ').trim()).join(' | ');
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
    'Task Approver': first(row, ['Task Approver', 'taskApprover', 'Approver ID'])
  };
}

function asFmsRow(row = {}) {
  const id = first(row, ['Task ID', 'FMS ID', 'ID', 'rowId', 'taskId']);
  const employeeId = first(row, ['Employee ID', 'EmpID', 'empId', 'employeeId']);
  const employeeName = first(row, ['Employee Name', 'User', 'who', 'employeeName'], employeeId);
  const clientId = first(row, ['Client_Id', 'Client ID', 'clientId']);
  const client = first(row, ['Client', 'Client Name', 'fmsName', 'clientName']);
  const description = first(row, ['Task Description', 'Description', 'Task Name', 'taskName', 'description']);
  const planDate = first(row, ['Plan Date', 'Date', 'planDate']);
  const doneDate = first(row, ['Done Date', 'actualDate', 'doneDate']);
  return {
    ...row,
    'Task ID': id,
    ID: id,
    rowId: id,
    Client_Id: clientId,
    Client: client,
    'Client Name': client,
    'Employee ID': employeeId,
    EmpID: employeeId,
    empId: employeeId,
    'Employee Name': employeeName,
    User: employeeName,
    who: employeeName,
    What: first(row, ['what', 'What'], ''),
    When: first(row, ['when', 'When'], ''),
    How: first(row, ['how', 'How'], ''),
    'FMS Name': client,
    fmsName: client,
    'Task Description': description,
    Description: description,
    'Task Name': description,
    taskName: description,
    stepNo: first(row, ['stepNo', 'Step', 'Step No'], ''),
    'Plan Date': planDate,
    Date: planDate,
    planDate,
    Status: first(row, ['Status', 'status'], doneDate ? 'Completed' : 'Pending'),
    'Actual Date': doneDate,
    'Done Date': doneDate,
    actualDate: doneDate,
    Who: employeeName,
    'Assigned To': employeeName,
    formLink: first(row, ['formLink', 'Form Link', 'Form link'], ''),
    TAT: first(row, ['TAT', 'When', 'tatMinutes'], ''),
    delayDays: first(row, ['delayDays', 'Delay Days'], ''),
    onTimeStatus: first(row, ['onTimeStatus', 'On Time Status'], '')
  };
}

async function getRows() {
  const [tickets, fms, attendance, expenses, todos, leaves, intimations, users, clients, forms] = await Promise.all([
    listRows('Ticket'),
    listRows('FmsTask'),
    listRows('Attendance'),
    listRows('Expense'),
    listRows('Todo'),
    listRows('Leave'),
    listRows('Intimation'),
    listRows('User'),
    listRows('Client'),
    listRows('FormsPortal')
  ]);
  return { tickets, fms, attendance, expenses, todos, leaves, intimations, users, clients, forms };
}

export async function getTicketReportData(employeeId, role, startDate, endDate) {
  const data = await getRows();
  const normalizedRole = safe(role).toLowerCase();
  const canSeeAll = normalizedRole === 'super admin';
  const teamIds = canSeeAll ? [] : teamMemberIds(data.users, employeeId);
  const items = data.tickets
    .filter((ticket) => {
      const ownerId = first(ticket, ['Employee ID', 'EmpID', 'employeeId']).toLowerCase();
      const visible = canSeeAll || ownerId === safe(employeeId).toLowerCase() || (['admin', 'manager', 'hr'].includes(normalizedRole) && teamIds.includes(ownerId));
      return visible && dateInRange(first(ticket, ['Plan Date', 'Date', 'Timestamp', 'Close Date']), startDate, endDate);
    })
    .map((ticket) => asTicketRow(ticket, data.clients));
  return ok({
    data: items,
    summary: {
      total: items.length,
      open: items.filter((item) => !isClosedStatus(item.Status)).length,
      closed: items.filter((item) => isClosedStatus(item.Status)).length
    }
  });
}

export async function getFmsReportData(employeeId, role, startDate, endDate) {
  const data = await getRows();
  const normalizedRole = safe(role).toLowerCase();
  const canSeeAll = ['super admin', 'hr'].includes(normalizedRole);
  const teamIds = canSeeAll ? [] : teamMemberIds(data.users, employeeId);
  const items = data.fms
    .filter((task) => {
      const ownerId = safe(first(task, ['Employee ID', 'EmpID', 'empId'])).toLowerCase();
      const visible = canSeeAll || ownerId === safe(employeeId).toLowerCase() || (['admin', 'manager'].includes(normalizedRole) && teamIds.includes(ownerId));
      return visible && dateInRange(first(task, ['Plan Date', 'Date']), startDate, endDate);
    })
    .map((task) => asFmsRow(task));
  return ok({
    data: items,
    summary: {
      total: items.length,
      completed: items.filter((item) => isClosedStatus(item.Status)).length
    }
  });
}

export async function exportReportForWeb(format = 'csv', sheetName = 'Report', employeeId = '', role = '', startDate = '', endDate = '') {
  const data = await getRows();
  const normalizedRole = safe(role).toLowerCase();
  const ticketTeamIds = teamMemberIds(data.users, employeeId);
  const fmsTeamIds = teamMemberIds(data.users, employeeId);
  const canSeeAllTickets = normalizedRole === 'super admin';
  const canSeeAllFms = ['super admin', 'hr'].includes(normalizedRole);
  const tickets = data.tickets
    .filter((ticket) => {
      const ownerId = safe(first(ticket, ['Employee ID', 'EmpID', 'employeeId'])).toLowerCase();
      const visible =
        canSeeAllTickets ||
        ownerId === safe(employeeId).toLowerCase() ||
        (['admin', 'manager', 'hr'].includes(normalizedRole) && ticketTeamIds.includes(ownerId));
      return visible && dateInRange(first(ticket, ['Plan Date', 'Date', 'Timestamp']), startDate, endDate);
    })
    .map((ticket) => asTicketRow(ticket, data.clients));
  const fms = data.fms
    .filter((task) => {
      const ownerId = safe(first(task, ['Employee ID', 'EmpID', 'empId'])).toLowerCase();
      const visible =
        canSeeAllFms ||
        ownerId === safe(employeeId).toLowerCase() ||
        (['admin', 'manager'].includes(normalizedRole) && fmsTeamIds.includes(ownerId));
      return visible && dateInRange(first(task, ['Plan Date', 'Date']), startDate, endDate);
    })
    .map((task) => asFmsRow(task));
  const sheetKey = safe(sheetName).toLowerCase();
  const source =
    /ticket/.test(sheetKey) ? tickets :
    /fms/.test(sheetKey) ? fms :
    /attendance/.test(sheetKey) ? data.attendance :
    /expense/.test(sheetKey) ? data.expenses :
    /todo|to-do|to do/.test(sheetKey) ? data.todos :
    /leave/.test(sheetKey) ? data.leaves :
    /intimation/.test(sheetKey) ? data.intimations :
    /user|employee/.test(sheetKey) ? data.users :
    /client/.test(sheetKey) ? data.clients :
    /form/.test(sheetKey) ? data.forms :
    tickets;
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

  const csv = [headers.map(csvEscape).join(','), ...source.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
  return ok({ mimeType: 'text/csv', fileName: `${fileBase}.csv`, base64Data: Buffer.from(csv).toString('base64') });
}
