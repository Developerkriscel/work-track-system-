import { httpClient } from '@/lib/api/httpClient';

export async function fetchFormsData(employeeId) {
  return httpClient('/api/forms-portal/list', {
    method: 'POST',
    body: JSON.stringify({
      employeeId
    })
  });
}

export async function fetchFormsAssignableUsers(adminId) {
  return httpClient('/api/forms-portal/assignable-users', {
    method: 'POST',
    body: JSON.stringify({
      adminId
    })
  });
}

export async function saveFormsPortalData(formData, adminId) {
  return httpClient('/api/forms-portal/save', {
    method: 'POST',
    body: JSON.stringify({
      formData,
      adminId
    })
  });
}

export async function addFormsPortalData(formData, adminId) {
  return httpClient('/api/forms-portal/add', {
    method: 'POST',
    body: JSON.stringify({
      formData,
      adminId
    })
  });
}

export async function deleteFormsPortalData(sheetName, adminId) {
  return httpClient('/api/forms-portal/delete', {
    method: 'POST',
    body: JSON.stringify({
      sheetName,
      adminId
    })
  });
}
