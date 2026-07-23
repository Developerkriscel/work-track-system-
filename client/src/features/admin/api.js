import { httpClient } from '@/lib/api/httpClient';

export async function fetchAllUsersForAdmin(adminId) {
  return httpClient('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ adminId })
  });
}

export async function fetchAllManagersList() {
  return httpClient('/api/admin/managers', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function fetchEmpMasterData(category = 'Master') {
  return httpClient('/api/admin/emp-master', {
    method: 'POST',
    body: JSON.stringify({ category })
  });
}

export async function fetchNextEmpCode(category = 'Master') {
  return httpClient('/api/admin/next-code', {
    method: 'POST',
    body: JSON.stringify({ category })
  });
}

export async function saveOrUpdateUser(userData, adminId) {
  return httpClient('/api/admin/save-user', {
    method: 'POST',
    body: JSON.stringify({ userData, adminId })
  });
}

export async function saveEmpMasterData(category, formData, adminId) {
  return httpClient('/api/admin/save-emp-master', {
    method: 'POST',
    body: JSON.stringify({ category, formData, adminId })
  });
}
