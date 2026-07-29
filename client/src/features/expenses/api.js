import { httpClient } from '@/lib/api/httpClient';

export async function fetchExpensesForUser(employeeId) {
  return httpClient('/api/expenses/list', {
    method: 'POST',
    body: JSON.stringify({
      employeeId
    })
  });
}

export async function fetchExpenseApprovalQueue() {
  return httpClient('/api/expenses/queue', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function submitExpenseRecord(payload) {
  return httpClient('/api/expenses/record', {
    method: 'POST',
    body: JSON.stringify({
      payload
    })
  });
}

export async function submitExpenseApproval(payload) {
  return httpClient('/api/expenses/approve', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
