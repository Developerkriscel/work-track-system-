import { useEffect, useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { formatApprovalDate, toneForApprovalStatus } from '@/features/approvals/services/approvalsPresentation';

function usePagedRows(rows = [], pageSize = 20) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageSize, rows, safePage]);
  return { page: safePage, pageCount, pageRows, setPage };
}

function ApprovalPager({ page, pageCount, total, onPageChange }) {
  if (total <= 20) return null;
  const first = total ? (page - 1) * 20 + 1 : 0;
  const last = Math.min(page * 20, total);
  return (
    <div className="react-data-table__footer">
      <span className="react-data-table__info">Showing {first} to {last} of {total} entries</span>
      <div className="react-data-table__pager">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label="First page">«</button>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} aria-label="Previous page">‹</button>
        <span className="react-data-table__pager-current">{page}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))} aria-label="Next page">›</button>
        <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)} aria-label="Last page">»</button>
      </div>
    </div>
  );
}

function GenericActions({ row, type, id, submitting, onRequestAction }) {
  if (!row?._isActionableByMe) {
    return <span className="ticket-action-state ticket-action-state--pending">View only</span>;
  }
  return (
    <div className="approval-action-stack">
      <button
        type="button"
        className="ticket-action-btn ticket-action-btn--done"
        disabled={submitting}
        onClick={() => onRequestAction({ kind: 'approve', type, id, row })}
      >
        Approve
      </button>
      <button
        type="button"
        className="ticket-action-btn ticket-action-btn--pause"
        disabled={submitting}
        onClick={() => onRequestAction({ kind: 'reject', type, id, row })}
      >
        Reject
      </button>
    </div>
  );
}

export function LeaveApprovalTable({ rows, submitting, onRequestAction }) {
  const { page, pageCount, pageRows, setPage } = usePagedRows(rows, 20);
  return (
    <>
    <div className="dashboard-table-wrap">
      <table className="dashboard-table approval-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Type</th>
            <th>Day Type</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            pageRows.map((row) => (
              <tr key={row['Leave ID'] || row.LeaveID || row.leaveId}>
                <td data-label="Employee">
                  <div className="approval-user-cell">
                    <strong>{row['Employee Name'] || row.employeeName || '-'}</strong>
                    <span>{row['Employee ID'] || row.employeeId || '-'}</span>
                  </div>
                </td>
                <td data-label="Type">{row['Leave Type'] || row.leaveType || row.type || '-'}</td>
                <td data-label="Day Type">{row['Day Type'] || row.dayType || '-'}</td>
                <td data-label="Start Date">{formatApprovalDate(row['Start Date'] || row.startDate)}</td>
                <td data-label="End Date">{formatApprovalDate(row['End Date'] || row.endDate)}</td>
                <td data-label="Reason" className="approval-table__copy">{row.Reason || row.reason || '-'}</td>
                <td data-label="Status"><StatusPill tone={toneForApprovalStatus(row.Status || row.status)}>{row.Status || row.status || 'Pending'}</StatusPill></td>
                <td data-label="Action">
                  <GenericActions
                    row={row}
                    type="Leave"
                    id={row['Leave ID'] || row.LeaveID || row.leaveId}
                    submitting={submitting}
                    onRequestAction={onRequestAction}
                  />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" className="dashboard-table__empty">No leave requests found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <ApprovalPager page={page} pageCount={pageCount} total={rows.length} onPageChange={setPage} />
    </>
  );
}

export function IntimationApprovalTable({ rows, submitting, onRequestAction }) {
  const { page, pageCount, pageRows, setPage } = usePagedRows(rows, 20);
  return (
    <>
    <div className="dashboard-table-wrap">
      <table className="dashboard-table approval-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Type</th>
            <th>Date</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            pageRows.map((row) => (
              <tr key={row['Intimation ID'] || row.IntimationID || row.intimationId}>
                <td data-label="Employee">
                  <div className="approval-user-cell">
                    <strong>{row['Employee Name'] || row.employeeName || '-'}</strong>
                    <span>{row['Employee ID'] || row.employeeId || '-'}</span>
                  </div>
                </td>
                <td data-label="Type">{row['Intimation Type'] || row.Type || row.type || '-'}</td>
                <td data-label="Date">{formatApprovalDate(row['Intimation Date'] || row.Date || row.date)}</td>
                <td data-label="Reason" className="approval-table__copy">{row.Reason || row.reason || '-'}</td>
                <td data-label="Status"><StatusPill tone={toneForApprovalStatus(row.Status || row.status)}>{row.Status || row.status || 'Submitted'}</StatusPill></td>
                <td data-label="Action">
                  <GenericActions
                    row={row}
                    type="Intimation"
                    id={row['Intimation ID'] || row.IntimationID || row.intimationId}
                    submitting={submitting}
                    onRequestAction={onRequestAction}
                  />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="dashboard-table__empty">No intimations found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <ApprovalPager page={page} pageCount={pageCount} total={rows.length} onPageChange={setPage} />
    </>
  );
}

export function AttendanceApprovalTable({ rows, submitting, onRequestAction }) {
  const { page, pageCount, pageRows, setPage } = usePagedRows(rows, 20);
  return (
    <>
    <div className="dashboard-table-wrap">
      <table className="dashboard-table approval-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            pageRows.map((row) => (
              <tr key={row.AttendanceID || row['AttendanceID']}>
                <td data-label="Employee">
                  <div className="approval-user-cell">
                    <strong>{row['Employee Name'] || '-'}</strong>
                    <span>{row['Employee ID'] || '-'}</span>
                  </div>
                </td>
                <td data-label="Date">{formatApprovalDate(row.Date || row.DateStr)}</td>
                <td data-label="Punch In">{row.PunchIn || row['Punch In'] || '-'}</td>
                <td data-label="Punch Out">{row.PunchOut || row['Punch Out'] || '-'}</td>
                <td data-label="Duration">{row.Duration || '-'}</td>
                <td data-label="Status"><StatusPill tone={toneForApprovalStatus(row.Status)}>{row.Status || 'Pending'}</StatusPill></td>
                <td data-label="Action">
                  <GenericActions
                    row={row}
                    type="Attendance"
                    id={row.AttendanceID || row['AttendanceID']}
                    submitting={submitting}
                    onRequestAction={onRequestAction}
                  />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="dashboard-table__empty">No attendance approvals found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <ApprovalPager page={page} pageCount={pageCount} total={rows.length} onPageChange={setPage} />
    </>
  );
}
