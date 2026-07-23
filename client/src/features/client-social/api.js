import { httpClient } from '@/lib/api/httpClient';

export async function fetchClientSocialTasks(clientId, startDate = null, endDate = null) {
  return httpClient('/api/client-social/tasks', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      startDate,
      endDate
    })
  });
}

export async function fetchSocialTaskDetails(postId, clientId) {
  return httpClient('/api/client-social/details', {
    method: 'POST',
    body: JSON.stringify({
      postId,
      clientId
    })
  });
}

export async function fetchSocialTaskHistory(postId, clientId) {
  return httpClient('/api/client-social/history', {
    method: 'POST',
    body: JSON.stringify({
      postId,
      clientId
    })
  });
}

export async function updateClientSocialStatus(postId, newStatus, remarks, client) {
  return httpClient('/api/client-social/update-status', {
    method: 'POST',
    body: JSON.stringify({
      postId,
      newStatus,
      remarks,
      client
    })
  });
}

export async function addClientSocialRemark(historyId, clientRemark, clientId) {
  return httpClient('/api/client-social/history/remark', {
    method: 'POST',
    body: JSON.stringify({
      historyId,
      clientRemark,
      clientId
    })
  });
}
