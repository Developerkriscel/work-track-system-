import { httpClient } from '@/lib/api/httpClient';

export async function fetchTicketReportData(employeeId, startDate, endDate) {
  return httpClient('/api/reports/tickets', {
    method: 'POST',
    body: JSON.stringify({ employeeId, startDate, endDate })
  });
}

export async function fetchFmsReportData(employeeId, role, startDate, endDate) {
  return httpClient('/api/reports/fms', {
    method: 'POST',
    body: JSON.stringify({ employeeId, role, startDate, endDate })
  });
}

export async function exportReportForWeb(format, sheetName, employeeId, role, startDate, endDate, filters = {}) {
  return httpClient('/api/reports/export', {
    method: 'POST',
    body: JSON.stringify({ format, sheetName, employeeId, role, startDate, endDate, filters })
  });
}
