import { httpClient } from '@/lib/api/httpClient';

export async function fetchFmsTasks(employeeId, options = {}) {
  return httpClient('/api/fms/tasks', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      ...options
    })
  });
}

export async function fetchFmsAssignableUsers(employeeId) {
  return httpClient('/api/fms/assignable-users', {
    method: 'POST',
    body: JSON.stringify({
      employeeId
    })
  });
}

export async function createFmsTask(payload, employeeId) {
  return httpClient('/api/fms/create', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      payload
    })
  });
}

export async function markFmsTaskDone(rowId, remarks, employeeId) {
  return httpClient('/api/fms/complete', {
    method: 'POST',
    body: JSON.stringify({
      rowId,
      remarks,
      employeeId
    })
  });
}
