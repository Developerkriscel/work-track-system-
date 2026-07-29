import { StatusPill } from '@/components/common/StatusPill';
import { formatReportDate, toneForReportStatus } from '@/features/reports/services/reportsPresentation';

export function FmsReportSection({
  fms,
  fmsStatuses,
  fmsFilters,
  onFmsFiltersChange,
  onResetFilters
}) {
  return (
    <>
      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>FMS Filters</h2>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onResetFilters}>
            Reset
          </button>
        </div>

        <div className="approval-filter-grid">
          <label className="dashboard-control">
            <span>Status</span>
            <select
              value={fmsFilters.status}
              onChange={(event) => onFmsFiltersChange((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All Statuses</option>
              {fmsStatuses.map((status) => (
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
              value={fmsFilters.search}
              onChange={(event) => onFmsFiltersChange((current) => ({ ...current, search: event.target.value }))}
              placeholder="FMS name, task, employee, status..."
            />
          </label>
        </div>
      </article>

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>FMS Report</h2>
          <StatusPill tone="info">{fms.length} rows</StatusPill>
        </div>

        <div className="dashboard-table-wrap">
          <table className="dashboard-table approval-table">
            <thead>
              <tr>
                <th>FMS Name</th>
                <th>Task Name</th>
                <th>Assigned To</th>
                <th>Plan Date</th>
                <th>Actual Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fms.length ? (
                fms.map((item, index) => (
                  <tr key={item.ID || item['Task ID'] || `${item['Task Name'] || 'fms'}-${index}`}>
                    <td>{item['FMS Name'] || item.Name || '-'}</td>
                    <td className="approval-table__copy">{item['Task Name'] || item['Task Description'] || item.Description || '-'}</td>
                    <td>{item.Who || item['Assigned To'] || '-'}</td>
                    <td>{formatReportDate(item['Plan Date'])}</td>
                    <td>{formatReportDate(item['Actual Date'])}</td>
                    <td>
                      <StatusPill tone={toneForReportStatus(item.Status)}>{item.Status || '-'}</StatusPill>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="dashboard-table__empty">No FMS report data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
