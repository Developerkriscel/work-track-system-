import { httpClient } from '@/lib/api/httpClient';

export async function loginEmployee(employeeId, password) {
  return httpClient('/api/auth/employee/login', {
    method: 'POST',
    body: JSON.stringify({ employeeId, password })
  });
}

export async function fetchEmployeeSession(employeeId) {
  return httpClient('/api/auth/employee/session', {
    method: 'POST',
    body: JSON.stringify({ employeeId })
  });
}

export async function loginClient(clientId, password) {
  return httpClient('/api/auth/client/login', {
    method: 'POST',
    body: JSON.stringify({ clientId, password })
  });
}

export async function fetchClientSession(clientId) {
  return httpClient('/api/auth/client/session', {
    method: 'POST',
    body: JSON.stringify({ clientId })
  });
}

export async function changeEmployeePassword(employeeId, currentPassword, nextPassword) {
  return httpClient('/api/auth/employee/change-password', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      currentPassword,
      nextPassword
    })
  });
}

export async function updateEmployeeProfile(employeeId, { avatarBase64, email, phone }) {
  return httpClient('/api/auth/employee/update-profile', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      avatarBase64,
      email,
      phone
    })
  });
}

export async function changeClientPassword(clientId, currentPassword, nextPassword) {
  return httpClient('/api/auth/client/change-password', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      currentPassword,
      nextPassword
    })
  });
}

export async function updateClientProfile(clientId, { avatarBase64, email, phone }) {
  return httpClient('/api/auth/client/update-profile', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      avatarBase64,
      email,
      phone
    })
  });
}
