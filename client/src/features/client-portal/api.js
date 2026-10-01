import { httpClient } from '@/lib/api/httpClient';

export async function fetchClientDashboardData(clientId) {
  return httpClient('/api/client-portal/dashboard', {
    method: 'POST',
    body: JSON.stringify({
      clientId
    })
  });
}

export async function fetchClientTickets(clientId, startDate = null, endDate = null, statusFilter = null, options = {}) {
  return httpClient('/api/client-portal/tickets', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      startDate,
      endDate,
      statusFilter,
      ...options
    })
  });
}

export async function createClientTickets(ticketList, clientInfo) {
  return httpClient('/api/client-portal/tickets/create-bulk', {
    method: 'POST',
    body: JSON.stringify({
      ticketList,
      clientInfo
    })
  });
}

export async function updateClientTicketStatus(ticketId, newStatus, remarks, clientId) {
  return httpClient('/api/client-portal/tickets/update-status', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      newStatus,
      remarks,
      clientId
    })
  });
}

export async function submitClientTicketResponse(ticketId, remarks, attachment, clientInfo) {
  return httpClient('/api/client-portal/tickets/response', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      remarks,
      attachment,
      clientInfo
    })
  });
}

export async function fetchClientTicketDetails(ticketId, clientId) {
  return httpClient('/api/client-portal/tickets/details', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      clientId
    })
  });
}

export async function fetchClientTicketMessages(ticketId) {
  return httpClient('/api/client-portal/tickets/messages', {
    method: 'POST',
    body: JSON.stringify({
      ticketId
    })
  });
}

export async function postClientTicketMessage(ticketId, messageText, clientInfo) {
  return httpClient('/api/client-portal/tickets/messages/post', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      messageText,
      clientInfo
    })
  });
}

export async function markClientTicketMessagesAsRead(ticketId, clientId) {
  return httpClient('/api/client-portal/tickets/messages/read', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      clientId
    })
  });
}

export async function fetchClientInvoices(clientId) {
  return httpClient('/api/client-portal/invoices', {
    method: 'POST',
    body: JSON.stringify({
      clientId
    })
  });
}

export async function fetchClientReports(clientId, startDate = null, endDate = null) {
  return httpClient('/api/client-portal/reports', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      startDate,
      endDate
    })
  });
}
