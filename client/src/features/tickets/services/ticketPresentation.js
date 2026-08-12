export function todayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatPlanDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function toneForTicketStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'in progress') return 'success';
  if (normalized === 'open' || normalized === 'paused') return 'warning';
  if (normalized === 'rework' || normalized === 'reassigned') return 'danger';
  if (normalized.includes('pending')) return 'warning';
  if (normalized === 'closed' || normalized.includes('approved')) return 'success';
  return 'neutral';
}

export function toneForTicketPriority(priority) {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'super urgent') return 'danger';
  if (normalized === 'high' || normalized === 'urgent') return 'warning';
  if (normalized === 'low') return 'neutral';
  return 'info';
}

function firstMatchingUserName(users = [], id = '') {
  const normalizedId = String(id || '').trim().toLowerCase();
  if (!normalizedId) return '';
  const match = users.find((user) => {
    const userId = String(user['Employee ID'] || user['User ID'] || user['EMP Code'] || user.employeeId || user.EmpID || user.id || '').trim().toLowerCase();
    return userId === normalizedId;
  });
  const resolved = String(match?.['Employee Name'] || match?.Name || match?.['Full Name'] || match?.name || '').trim();
  return resolved && resolved.toLowerCase() !== normalizedId ? resolved : '';
}

export function formatTicketAssignee(ticket = {}, users = []) {
  const id = String(ticket['Employee ID'] || ticket.employeeId || ticket.EmpID || ticket.id || '').trim();
  const rawName = String(ticket['Employee Name'] || ticket.EmployeeName || ticket.User || ticket.name || '').trim();
  const lookupName = firstMatchingUserName(users, id);
  const name = [rawName, lookupName].find((value) => value && value.toLowerCase() !== id.toLowerCase()) || '';
  return {
    id: id || '-',
    name
  };
}
