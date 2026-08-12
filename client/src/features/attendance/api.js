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

export async function fetchTeamAttendance(startDate, endDate) {
  return httpClient('/api/attendance/team/list', {
    method: 'POST',
    body: JSON.stringify({
      startDate,
      endDate
    })
  });
}

export async function fetchTeamAttendanceCalendar(employeeId, startDate, endDate) {
  return httpClient('/api/attendance/team/calendar', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      startDate,
      endDate
    })
  });
}

export async function updateTeamAttendance(payload) {
  return httpClient('/api/attendance/team/update', {
    method: 'POST',
    body: JSON.stringify({
      payload
    })
  });
}

export async function fetchAttendanceLocationPolicy() {
  return httpClient('/api/attendance/location-policy', {
    method: 'GET'
  });
}

export async function saveAttendanceLocationPolicy(payload) {
  return httpClient('/api/attendance/location-policy', {
    method: 'POST',
    body: JSON.stringify({
      payload
    })
  });
}
