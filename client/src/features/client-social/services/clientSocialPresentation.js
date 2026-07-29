const CLIENT_SOCIAL_STORAGE_KEY = 'worktrack.mern.clientSocial.clientId';

export function readStoredClientSocialId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CLIENT_SOCIAL_STORAGE_KEY) || '';
}

export function persistClientSocialId(clientId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLIENT_SOCIAL_STORAGE_KEY, clientId);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const CLIENT_SOCIAL_RANGE_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' }
]);

export function resolveClientSocialRange(range, customStart = '', customEnd = '') {
  if (range === 'custom') {
    return {
      startDate: customStart || null,
      endDate: customEnd || null
    };
  }

  if (range === 'all') {
    return { startDate: null, endDate: null };
  }

  const now = new Date();
  const end = toIsoDate(now);

  if (range === 'today') {
    return { startDate: end, endDate: end };
  }

  if (range === 'week') {
    const start = new Date(now);
    const day = start.getDay();
    const offset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - offset);
    return {
      startDate: toIsoDate(start),
      endDate: end
    };
  }

  if (range === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: toIsoDate(start),
      endDate: end
    };
  }

  return { startDate: null, endDate: null };
}

export function formatClientSocialDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function clientSocialStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('approved') || normalized.includes('posted') || normalized.includes('scheduled')) return 'success';
  if (normalized.includes('feedback') || normalized.includes('change')) return 'danger';
  if (normalized.includes('pending')) return 'warning';
  return 'neutral';
}

export function canApproveClientSocial(status) {
  const normalized = String(status || '').toLowerCase();
  return !(
    normalized.includes('approved by client')
    || normalized.includes('posted')
    || normalized.includes('scheduled')
  );
}

export function canRequestChangesClientSocial(status) {
  const normalized = String(status || '').toLowerCase();
  return !(
    normalized.includes('posted')
    || normalized.includes('scheduled')
  );
}

export function getClientSocialSummary(rows = []) {
  return {
    total: rows.length,
    pending: rows.filter((row) => String(row.Status || '').toLowerCase().includes('pending')).length,
    postedOrApproved: rows.filter((row) => /approved|posted|scheduled/i.test(String(row.Status || ''))).length
  };
}
