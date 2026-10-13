import { httpClient } from '@/lib/api/httpClient';

export async function fetchAssetsOverview() {
  return httpClient('/api/assets/overview', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function createAssetRecord(payload) {
  return httpClient('/api/assets/create', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAssetRecord(payload) {
  return httpClient('/api/assets/update', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function assignAssetRecord(payload) {
  return httpClient('/api/assets/assign', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function returnAssetRecord(payload) {
  return httpClient('/api/assets/return', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function submitAssetRequestRecord(payload) {
  return httpClient('/api/assets/request', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function approveAssetRequestRecord(payload) {
  return httpClient('/api/assets/approve', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
