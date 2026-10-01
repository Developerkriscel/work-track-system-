import { useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { formatPlanDate, toneForTicketPriority } from '@/features/tickets/services/ticketPresentation';

function fixEncoding(text) {
  if (typeof text !== 'string') return text || '';
  
  // Safely replace known mojibake (Windows-1252/Latin-1 misinterpretations of UTF-8)
  return text
    .replace(/â€¢/g, '•')  // UTF-8 bullet (U+2022)
    .replace(/â–¢/g, '▪')  // UTF-8 black small square (U+25AA)
    .replace(/â—¦/g, '◦')  // UTF-8 white bullet (U+25E6)
    .replace(/â€“/g, '–')  // UTF-8 en dash (U+2013)
    .replace(/â€”/g, '—')  // UTF-8 em dash (U+2014)
    .replace(/â€™/g, "'")  // UTF-8 right single quotation mark
    .replace(/â€œ/g, '"')  // UTF-8 left double quotation mark
    .replace(/â€/g, '"');  // UTF-8 right double quotation mark
}


export function AutoTicketTable({ 
  tickets, 
  totalCount = 0,
  onEdit, 
  onDelete,
  pagination,
  onPageChange,
  onPageSizeChange
}) {
  const page = pagination?.page || 1;
  const pageSize = pagination?.pageSize || 10;
  const total = pagination?.total || tickets.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  
  // Tickets are paginated by the backend, so we render them directly
  const pageTickets = tickets;
  const start = (page - 1) * pageSize;

  const handleDelete = (ticket) => {
    if (window.confirm(`Are you sure you want to delete this Auto Ticket template for "${ticket['Task Description']}"?`)) {
      onDelete(ticket);
    }
  };

  return (
    <div className="react-data-table">
      <div className="react-data-table__toolbar react-data-table__toolbar--ticket">
        <label className="react-data-table__length">
          <span>Show</span>
          <select value={pageSize} onChange={(e) => onPageSizeChange ? onPageSizeChange(Number(e.target.value)) : null}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
          <span>entries</span>
        </label>
        <div className="react-data-table__summary" aria-label="Auto ticket count">
          {totalCount ? `${totalCount} tickets` : `${tickets.length} tickets`}
        </div>
      </div>

      <div className="dashboard-table-wrap" style={{ overflowX: 'auto', width: '100%' }}>
        <table className="dashboard-table ticket-table" style={{ width: 'max-content', minWidth: '100%', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ minWidth: '100px' }}>Timestamp</th>
              <th style={{ minWidth: '100px' }}>Client_Id</th>
              <th style={{ minWidth: '150px' }}>Name</th>
              <th style={{ minWidth: '120px' }}>Task Category</th>
              <th style={{ minWidth: '350px' }}>Task Description</th>
              <th style={{ minWidth: '100px' }}>Attachment</th>
              <th style={{ minWidth: '100px' }}>Priority</th>
              <th style={{ minWidth: '100px' }}>Plan Date</th>
              <th style={{ minWidth: '100px' }}>Employee ID</th>
              <th style={{ minWidth: '150px' }}>Help Person Name</th>
              <th style={{ minWidth: '60px' }}>TAT</th>
              <th style={{ minWidth: '100px' }}>Frequency</th>
              <th style={{ minWidth: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageTickets.map((ticket, idx) => (
              <tr key={ticket['Ticket ID'] || ticket.legacyId || idx}>
                <td>{formatPlanDate(ticket.Timestamp || ticket.Timestamp)}</td>
                <td>{ticket.Client_Id || ticket['Client ID']}</td>
                <td>{ticket.Name || ticket['Client Name']}</td>
                <td>{ticket['Task Category']}</td>
                <td style={{ whiteSpace: 'pre-wrap', minWidth: '350px', maxWidth: '400px', wordWrap: 'break-word' }}>{fixEncoding(ticket['Task Description'])}</td>
                <td>{ticket.Attachment ? 'Yes' : '-'}</td>
                <td><StatusPill tone={toneForTicketPriority(ticket.Priority)}>{ticket.Priority || 'Normal'}</StatusPill></td>
                <td>{formatPlanDate(ticket['Plan Date'])}</td>
                <td>{ticket['Employee ID']}</td>
                <td>{ticket['Help Person Name'] || ticket['Employee Name']}</td>
                <td>{ticket.TAT}</td>
                <td><strong>{ticket.Frequency || ticket.Frequence}</strong></td>
                <td>
                  <div className="ticket-actions">
                    <button type="button" className="ticket-action-btn ticket-action-btn--assign" onClick={() => onEdit(ticket)}>
                      Edit
                    </button>
                    <button type="button" className="ticket-action-btn" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={() => handleDelete(ticket)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pageTickets.length === 0 && (
              <tr>
                <td colSpan="12" className="dashboard-table-empty">No Auto Tickets found. Add one to get started!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="react-data-table__footer">
        <div className="react-data-table__info">
          Showing {total ? start + 1 : 0} to {Math.min(start + pageSize, total)} of {total} entries
        </div>
        <div className="react-data-table__pagination">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange ? onPageChange(page - 1) : null}>Previous</button>
          <span>{page} / {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => onPageChange ? onPageChange(page + 1) : null}>Next</button>
        </div>
      </div>
    </div>
  );
}
