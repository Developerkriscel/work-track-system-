export function formatExpenseDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function expenseStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('approved') || normalized.includes('paid')) return 'success';
  if (normalized.includes('reject')) return 'danger';
  if (normalized.includes('pending')) return 'warning';
  return 'neutral';
}

export function getExpenseSummary(expenses = []) {
  const pending = expenses.filter((item) => String(item.Status || '').toLowerCase().includes('pending')).length;
  return {
    total: expenses.length,
    pending,
    approvedOrOther: expenses.length - pending
  };
}
