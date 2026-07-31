import { StatusPill } from '@/components/common/StatusPill';

function DashboardTaskTable({ tasks = [] }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Plan Date</th>
            <th>ID</th>
            <th>Type</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length ? (
            tasks.map((task, index) => (
              <tr key={`${task.ID || task['Ticket ID'] || task.empId || 'task'}-${index}`}>
                <td>{task.Date || task['Plan Date'] || '-'}</td>
                <td>{task.ID || task['Ticket ID'] || task['Task ID'] || '-'}</td>
                <td>{task.Type || task.TaskType || task.Module || '-'}</td>
                <td>{task.Description || task['Task Description'] || task.Task || '-'}</td>
                <td>
                  <StatusPill tone="info">{task.Status || 'Open'}</StatusPill>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="dashboard-table__empty">No tasks found for the selected range.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardTasksSection({ tasks = [] }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Tasks in Selected Range</h2>
        <StatusPill tone="info">{tasks.length} items</StatusPill>
      </div>
      <DashboardTaskTable tasks={tasks} />
    </article>
  );
}
