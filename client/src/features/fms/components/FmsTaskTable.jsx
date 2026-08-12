import { useEffect, useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import {
  fmsStatusTone,
  formatFmsPlanDate,
  getFmsTaskStatusLabel
} from '@/features/fms/services/fmsPresentation';

const PAGE_SIZE = 60;

export function FmsTaskTable({ tasks, pagination = null, submitting, onPageChange, onComplete }) {
  const serverPaged = Boolean(pagination && onPageChange);
  const [page, setPage] = useState(1);
  const currentPage = serverPaged ? pagination.page : page;
  const totalPages = serverPaged ? pagination.totalPages : Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const totalRows = serverPaged ? pagination.total : tasks.length;

  useEffect(() => {
    if (!serverPaged) setPage(1);
  }, [serverPaged, tasks]);

  const visibleTasks = useMemo(() => {
    if (serverPaged) return tasks;
    const start = (page - 1) * PAGE_SIZE;
    return tasks.slice(start, start + PAGE_SIZE);
  }, [page, serverPaged, tasks]);

  return (
    <>
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
              visibleTasks.map((task) => (
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
                    {task.formLink ? (
                      <a className="inline-action inline-action--fms-form" href={task.formLink} target="_blank" rel="noreferrer">
                        Open Form
                      </a>
                    ) : task._completed ? (
                      <StatusPill tone="success">Done</StatusPill>
                    ) : !task._isMyTask ? (
                      <StatusPill tone="neutral">View Only</StatusPill>
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

      {totalRows > PAGE_SIZE ? (
        <div className="fms-table-pager">
          <span>
            Showing {serverPaged ? (pagination.start || 0) : (page - 1) * PAGE_SIZE + 1}-{serverPaged ? (pagination.end || 0) : Math.min(page * PAGE_SIZE, tasks.length)} of {totalRows}
          </span>
          <div className="fms-table-pager__actions">
            <button
              type="button"
              className="inline-action inline-action--ghost"
              disabled={currentPage <= 1}
              onClick={() => (serverPaged ? onPageChange(Math.max(1, currentPage - 1)) : setPage((current) => Math.max(1, current - 1)))}
            >
              Previous
            </button>
            <StatusPill tone="info">{currentPage} / {totalPages}</StatusPill>
            <button
              type="button"
              className="inline-action inline-action--ghost"
              disabled={currentPage >= totalPages}
              onClick={() => (serverPaged ? onPageChange(Math.min(totalPages, currentPage + 1)) : setPage((current) => Math.min(totalPages, current + 1)))}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
