import { httpClient } from '@/lib/api/httpClient';

export async function fetchManagementDashboardData(startDate, endDate) {
  return httpClient('/api/management-dashboard/data', {
    method: 'POST',
    body: JSON.stringify({
      startDate,
      endDate
    })
  });
}

export async function submitManagementBatch(adminId, type, employeeId, tasks) {
  return httpClient('/api/management-dashboard/batch', {
    method: 'POST',
    body: JSON.stringify({ adminId, type, employeeId, tasks })
  });
}
