import { StatusPill } from '@/components/common/StatusPill';
import {
  fmsStatusTone,
  formatFmsPlanDate,
  getFmsTaskStatusLabel
} from '@/features/fms/services/fmsPresentation';

export function FmsTaskTable({ tasks, submitting, onComplete }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table fms-table">
        <thead>
          <tr>
            <th>Emp ID</th>
            <th>What</th>
            <th>When</th>
            <th>How</th>
            <th>Who</th>
            <th>FMS Name</th>
            <th>Task Name</th>
            <th>Step</th>
            <th>Plan Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length ? (
            tasks.map((task) => (
              <tr key={task.rowId || task.ID || task['Task ID']}>
                <td>{task.empId || task['Employee ID'] || '-'}</td>
                <td>{task.what || '-'}</td>
                <td>{task.when || task.TAT || '-'}</td>
                <td>{task.how || '-'}</td>
                <td>{task.who || task['Employee Name'] || '-'}</td>
                <td>{task.fmsName || task['Client Name'] || task.Client || '-'}</td>
                <td>{task.taskName || task['Task Description'] || task.Description || '-'}</td>
                <td>{task.stepNo || '-'}</td>
                <td>{formatFmsPlanDate(task.planDate || task['Plan Date'] || task.Date)}</td>
                <td>
                  <StatusPill tone={fmsStatusTone(task)}>
                    {getFmsTaskStatusLabel(task)}
                  </StatusPill>
                </td>
                <td>
                  {task._completed ? (
                    <StatusPill tone="success">Done</StatusPill>
                  ) : !task._isMyTask ? (
                    <StatusPill tone="neutral">View Only</StatusPill>
                  ) : task.formLink ? (
                    <a className="inline-action" href={task.formLink} target="_blank" rel="noreferrer">
                      Open Form
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="ticket-action-btn ticket-action-btn--done"
                      disabled={submitting}
                      onClick={() => onComplete(task)}
                    >
                      Mark Done
                    </button>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="11" className="dashboard-table__empty">No FMS tasks found for this view.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
