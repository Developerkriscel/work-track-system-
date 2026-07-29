import { StatusPill } from '@/components/common/StatusPill';
import { formatReportDate, toneForReportStatus } from '@/features/reports/services/reportsPresentation';

export function TicketReportSection({
  tickets,
  ticketStatuses,
  ticketPriorities,
  ticketCategories,
  ticketFilters,
  onTicketFiltersChange,
  onResetFilters
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
            <span>Category</span>
            <select
              value={ticketFilters.category}
              onChange={(event) => onTicketFiltersChange((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="">All Categories</option>
              {ticketCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-control">
            <span>Status</span>
            <select
              value={ticketFilters.status}
              onChange={(event) => onTicketFiltersChange((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All Statuses</option>
              {ticketStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

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

        <div className="dashboard-table-wrap">
          <table className="dashboard-table approval-table">
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
                    <td><span className="ticket-id-chip">{item['Ticket ID'] || '-'}</span></td>
                    <td>{item.Name || item['Client Name'] || item.Client || '-'}</td>
                    <td>{item['Employee Name'] || item.User || '-'}</td>
                    <td className="approval-table__copy">{item['Task Description'] || item.Description || '-'}</td>
                    <td>{item.Priority || '-'}</td>
                    <td>
                      <StatusPill tone={toneForReportStatus(item.Status)}>{item.Status || '-'}</StatusPill>
                    </td>
                    <td>{formatReportDate(item['Plan Date'])}</td>
                    <td>{item['Total Duration'] || item.Duration || '-'}</td>
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
