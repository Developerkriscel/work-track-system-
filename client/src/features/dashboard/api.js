import { httpClient } from '@/lib/api/httpClient';

export async function fetchDashboardData(employeeId, filterRange, viewMode = 'my', options = {}, signal) {
  return httpClient('/api/dashboard/data', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      employeeId,
      filterRange,
      viewMode,
      ...options
    })
  });
}
