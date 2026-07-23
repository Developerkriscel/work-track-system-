import { httpClient } from '@/lib/api/httpClient';

export async function fetchAttendanceForUser(employeeId, startDate, endDate) {
  return httpClient('/api/attendance/list', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      startDate,
      endDate
    })
  });
}

export async function submitAttendanceRecord(payload) {
  return httpClient('/api/attendance/record', {
    method: 'POST',
    body: JSON.stringify({
      payload
    })
  });
}

export async function submitLeaveRequest(payload) {
  return httpClient('/api/attendance/leave', {
    method: 'POST',
    body: JSON.stringify({
      payload
    })
  });
}

export async function submitIntimation(payload) {
  return httpClient('/api/attendance/intimation', {
    method: 'POST',
    body: JSON.stringify({
      payload
    })
  });
}
