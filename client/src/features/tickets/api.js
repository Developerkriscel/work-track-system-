import { httpClient } from '@/lib/api/httpClient';

export async function fetchTicketSystemData(employeeId, options = {}) {
  return httpClient('/api/tickets/workspace', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      ...options
    })
  });
}

export async function createTicket(ticketPayload) {
  return httpClient('/api/tickets/create', {
    method: 'POST',
    body: JSON.stringify({
      ticketPayload
    })
  });
}

export async function createBulkTickets(tickets) {
  return httpClient('/api/tickets/create-bulk', {
    method: 'POST',
    body: JSON.stringify({ tickets })
  });
}

export async function updateTicket(ticketId, updatePayload) {
  return httpClient('/api/tickets/update', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      updatePayload
    })
  });
}

export async function updateTicketSchedule(ticketId, newTAT, newPlanDate, reason, employeeId) {
  return httpClient('/api/tickets/schedule', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      newTAT,
      newPlanDate,
      reason,
      employeeId
    })
  });
}

export async function reassignTicket(ticketId, reassignToId, reassignById, remarks) {
  return httpClient('/api/tickets/reassign', {
    method: 'POST',
    body: JSON.stringify({ ticketId, reassignToId, reassignById, remarks })
  });
}

export async function submitTicketApprovalAction(ticketId, action, remarks) {
  return httpClient('/api/tickets/approval-action', {
    method: 'POST',
    body: JSON.stringify({ ticketId, action, remarks })
  });
}

export async function transferTicketApproval(ticketId, targetManagerId, remarks) {
  return httpClient('/api/tickets/approval-transfer', {
    method: 'POST',
    body: JSON.stringify({ ticketId, targetManagerId, remarks })
  });
}

export async function submitClientResponse(ticketId, clientResponse, newPlanDate, attachment) {
  return httpClient('/api/tickets/client-response', {
    method: 'POST',
    body: JSON.stringify({ ticketId, clientResponse, newPlanDate, attachment })
  });
}

export async function fetchTicketMessages(ticketId) {
  return httpClient('/api/tickets/messages', {
    method: 'POST',
    body: JSON.stringify({ ticketId })
  });
}

export async function postTicketMessage(ticketId, messageText, employeeId) {
  return httpClient('/api/tickets/messages/post', {
    method: 'POST',
    body: JSON.stringify({ ticketId, messageText, employeeId })
  });
}

export async function markTicketMessagesRead(ticketId) {
  return httpClient('/api/tickets/messages/read', {
    method: 'POST',
    body: JSON.stringify({ ticketId })
  });
}
