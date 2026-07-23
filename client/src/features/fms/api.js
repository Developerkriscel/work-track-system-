import { httpClient } from '@/lib/api/httpClient';

export async function fetchFmsTasks(employeeId) {
  return httpClient('/api/fms/tasks', {
    method: 'POST',
    body: JSON.stringify({
      employeeId
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
