export const managementRangeOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'all', label: 'All Time' }
];

function toYmd(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function managementRangeBounds(range) {
  const current = new Date();
  current.setHours(12, 0, 0, 0);

  switch (range) {
    case 'today':
      return { startDate: toYmd(current), endDate: toYmd(current) };
    case 'week': {
      const day = current.getDay();
      const offset = day === 0 ? 6 : day - 1;
      const start = new Date(current);
      start.setDate(current.getDate() - offset);
      return { startDate: toYmd(start), endDate: toYmd(current) };
    }
    case 'last_week': {
      const day = current.getDay();
      const offset = day === 0 ? 6 : day - 1;
      const end = new Date(current);
      end.setDate(current.getDate() - offset - 1);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return { startDate: toYmd(start), endDate: toYmd(end) };
    }
    case 'month': {
      const start = new Date(current.getFullYear(), current.getMonth(), 1, 12);
      return { startDate: toYmd(start), endDate: toYmd(current) };
    }
    case 'last_month': {
      const start = new Date(current.getFullYear(), current.getMonth() - 1, 1, 12);
      const end = new Date(current.getFullYear(), current.getMonth(), 0, 12);
      return { startDate: toYmd(start), endDate: toYmd(end) };
    }
    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
}

export function formatManagementCurrency(value) {
  return `Rs${Number(value || 0).toFixed(2)}`;
}

export function formatManagementDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function managementStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('completed') || normalized.includes('approved') || normalized.includes('closed')) return 'success';
  if (normalized.includes('progress') || normalized.includes('scheduled')) return 'info';
  if (normalized.includes('pending')) return 'warning';
  if (normalized.includes('late') || normalized.includes('reject')) return 'danger';
  return 'neutral';
}
