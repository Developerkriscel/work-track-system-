import { StatusPill } from '@/components/common/StatusPill';
import { formatTodoDate, todoStatusTone } from '@/features/todo/services/todoPresentation';

export function TodoTable({ rows = [], submitting, onToggle, onEdit, onDelete }) {
  function isCompleted(row) {
    return String(row.Status || '').toLowerCase().includes('completed');
  }

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>My To-Do Tasks</h2>
        <StatusPill tone="info">{rows.length} items</StatusPill>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th className="todo-table__check-col">
                <span aria-hidden="true">✓</span>
              </th>
              <th>Task ID</th>
              <th>Task</th>
              <th>Priority</th>
              <th>Due Date</th>
              <th>TAT</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row['Task ID'] || row.TodoID} className={isCompleted(row) ? 'todo-row todo-row--completed' : 'todo-row'}>
                  <td className="todo-table__check-col" data-label="Mark Done">
                    <label className="todo-checkbox" title={isCompleted(row) ? 'Mark pending' : 'Mark completed'}>
                      <input
                        type="checkbox"
                        checked={isCompleted(row)}
                        disabled={submitting}
                        onChange={() => onToggle(row)}
                      />
                      <span className="todo-checkbox__box" aria-hidden="true" />
                    </label>
                  </td>
                  <td data-label="Task ID"><span className="ticket-id-chip">{row['Task ID'] || row.TodoID || '-'}</span></td>
                  <td data-label="Task" className="approval-table__copy todo-table__task-cell">
                    <span className="todo-table__task-text">{row.Task || row.Description || '-'}</span>
                  </td>
                  <td data-label="Priority">{row.Priority || '-'}</td>
                  <td data-label="Due Date">{formatTodoDate(row['Due Date'] || row.Date)}</td>
                  <td data-label="TAT">{row.TAT || '-'}</td>
                  <td data-label="Status"><StatusPill tone={todoStatusTone(row.Status)}>{row.Status || 'Pending'}</StatusPill></td>
                  <td data-label="Action">
                    <div className="ticket-actions">
                      <button type="button" className="attendance-cta attendance-cta--gray" disabled={submitting} onClick={() => onEdit(row)}>
                        Edit
                      </button>
                      <button type="button" className="attendance-cta attendance-cta--red" disabled={submitting} onClick={() => onDelete(row)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="dashboard-table__empty">No to-do tasks found for the current filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
