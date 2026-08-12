import { StatusPill } from '@/components/common/StatusPill';

function DashboardTaskTable({ tasks = [], showOwner = false, loading = false }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Plan Date</th>
            <th>ID</th>
            {showOwner ? <th>User</th> : null}
            <th>Type</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={showOwner ? 6 : 5} className="dashboard-table__empty">Loading tasks...</td>
            </tr>
          ) : tasks.length ? (
            tasks.map((task, index) => (
              <tr key={`${task.ID || task['Ticket ID'] || task.empId || 'task'}-${index}`}>
                <td data-label="Plan Date">{task.Date || task['Plan Date'] || '-'}</td>
                <td data-label="ID">{task.ID || task['Ticket ID'] || task['Task ID'] || '-'}</td>
                {showOwner ? <td data-label="User">{task.User || task['Employee Name'] || '-'}</td> : null}
                <td data-label="Type">{task.Type || task.TaskType || task.Module || '-'}</td>
                <td data-label="Description">{task.Description || task['Task Description'] || task.Task || '-'}</td>
                <td data-label="Status">
                  <StatusPill tone="info">{task.Status || 'Open'}</StatusPill>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={showOwner ? 6 : 5} className="dashboard-table__empty">No tasks found for the selected range.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardTasksSection({
  tasks = [],
  showOwner = false,
  loading = false,
  pagination = {},
  onPageChange
}) {
  const currentPage = Number(pagination.page || 1);
  const pageCount = Number(pagination.pageCount || 1);
  const total = Number(pagination.total || tasks.length || 0);

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Tasks in Selected Range</h2>
        <StatusPill tone="info">{total} items</StatusPill>
      </div>
      <DashboardTaskTable tasks={tasks} showOwner={showOwner} loading={loading} />
      {pageCount > 1 ? (
        <div className="react-data-table__footer" style={{ marginTop: '14px' }}>
          <span className="react-data-table__info">
            Page {currentPage} of {pageCount}
          </span>
          <div className="react-data-table__pager">
            <button type="button" className="react-data-table__pager-btn" onClick={() => onPageChange?.(currentPage - 1)} disabled={loading || currentPage <= 1}>
              Prev
            </button>
            <span className="react-data-table__pager-current">{currentPage}</span>
            <button type="button" className="react-data-table__pager-btn" onClick={() => onPageChange?.(currentPage + 1)} disabled={loading || currentPage >= pageCount}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
