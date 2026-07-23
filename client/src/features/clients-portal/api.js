import { httpClient } from '@/lib/api/httpClient';

export async function fetchClientsPortalData() {
  return httpClient('/api/clients-portal/list', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function saveClientPortalData(clientData, adminId) {
  return httpClient('/api/clients-portal/save', {
    method: 'POST',
    body: JSON.stringify({
      clientData,
      adminId
    })
  });
}

export async function deleteClientPortalData(clientId, adminId) {
  return httpClient('/api/clients-portal/delete', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      adminId
    })
  });
}
