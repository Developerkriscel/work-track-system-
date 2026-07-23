export function visibleUsersSummary(form) {
  const visibilityType = String(form['Visibility Type'] || 'SELECTED_USERS').toUpperCase();
  const raw = String(form['Visible Users'] || form.Viewer || '').trim();
  if (visibilityType === 'ALL') {
    return { label: 'All Users', tone: 'success' };
  }
  if (!raw) {
    return { label: 'No Employees Selected', tone: 'neutral' };
  }
  const count = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean).length;
  return { label: `${count} Employee${count > 1 ? 's' : ''} Selected`, tone: 'info' };
}
