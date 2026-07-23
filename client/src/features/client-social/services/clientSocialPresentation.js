const CLIENT_SOCIAL_STORAGE_KEY = 'worktrack.mern.clientSocial.clientId';

export function readStoredClientSocialId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CLIENT_SOCIAL_STORAGE_KEY) || '';
}

export function persistClientSocialId(clientId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLIENT_SOCIAL_STORAGE_KEY, clientId);
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

export function getClientSocialSummary(rows = []) {
  return {
    total: rows.length,
    pending: rows.filter((row) => String(row.Status || '').toLowerCase().includes('pending')).length,
    postedOrApproved: rows.filter((row) => /approved|posted|scheduled/i.test(String(row.Status || ''))).length
  };
}
