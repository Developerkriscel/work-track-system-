import { httpClient } from '@/lib/api/httpClient';

export function fetchEmpMasterData(category) {
  return httpClient('/api/emp-master/data', {
    method: 'POST',
    body: JSON.stringify({ category })
  });
}

export function fetchNextEmpCode(category) {
  return httpClient('/api/emp-master/next-code', {
    method: 'POST',
    body: JSON.stringify({ category })
  });
}

export function saveEmpMasterRecord(category, formData, filePayloads) {
  return httpClient('/api/emp-master/save', {
    method: 'POST',
    body: JSON.stringify({ category, formData, filePayloads })
  });
}
