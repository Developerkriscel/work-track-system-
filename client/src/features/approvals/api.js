import { httpClient } from '@/lib/api/httpClient';

export async function fetchPendingApprovals(employeeId) {
  return httpClient('/api/approvals/queue', {
    method: 'POST',
    body: JSON.stringify({
      employeeId
    })
  });
}

export async function submitApprovalAction(payload) {
  return httpClient('/api/approvals/action', {
    method: 'POST',
    body: JSON.stringify({
      payload
    })
  });
}

export async function submitTicketApproval(ticketId, adminId, action, remarks) {
  return httpClient('/api/approvals/ticket-action', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      adminId,
      action,
      remarks
    })
  });
}

export async function fetchTaskApproversList() {
  return httpClient('/api/approvals/approvers', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function transferTicketApproval(ticketId, targetManagerId, currentManagerId, remarks) {
  return httpClient('/api/approvals/transfer', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      targetManagerId,
      currentManagerId,
      remarks
    })
  });
}
