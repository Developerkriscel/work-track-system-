import { useEffect, useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { formatPlanDate, toneForTicketPriority, toneForTicketStatus } from '@/features/tickets/services/ticketPresentation';

export function TicketTable({
  tickets,
  role,
  submitting,
  onStatusAction,
  onScheduleAction,
  onReassign,
  onApprovalAction,
  onApprovalTransfer,
  onChat,
  onDetails,
  currentUser
}) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(tickets.length / pageSize));

  function ticketStatus(value) {
    return String(value || '').trim();
  }

  function isTerminalTicket(value) {
    const status = ticketStatus(value).toLowerCase();
    return ['completed', 'closed', 'approved by client', 'cancelled'].includes(status);
  }

  function isWaitingTicket(value) {
    const status = ticketStatus(value).toLowerCase();
    return ['pending approval', 'pending client response'].includes(status);
  }

  useEffect(() => {
    setPage(1);
  }, [tickets, pageSize]);

  const pageTickets = useMemo(() => {
    const start = (Math.min(page, pageCount) - 1) * pageSize;
    return tickets.slice(start, start + pageSize);
  }, [page, pageCount, pageSize, tickets]);

  const firstEntry = tickets.length ? (Math.min(page, pageCount) - 1) * pageSize + 1 : 0;
  const lastEntry = tickets.length ? Math.min(Math.min(page, pageCount) * pageSize, tickets.length) : 0;
  return (
    <div className="react-data-table">
      <div className="react-data-table__toolbar">
        <label className="react-data-table__length">
          <span>Show</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
          <span>entries</span>
        </label>
      </div>

      <div className="dashboard-table-wrap">
      <table className="dashboard-table ticket-table">
        <thead>
          <tr>
            <th>Ticket ID</th>
            <th>Client Name</th>
            <th>Description</th>
            <th>Priority</th>
            <th>TAT</th>
            <th>Start</th>
            <th>End</th>
            <th>Duration</th>
            <th>Assigned To</th>
            <th>Status</th>
            <th>Plan Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length ? (
            pageTickets.map((ticket, index) => (
              <tr key={ticket['Ticket ID'] || index} className={`react-data-table__row ${ticketStatus(ticket.Status) === 'In Progress' ? 'ticket-row--in-progress' : ''}`}>
                <td data-label="Ticket ID">
                  <button type="button" className="ticket-id-chip ticket-id-chip--button" onClick={() => onDetails(ticket)}>{ticket['Ticket ID']}</button>
                </td>
                <td data-label="Client Name">{ticket.Name || '-'}</td>
                <td data-label="Description">{ticket['Task Description'] || '-'}</td>
                <td data-label="Priority">
                  <StatusPill tone={toneForTicketPriority(ticket.Priority)}>{ticket.Priority || 'Normal'}</StatusPill>
                </td>
                <td data-label="TAT">{ticket.TAT || '-'}</td>
                <td data-label="Start">{ticket['Start Time'] || '-'}</td>
                <td data-label="End">{ticket['End Time'] || '-'}</td>
                <td data-label="Duration">{ticket['Total Duration'] || ticket.Duration || '-'}</td>
                <td data-label="Assigned To">{ticket['Employee Name'] || ticket['Employee ID'] || '-'}</td>
                <td data-label="Status">
                  <StatusPill tone={toneForTicketStatus(ticket.Status)}>{ticket.Status || 'Open'}</StatusPill>
                </td>
                <td data-label="Plan Date">{formatPlanDate(ticket['Plan Date'])}</td>
                <td data-label="Actions">
                  <div className="ticket-actions">
                    {!isTerminalTicket(ticket.Status) &&
                    !isWaitingTicket(ticket.Status) &&
                    ticketStatus(ticket.Status) !== 'In Progress' ? (
                      <button
                        type="button"
                        className="ticket-action-btn ticket-action-btn--start"
                        disabled={submitting}
                        onClick={() => onStatusAction(ticket, 'In Progress')}
                      >
                        {['Paused', 'Rework', 'Reassigned'].includes(ticketStatus(ticket.Status)) ? 'Restart' : 'Start'}
                      </button>
                    ) : null}
                    {ticketStatus(ticket.Status) === 'In Progress' ? (
                      <>
                        <button
                          type="button"
                          className="ticket-action-btn ticket-action-btn--pause"
                          disabled={submitting}
                          onClick={() => onStatusAction(ticket, 'Paused')}
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          className="ticket-action-btn ticket-action-btn--done"
                          disabled={submitting}
                          onClick={() => onStatusAction(ticket, 'Completed')}
                        >
                          Complete
                        </button>
                      </>
                    ) : null}
                    {!isTerminalTicket(ticket.Status) && !isWaitingTicket(ticket.Status) && ticketStatus(ticket.Status) !== 'Completed' ? (
                      <>
                        <button
                          type="button"
                          className="ticket-action-btn ticket-action-btn--schedule"
                          disabled={submitting}
                          onClick={() => onScheduleAction(ticket)}
                        >
                          Schedule
                        </button>
                        <button type="button" className="ticket-action-btn ticket-action-btn--assign" disabled={submitting} onClick={() => onReassign(ticket)}>Reassign</button>
                        {(() => {
                          const hasUnread = ticket.HasUnreadAdminMessages === true || String(ticket.HasUnreadAdminMessages).toUpperCase() === 'TRUE';
                          const lastActionBy = String(ticket['Last Action By'] || '').trim().toLowerCase();
                          const currentUserName = String(currentUser?.['Employee Name'] || '').trim().toLowerCase();
                          const notMe = lastActionBy !== currentUserName;
                          const showRedDot = hasUnread && notMe;
                          
                          return (
                            <button 
                              type="button" 
                              className={`ticket-action-btn ticket-action-btn--chat ${showRedDot ? 'ticket-action-btn--unread-active' : ''}`} 
                              disabled={submitting} 
                              onClick={() => onChat(ticket)}
                            >
                              Chat
                              {showRedDot && <span className="chat-unread-dot"></span>}
                            </button>
                          );
                        })()}
                      </>
                    ) : (
                      <span
                        className={`ticket-action-state ticket-action-state--${
                          isTerminalTicket(ticket.Status) ? 'closed' : 'pending'
                        }`}
                      >
                        {isTerminalTicket(ticket.Status) ? 'Approved' : 'Waiting'}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="12" className="dashboard-table__empty">
                No tickets found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      <div className="react-data-table__footer">
        <span className="react-data-table__info">
          Showing {firstEntry} to {lastEntry} of {tickets.length} entries
        </span>
        <div className="react-data-table__pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(1)} aria-label="First page">«</button>
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page">‹</button>
          <span className="react-data-table__pager-current">{Math.min(page, pageCount)}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="Next page">›</button>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage(pageCount)} aria-label="Last page">»</button>
        </div>
      </div>
    </div>
  );
}
