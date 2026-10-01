import { useEffect, useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { formatPlanDate, formatTicketAssignee, toneForTicketPriority, toneForTicketStatus } from '@/features/tickets/services/ticketPresentation';

export function TicketTable({
  tickets,
  totalCount = 0,
  loading = false,
  pagination = null,
  role,
  submitting,
  allUsers = [],
  onPageChange,
  onPageSizeChange,
  onStatusAction,
  onScheduleAction,
  onReassign,
  onApprovalAction,
  onApprovalTransfer,
  onChat,
  onDetails,
  currentUser,
  activeTab = 'my'
}) {
  const serverPaged = Boolean(pagination && onPageChange && onPageSizeChange);
  const [localPageSize, setLocalPageSize] = useState(10);
  const [localPage, setLocalPage] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const pageSize = serverPaged ? pagination.pageSize : localPageSize;
  const page = serverPaged ? pagination.page : localPage;
  const totalRows = serverPaged ? pagination.total : tickets.length;
  const pageCount = serverPaged ? pagination.totalPages : Math.max(1, Math.ceil(tickets.length / pageSize));

  function ticketStatus(value) {
    return String(value || '').trim();
  }

  function isTerminalTicket(value) {
    const status = ticketStatus(value).toLowerCase();
    if (['completed', 'closed', 'approved', 'approve', 'accepted', 'approved by client', 'cancelled'].includes(status)) return true;
    return status.includes('approved') || status.includes('closed');
  }

  function isWaitingTicket(value) {
    const status = ticketStatus(value).toLowerCase();
    return ['pending approval', 'pending client response'].includes(status);
  }

  function durationToMinutes(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return 0;
    const hours = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
    const minutes = raw.match(/(\d+(?:\.\d+)?)\s*m/i);
    if (hours || minutes) return Math.round(Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0));
    const colon = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
    return Number(raw) || 0;
  }

  function minutesLabel(minutes) {
    const total = Math.max(0, Math.round(minutes));
    return `${Math.floor(total / 60)}h ${total % 60}m`;
  }

  function parseTicketStartTime(ticket) {
    const raw = String(ticket['Start Time'] || ticket.startTime || '').trim();
    if (!raw) return null;
    const explicitDate = new Date(raw);
    if (!Number.isNaN(explicitDate.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)) return explicitDate;
    const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || 0);
    const meridian = match[4]?.toLowerCase();
    if (meridian === 'pm' && hour < 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;
    const planDate = new Date(ticket['Plan Date'] || ticket.Date || ticket.Timestamp || now);
    const dateRef = Number.isNaN(planDate.getTime()) ? new Date(now) : planDate;
    const year = dateRef.getFullYear();
    const month = String(dateRef.getMonth() + 1).padStart(2, '0');
    const day = String(dateRef.getDate()).padStart(2, '0');
    const startStr = `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+05:30`;
    const start = new Date(startStr);
    if (start.getTime() > now) start.setTime(start.getTime() - 86400000);
    return start;
  }

  function ticketDuration(ticket) {
    const savedDuration = ticket['Total Duration'] || ticket.Duration || ticket.totalDuration || ticket.duration || '';
    if (ticketStatus(ticket.Status) !== 'In Progress') return savedDuration || 'Not started';
    const start = parseTicketStartTime(ticket);
    const liveMinutes = start ? Math.max(0, Math.floor((now - start.getTime()) / 60000)) : 0;
    return minutesLabel(durationToMinutes(savedDuration) + liveMinutes);
  }

  useEffect(() => {
    if (!serverPaged) setLocalPage(1);
  }, [tickets, pageSize, serverPaged]);

  useEffect(() => {
    if (!tickets.some((ticket) => ticketStatus(ticket.Status) === 'In Progress')) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, [tickets]);

  const pageTickets = useMemo(() => {
    if (serverPaged) return tickets;
    const start = (Math.min(page, pageCount) - 1) * pageSize;
    return tickets.slice(start, start + pageSize);
  }, [page, pageCount, pageSize, tickets, serverPaged]);

  const firstEntry = serverPaged ? (pagination.start || 0) : tickets.length ? (Math.min(page, pageCount) - 1) * pageSize + 1 : 0;
  const lastEntry = serverPaged ? (pagination.end || 0) : tickets.length ? Math.min(Math.min(page, pageCount) * pageSize, tickets.length) : 0;

  const hasUnreadMessages = (ticket = {}) => {
    const adminUnread = ticket.HasUnreadAdminMessages === true || String(ticket.HasUnreadAdminMessages).toUpperCase() === 'TRUE';
    const teamUnread = ticket.HasUnreadMessages === true || String(ticket.HasUnreadMessages).toUpperCase() === 'TRUE';
    return adminUnread || teamUnread;
  };

  const hasAttachments = (ticket = {}) => [
    ticket.Attachment,
    ticket.Attachments,
    ticket['Closing Attachment']
  ].some((value) => String(value || '').trim());

  function referenceLink(ticket = {}) {
    const raw = String(ticket['Reference Link'] || ticket.Link || ticket.URL || ticket.Url || ticket.link || ticket.url || '').trim();
    if (!raw) return '';
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  }

  return (
    <div className="react-data-table" aria-busy={loading}>
      <div className="react-data-table__toolbar react-data-table__toolbar--ticket">
        <label className="react-data-table__length">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(event) => {
              const nextSize = Number(event.target.value);
              if (serverPaged) onPageSizeChange(nextSize);
              else setLocalPageSize(nextSize);
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
          <span>entries</span>
        </label>
        <div className="react-data-table__summary" aria-label="Ticket count">
          {loading ? 'Loading…' : totalCount ? `${totalCount} tickets` : `${tickets.length} tickets`}
        </div>
      </div>

      <div className="dashboard-table-wrap">
      <table className={`dashboard-table ticket-table ${activeTab === 'client' ? 'ticket-table--client' : ''}`}>
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
            {activeTab === 'client' ? (
              <>
                <th className="ticket-col--created-date">Created Date</th>
                <th className="ticket-col--expected-date">Expected Date</th>
              </>
            ) : (
              <th className="ticket-col--plan-date">Plan Date</th>
            )}
            <th className="ticket-col--actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {!loading && tickets.length ? (
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
                <td data-label="Start">{ticket['Start Time'] || ticket.startTime || <span className="ticket-time-muted">Not started</span>}</td>
                <td data-label="End">{ticket['End Time'] || ticket.endTime || <span className="ticket-time-muted">Not ended</span>}</td>
                <td data-label="Duration">
                  <span className={ticketStatus(ticket.Status) === 'In Progress' ? 'ticket-duration ticket-duration--running' : 'ticket-duration'}>
                    {ticketDuration(ticket)}
                  </span>
                </td>
                <td data-label="Assigned To">
                  {(() => {
                    const assignee = formatTicketAssignee(ticket, allUsers);
                    const assignedById = String(ticket['Reassigned By'] || ticket['reassignedBy'] || ticket['Created By'] || ticket['createdBy'] || '').trim();
                    const assignedByMatch = assignedById ? allUsers.find(u => String(u['Employee ID'] || u['User ID'] || u.id || '').toLowerCase() === assignedById.toLowerCase()) : null;
                    const assignedByName = assignedByMatch ? (assignedByMatch['Employee Name'] || assignedByMatch['Name'] || assignedByMatch.name) : assignedById;

                    return (
                      <div className="ticket-assignee-cell">
                        <strong>{assignee.id}</strong>
                        {assignee.name ? <span>{assignee.name}</span> : null}
                        {assignedById && assignedById !== 'System' && assignedById.toLowerCase() !== assignee.id.toLowerCase() && assignedById !== 'Client' && assignee.id !== '-' ? (
                          <div style={{ marginTop: '6px', fontSize: '11px', color: '#666', borderTop: '1px dashed #e0e0e0', paddingTop: '4px' }}>
                            <span style={{ color: '#888' }}>Assigned By:</span><br/>
                            <strong>{assignedByName}</strong> ({assignedById})
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </td>
                <td data-label="Status">
                  <StatusPill tone={toneForTicketStatus(ticket.Status)}>{ticket.Status || 'Open'}</StatusPill>
                </td>
                {activeTab === 'client' ? (
                  <>
                    <td data-label="Created Date" className="ticket-col--created-date">
                      {formatPlanDate(ticket.Timestamp || ticket.Date || ticket.createdAt || ticket['Created Date'] || ticket.createdDate)}
                    </td>
                    <td data-label="Expected Date" className="ticket-col--expected-date">
                      {formatPlanDate(ticket['Plan Date'] || ticket.completionDate || ticket['Expected Date'] || ticket.expectedDate)}
                    </td>
                  </>
                ) : (
                  <td data-label="Plan Date" className="ticket-col--plan-date">{formatPlanDate(ticket['Plan Date'])}</td>
                )}
                <td data-label="Actions" className="ticket-col--actions">
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
                        {hasAttachments(ticket) ? (
                          <button
                            type="button"
                            className="ticket-action-btn ticket-action-btn--files"
                            disabled={submitting}
                            onClick={() => onDetails(ticket)}
                          >
                            Files
                          </button>
                        ) : null}
                        {referenceLink(ticket) ? (
                          <a
                            className="ticket-action-btn ticket-action-btn--link"
                            href={referenceLink(ticket)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Link
                          </a>
                        ) : null}
                        {(() => {
                          const showRedDot = hasUnreadMessages(ticket);
                          
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
              <td colSpan={activeTab === 'client' ? 13 : 12} className="dashboard-table__empty">
                {loading ? 'Loading tickets…' : 'No tickets found.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      <div className="react-data-table__footer">
        <span className="react-data-table__info">
          {loading ? 'Loading tickets…' : `Showing ${firstEntry} to ${lastEntry} of ${totalRows} entries`}
        </span>
        <div className="react-data-table__pager">
          <button type="button" disabled={page <= 1} onClick={() => (serverPaged ? onPageChange(1) : setLocalPage(1))} aria-label="First page">«</button>
          <button type="button" disabled={page <= 1} onClick={() => (serverPaged ? onPageChange(Math.max(1, page - 1)) : setLocalPage((current) => Math.max(1, current - 1)))} aria-label="Previous page">‹</button>
          <span className="react-data-table__pager-current">{Math.min(page, pageCount)}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => (serverPaged ? onPageChange(Math.min(pageCount, page + 1)) : setLocalPage((current) => Math.min(pageCount, current + 1)))} aria-label="Next page">›</button>
          <button type="button" disabled={page >= pageCount} onClick={() => (serverPaged ? onPageChange(pageCount) : setLocalPage(pageCount))} aria-label="Last page">»</button>
        </div>
      </div>
    </div>
  );
}
