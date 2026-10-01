export function clientNumber(value) {
  return Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
}

export function clientCurrency(value) {
  return `Rs. ${clientNumber(value).toFixed(2)}`;
}

export function ticketStatusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('auto-approved')) return 'info';
  if (value.includes('approved')) return 'success';
  if (value.includes('closed') || value.includes('completed')) return 'success';
  if (value.includes('reject') || value.includes('cancel')) return 'danger';
  if (value.includes('pending client response')) return 'warning';
  if (value.includes('approval')) return 'warning';
  if (value.includes('progress') || value === 'open') return 'info';
  return 'neutral';
}

export function invoiceTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('paid')) return 'success';
  if (value.includes('cancel')) return 'danger';
  if (value.includes('outstanding') || value.includes('pending')) return 'warning';
  return 'neutral';
}

export function reportTypeTone(taskType) {
  const value = String(taskType || '').toLowerCase();
  if (value.includes('ticket')) return 'info';
  if (value.includes('checklist')) return 'neutral';
  if (value.includes('social')) return 'warning';
  if (value.includes('invoice')) return 'success';
  return 'neutral';
}

export function shortIsoDate(value) {
  if (!value) return '-';
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    return `${String(ymd[3]).padStart(2, '0')}-${String(ymd[2]).padStart(2, '0')}-${ymd[1]}`;
  }
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return `${String(dmy[1]).padStart(2, '0')}-${String(dmy[2]).padStart(2, '0')}-${dmy[3]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
