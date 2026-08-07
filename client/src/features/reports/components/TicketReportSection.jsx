import { StatusPill } from '@/components/common/StatusPill';
import { formatReportDate, toneForReportStatus } from '@/features/reports/services/reportsPresentation';

export function TicketReportSection({
  tickets,
  ticketStatuses,
  ticketPriorities,
  ticketUsers,
  ticketFilters,
  onTicketFiltersChange,
  onResetFilters,
  range,
  onRangeChange,
  rangeOptions,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange
}) {
  return (
    <>
      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>Ticket Filters</h2>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onResetFilters}>
            Reset
          </button>
        </div>

        <div className="approval-filter-grid">
          <label className="dashboard-control">
            <span>Priority</span>
            <select
              value={ticketFilters.priority}
              onChange={(event) => onTicketFiltersChange((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="">All Priorities</option>
              {ticketPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-control">
            <span>User</span>
            <select
              value={ticketFilters.user}
              onChange={(event) => onTicketFiltersChange((current) => ({ ...current, user: event.target.value }))}
            >
              <option value="">All Users</option>
              {ticketUsers.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-control">
            <span>Date Range</span>
            <select value={range} onChange={(event) => onRangeChange(event.target.value)}>
              {rangeOptions?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {range === 'custom' ? (
            <>
              <label className="dashboard-control">
                <span>Start Date</span>
                <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
              </label>
              <label className="dashboard-control">
                <span>End Date</span>
                <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
              </label>
            </>
          ) : null}

          <label className="dashboard-control">
            <span>Search</span>
            <input
              type="text"
              value={ticketFilters.search}
              onChange={(event) => onTicketFiltersChange((current) => ({ ...current, search: event.target.value }))}
              placeholder="Ticket ID, client, employee, description..."
            />
          </label>
        </div>
      </article>

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>Tickets Report</h2>
          <StatusPill tone="info">{tickets.length} rows</StatusPill>
        </div>

        <div className="dashboard-table-wrap" style={{ marginTop: '16px' }}>
          <table className="dashboard-table reports-premium-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Client</th>
                <th>Employee</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Plan Date</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length ? (
                tickets.map((item) => (
                  <tr key={item['Ticket ID'] || item._id}>
                    <td data-label="Ticket ID"><span className="ticket-id-chip">{item['Ticket ID'] || '-'}</span></td>
                    <td data-label="Client">{item.Name || item['Client Name'] || item.Client || '-'}</td>
                    <td data-label="Employee">{item['Employee Name'] || item.User || '-'}</td>
                    <td data-label="Description" className="approval-table__copy">{item['Task Description'] || item.Description || '-'}</td>
                    <td data-label="Priority">{item.Priority || '-'}</td>
                    <td data-label="Status">
                      <StatusPill tone={toneForReportStatus(item.Status)}>{item.Status || '-'}</StatusPill>
                    </td>
                    <td data-label="Plan Date">{formatReportDate(item['Plan Date'])}</td>
                    <td data-label="Duration">{item['Total Duration'] || item.Duration || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="dashboard-table__empty">No ticket report data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
