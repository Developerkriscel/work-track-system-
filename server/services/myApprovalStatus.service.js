import { listRows } from './legacyStore.service.js';

function safe(value) {
  return String(value ?? '').trim();
}

function eq(left, right) {
  return safe(left).toUpperCase() === safe(right).toUpperCase();
}

function first(row = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (safe(value)) return value;
  }
  return fallback;
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const text = safe(value);
  const parts = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!parts) return null;
  let year = Number(parts[3]);
  if (year < 100) year += 2000;
  const parsed = new Date(year, Number(parts[2]) - 1, Number(parts[1]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLabel(value) {
  const parsed = parseDateValue(value);
  if (!parsed) return safe(value) || '-';
  return parsed.toLocaleDateString('en-GB');
}

function statusTone(status = '') {
  const value = safe(status).toLowerCase();
  if (!value || value === '-') return 'neutral';
  if (/(approved|closed|hr approved)/i.test(value)) return 'success';
  if (/(rejected|rework)/i.test(value)) return 'danger';
  if (/(pending|submitted|need approval|waiting)/i.test(value)) return 'warning';
  return 'info';
}

function statusSortValue(status = '') {
  const value = safe(status).toLowerCase();
  if (/(pending|submitted|need approval|waiting)/i.test(value)) return 0;
  if (/(approved|closed|hr approved)/i.test(value)) return 1;
  if (/(rejected|rework)/i.test(value)) return 2;
  return 3;
}

function sortStamp(row) {
  return parseDateValue(row.sortDate)?.getTime() || 0;
}

function stableId(prefix, row, keys) {
  return safe(first(row, keys)) || `${prefix}_${safe(first(row, ['employeeId', 'Employee ID', 'EmpID'], 'UNKNOWN'))}_${safe(first(row, ['date', 'Date', 'startDate', 'Start Date', 'planDate', 'Plan Date'], 'NO_DATE'))}`;
}

export async function getMyApprovalStatus(employeeId) {
  const targetEmployeeId = safe(employeeId);
  if (!targetEmployeeId) {
    return { success: false, message: 'Employee ID is required.' };
  }

  const [leaves, intimations, attendanceRows, tickets] = await Promise.all([
    listRows('Leave'),
    listRows('Intimation'),
    listRows('Attendance'),
    listRows('Ticket')
  ]);

  const leaveHistory = leaves
    .filter((row) => eq(first(row, ['Employee ID', 'EmpID', 'employeeId', 'User ID']), targetEmployeeId))
    .map((row) => ({
      id: stableId('leave', row, ['LeaveID', 'Leave ID', 'leaveId', 'ID']),
      Type: 'Leave',
      SubType: safe(first(row, ['Leave Type', 'type', 'leaveType'])) || '-',
      Date: formatDateLabel(first(row, ['Start Date', 'startDate', 'date'])),
      Reason: safe(first(row, ['Reason', 'reason'])) || '-',
      Status: safe(first(row, ['Status', 'status', 'Admin Approval', 'adminApproval'])) || 'Pending',
      Remarks: safe(first(row, ['Admin Remarks', 'adminRemarks', 'remarks'])) || '-',
      tone: statusTone(first(row, ['Status', 'status', 'Admin Approval', 'adminApproval'])),
      sortDate: first(row, ['Start Date', 'startDate', 'date'])
    }));

  const intimationHistory = intimations
    .filter((row) => eq(first(row, ['Employee ID', 'EmpID', 'employeeId', 'User ID']), targetEmployeeId))
    .map((row) => ({
      id: stableId('intimation', row, ['IntimationID', 'Intimation ID', 'intimationId', 'ID']),
      Type: 'Intimation',
      SubType: safe(first(row, ['Intimation Type', 'type', 'intimationType'])) || '-',
      Date: formatDateLabel(first(row, ['Intimation Date', 'date', 'intimationDate'])),
      Reason: safe(first(row, ['Reason', 'reason'])) || '-',
      Status: safe(first(row, ['Status', 'status', 'Admin Approval', 'adminApproval'])) || 'Submitted',
      Remarks: safe(first(row, ['Admin Remarks', 'adminRemarks', 'remarks'])) || '-',
      tone: statusTone(first(row, ['Status', 'status', 'Admin Approval', 'adminApproval'])),
      sortDate: first(row, ['Intimation Date', 'date', 'intimationDate'])
    }));

  const attendanceHistory = attendanceRows
    .filter((row) => eq(first(row, ['Employee ID', 'EmpID', 'employeeId', 'User ID']), targetEmployeeId))
    .filter((row) => {
      const status = safe(first(row, ['Status', 'status']));
      const approval = safe(first(row, ['Admin Approval', 'adminApproval']));
      return /(need approval|pending|approved|rejected)/i.test(status) || /(pending|approved|rejected)/i.test(approval);
    })
    .map((row) => ({
      id: stableId('attendance', row, ['AttendanceID', 'attendanceId', 'ID']),
      Type: 'Attendance',
      SubType: safe(first(row, ['Action', 'action'])) || 'Punch Approval',
      Date: formatDateLabel(first(row, ['Date', 'date'])),
      Reason: 'Punch Approval',
      Status: safe(first(row, ['Admin Approval', 'adminApproval', 'Status', 'status'])) || 'Pending',
      Remarks: safe(first(row, ['Admin Remarks', 'adminRemarks', 'Remarks', 'remarks'])) || '-',
      tone: statusTone(first(row, ['Admin Approval', 'adminApproval', 'Status', 'status'])),
      sortDate: first(row, ['Date', 'date'])
    }));

  const ticketHistory = tickets
    .filter((row) => eq(first(row, ['Employee ID', 'EmpID', 'employeeId', 'User ID']), targetEmployeeId))
    .filter((row) => /(pending approval|rework|closed|reassign|reassigned|rejected|approved)/i.test(safe(first(row, ['Status', 'status']))))
    .map((row) => ({
      id: stableId('ticket', row, ['Ticket ID', 'Task ID', 'ticketId', 'taskId', 'ID']),
      Type: 'Ticket',
      SubType: safe(first(row, ['Task Category', 'Category', 'category'])) || '-',
      Date: formatDateLabel(first(row, ['Plan Date', 'planDate', 'Date', 'date', 'Timestamp', 'timestamp'])),
      Reason: safe(first(row, ['Task Description', 'Description', 'description'])) || '-',
      Status: safe(first(row, ['Status', 'status'])) || '-',
      Remarks: safe(first(row, ['Remarks', 'remarks'])) || '-',
      tone: statusTone(first(row, ['Status', 'status'])),
      sortDate: first(row, ['Plan Date', 'planDate', 'Date', 'date', 'Timestamp', 'timestamp'])
    }));

  const data = [
    ...leaveHistory,
    ...intimationHistory,
    ...attendanceHistory,
    ...ticketHistory
  ].sort((left, right) => {
    const dateDelta = sortStamp(right) - sortStamp(left);
    if (dateDelta !== 0) return dateDelta;
    return statusSortValue(left.Status) - statusSortValue(right.Status);
  });

  return { success: true, data };
}
