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
  if (normalized === 'in progress') return 'info';
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
