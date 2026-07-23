export function clientStatusTone(status) {
  return String(status || '').toLowerCase() === 'active' ? 'success' : 'danger';
}
