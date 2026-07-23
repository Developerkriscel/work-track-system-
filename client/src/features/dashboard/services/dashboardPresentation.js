export function formatDashboardCurrency(amount) {
  const value = Number(amount || 0);
  return `Rs${value.toFixed(2)}`;
}

export function clampDashboardPercent(value) {
  const num = Number(value || 0);
  return Math.max(0, Math.min(100, num));
}
