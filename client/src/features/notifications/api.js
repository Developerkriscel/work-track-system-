import { httpClient } from '@/lib/api/httpClient';

export async function fetchEmployeeNotifications(employeeId, lastCheckTimestamp = 0) {
  return httpClient('/api/notifications/employee', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      lastCheckTimestamp
    })
  });
}

export async function fetchClientNotifications(clientId, lastCheckTimestamp = new Date(0).toISOString()) {
  return httpClient('/api/notifications/client', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      lastCheckTimestamp
    })
  });
}
