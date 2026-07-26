export function todayYmd() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatElapsed(startedAt) {
  if (!startedAt) return '00:00:00';
  const diff = Date.now() - new Date(startedAt).getTime();
  const hours = `${Math.floor(diff / 3600000)}`.padStart(2, '0');
  const minutes = `${Math.floor((diff % 3600000) / 60000)}`.padStart(2, '0');
  const seconds = `${Math.floor((diff % 60000) / 1000)}`.padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function formatPunchTime(value) {
  if (!value) return '-';
  const raw = String(value).trim();
  const parsed = /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw) ? new Date(raw) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
}

export function toneForAttendanceStatus(status) {
  if (/present/i.test(status)) return 'success';
  if (/on time|early/i.test(status)) return 'success';
  if (/late/i.test(status)) return 'warning';
  if (/weekend|weekly off/i.test(status)) return 'danger';
  if (/pending/i.test(status)) return 'info';
  if (/approved/i.test(status)) return 'success';
  if (/rejected|absent/i.test(status)) return 'danger';
  return 'warning';
}
