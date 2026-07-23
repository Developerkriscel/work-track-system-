export const fmsTabs = [
  { id: 'my-pending', label: 'My Pending' },
  { id: 'my-future', label: 'Future Tasks' },
  { id: 'my-completed', label: 'My Completed' },
  { id: 'team-pending', label: 'Team Pending', teamOnly: true },
  { id: 'team-future', label: 'Team Future', teamOnly: true },
  { id: 'team-completed', label: 'Team Completed', teamOnly: true }
];

export function showFmsTeamTabs(role) {
  return role === 'Manager' || role === 'Admin' || role === 'Super Admin' || role === 'HR';
}

export function fmsStatusTone(task) {
  if (task._completed) return 'success';
  if (task._future) return 'info';
  if (String(task.onTimeStatus || task['On Time Status'] || '').toLowerCase() === 'late') return 'danger';
  return 'warning';
}

export function formatFmsPlanDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function getFmsTaskStatusLabel(task) {
  if (task._completed) {
    return `Completed${task.onTimeStatus || task['On Time Status'] ? ` - ${task.onTimeStatus || task['On Time Status']}` : ''}`;
  }
  if (task._future) return 'Future';
  return task.Status || 'Pending';
}
