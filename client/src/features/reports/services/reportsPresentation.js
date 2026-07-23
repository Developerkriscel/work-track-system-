export function formatReportDate(value) {
  if (!value) return '-';
  const text = String(value).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function toneForReportStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('closed') || normalized.includes('done') || normalized.includes('completed')) return 'success';
  if (normalized.includes('open') || normalized.includes('progress') || normalized.includes('running')) return 'info';
  if (normalized.includes('pending')) return 'warning';
  if (normalized.includes('reject') || normalized.includes('cancel') || normalized.includes('failed')) return 'danger';
  return 'neutral';
}
