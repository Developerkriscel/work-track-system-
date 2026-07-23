export function formatApprovalDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function toneForApprovalStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('approved') || normalized === 'closed') return 'success';
  if (normalized.includes('rejected') || normalized.includes('rework')) return 'danger';
  if (normalized.includes('pending') || normalized.includes('submitted')) return 'warning';
  if (normalized.includes('progress')) return 'info';
  return 'neutral';
}
