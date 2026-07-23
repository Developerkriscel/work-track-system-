function toMidnightTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
}

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

export function resolveClientRange(range, customStart, customEnd) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === 'custom') {
    return {
      startDate: customStart || null,
      endDate: customEnd || null
    };
  }

  if (range === 'today') {
    const value = isoDate(today);
    return { startDate: value, endDate: value };
  }

  if (range === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return { startDate: isoDate(start), endDate: isoDate(today) };
  }

  if (range === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: isoDate(start), endDate: isoDate(today) };
  }

  return { startDate: null, endDate: null };
}

export function ticketLatestUpdate(ticket) {
  const remarks = String(ticket?.Remarks || '').trim();
  if (!remarks) return 'No updates';
  const lines = remarks.split('\n').map((line) => line.trim()).filter(Boolean);
  const lastEntry = lines[lines.length - 1] || '';
  const cleaned = lastEntry.replace(/\[\[.*?\]\]:?\s*/g, '').replace(/\[.*?\]:\s*/g, '').replace('TAT/Date Updated.', '').trim();
  return cleaned || 'No updates';
}

export function ticketLatestUpdatePreview(ticket, limit = 52) {
  const text = ticketLatestUpdate(ticket);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

export function isClientTicketAwaitingResponse(ticket) {
  return String(ticket?.Status || '').toLowerCase().includes('pending client response');
}

export function isClientTicketClosed(ticket) {
  const status = String(ticket?.Status || '').toLowerCase().trim();
  if (status.includes('closed') || status.includes('completed') || status.includes('resolved') || status.includes('done') || status.includes('auto-approved')) {
    return true;
  }

  if (status.includes('pending approval')) {
    const reference = ticket?.['Last Update Date'] || ticket?.Date || ticket?.Timestamp;
    const updateTimestamp = reference ? new Date(reference).getTime() : null;
    if (updateTimestamp && !Number.isNaN(updateTimestamp)) {
      const ageHours = (Date.now() - updateTimestamp) / (1000 * 60 * 60);
      if (ageHours > 24) return true;
    }
  }

  return false;
}

export function isClientTicketAutoApproved(ticket) {
  const status = String(ticket?.Status || '').toLowerCase().trim();
  return status.includes('pending approval') && isClientTicketClosed(ticket);
}

export function displayClientTicketStatus(ticket) {
  if (isClientTicketAutoApproved(ticket)) return 'Auto-Approved';
  return ticket?.Status || 'N/A';
}

export function clientTicketPriorityTone(priority) {
  const value = String(priority || '').toLowerCase().trim();
  if (value.includes('super urgent') || value.includes('urgent')) return 'danger';
  if (value.includes('high')) return 'warning';
  if (value.includes('normal') || value.includes('medium')) return 'info';
  return 'neutral';
}

export function shortTicketDescription(value, limit = 35) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

export function groupClientTickets(rows) {
  const all = Array.isArray(rows) ? rows : [];
  const response = all.filter(isClientTicketAwaitingResponse);
  const closed = all.filter(isClientTicketClosed);
  const open = all.filter((ticket) => !isClientTicketClosed(ticket) && !isClientTicketAwaitingResponse(ticket));

  return { all, open, response, closed };
}

export function sortClientTickets(rows) {
  return [...rows].sort((left, right) => {
    const leftDate = toMidnightTimestamp(left?.['Plan Date'] || left?.Date || left?.Timestamp) || 0;
    const rightDate = toMidnightTimestamp(right?.['Plan Date'] || right?.Date || right?.Timestamp) || 0;
    return rightDate - leftDate;
  });
}

export function makeClientTicketDraft() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: '',
    description: '',
    priority: 'Medium',
    completionDate: '',
    attachments: []
  };
}

export async function fileToBase64Attachment(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error(`Unable to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    base64
  };
}
