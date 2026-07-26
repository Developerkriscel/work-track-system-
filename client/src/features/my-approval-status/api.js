import { httpClient } from '@/lib/api/httpClient';

export async function fetchMyApprovalStatus() {
  return httpClient('/api/my-approval-status/list', {
    method: 'POST',
    body: JSON.stringify({})
  });
}
