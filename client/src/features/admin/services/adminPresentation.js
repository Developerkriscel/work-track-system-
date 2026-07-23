export function adminStatusTone(status) {
  return String(status || '').toLowerCase() === 'active' ? 'success' : 'danger';
}
