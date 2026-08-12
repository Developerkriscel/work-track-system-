import { httpClient } from '@/lib/api/httpClient';

export async function fetchMyApprovalStatus(payload = {}) {
  return httpClient('/api/my-approval-status/list', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
