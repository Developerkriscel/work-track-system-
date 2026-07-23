import { StatusPill } from '@/components/common/StatusPill';

export function ClientPortalTablePanel({ title, count, columns = [], rows = [], emptyText, renderRow }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>{title}</h2>
        <StatusPill tone="info">{count} rows</StatusPill>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map(renderRow)
            ) : (
              <tr>
                <td colSpan={columns.length} className="dashboard-table__empty">{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
