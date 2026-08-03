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
                <td data-label="Emp ID">{task.empId || task['Employee ID'] || '-'}</td>
                <td data-label="What">{task.what || '-'}</td>
                <td data-label="When">{task.when || task.TAT || '-'}</td>
                <td data-label="How">{task.how || '-'}</td>
                <td data-label="Who">{task.who || task['Employee Name'] || '-'}</td>
                <td data-label="FMS Name">{task.fmsName || task['Client Name'] || task.Client || '-'}</td>
                <td data-label="Task Name">{task.taskName || task['Task Description'] || task.Description || '-'}</td>
                <td data-label="Step">{task.stepNo || '-'}</td>
                <td data-label="Plan Date">{formatFmsPlanDate(task.planDate || task['Plan Date'] || task.Date)}</td>
                <td data-label="Status">
                  <StatusPill tone={fmsStatusTone(task)}>
                    {getFmsTaskStatusLabel(task)}
                  </StatusPill>
                </td>
                <td data-label="Action">
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
