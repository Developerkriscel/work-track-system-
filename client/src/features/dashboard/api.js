import { httpClient } from '@/lib/api/httpClient';

export async function fetchDashboardData(employeeId, filterRange, viewMode = 'my', options = {}) {
  return httpClient('/api/dashboard/data', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      filterRange,
      viewMode,
      ...options
    })
  });
}
