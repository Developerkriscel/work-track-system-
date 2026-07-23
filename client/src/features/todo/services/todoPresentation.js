export function todoStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('completed')) return 'success';
  if (normalized.includes('approval')) return 'info';
  if (normalized.includes('pending')) return 'warning';
  if (normalized.includes('delete')) return 'danger';
  return 'neutral';
}

export function formatTodoDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function getTodoSummary(rows = []) {
  const activeRows = rows.filter((row) => !String(row.Status || '').toLowerCase().includes('deleted'));
  const pending = activeRows.filter((row) => String(row.Status || '').toLowerCase().includes('pending')).length;
  const completed = activeRows.filter((row) => String(row.Status || '').toLowerCase().includes('completed')).length;
  return {
    total: activeRows.length,
    pending,
    completed
  };
}
