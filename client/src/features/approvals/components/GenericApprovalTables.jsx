import { StatusPill } from '@/components/common/StatusPill';
import { formatApprovalDate, toneForApprovalStatus } from '@/features/approvals/services/approvalsPresentation';

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
  return (
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
            rows.map((row) => (
              <tr key={row['Leave ID'] || row.LeaveID || row.leaveId}>
                <td>
                  <div className="approval-user-cell">
                    <strong>{row['Employee Name'] || row.employeeName || '-'}</strong>
                    <span>{row['Employee ID'] || row.employeeId || '-'}</span>
                  </div>
                </td>
                <td>{row['Leave Type'] || row.leaveType || row.type || '-'}</td>
                <td>{row['Day Type'] || row.dayType || '-'}</td>
                <td>{formatApprovalDate(row['Start Date'] || row.startDate)}</td>
                <td>{formatApprovalDate(row['End Date'] || row.endDate)}</td>
                <td className="approval-table__copy">{row.Reason || row.reason || '-'}</td>
                <td><StatusPill tone={toneForApprovalStatus(row.Status || row.status)}>{row.Status || row.status || 'Pending'}</StatusPill></td>
                <td>
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
  );
}

export function IntimationApprovalTable({ rows, submitting, onRequestAction }) {
  return (
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
            rows.map((row) => (
              <tr key={row['Intimation ID'] || row.IntimationID || row.intimationId}>
                <td>
                  <div className="approval-user-cell">
                    <strong>{row['Employee Name'] || row.employeeName || '-'}</strong>
                    <span>{row['Employee ID'] || row.employeeId || '-'}</span>
                  </div>
                </td>
                <td>{row['Intimation Type'] || row.Type || row.type || '-'}</td>
                <td>{formatApprovalDate(row['Intimation Date'] || row.Date || row.date)}</td>
                <td className="approval-table__copy">{row.Reason || row.reason || '-'}</td>
                <td><StatusPill tone={toneForApprovalStatus(row.Status || row.status)}>{row.Status || row.status || 'Submitted'}</StatusPill></td>
                <td>
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
  );
}

export function AttendanceApprovalTable({ rows, submitting, onRequestAction }) {
  return (
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
            rows.map((row) => (
              <tr key={row.AttendanceID || row['AttendanceID']}>
                <td>
                  <div className="approval-user-cell">
                    <strong>{row['Employee Name'] || '-'}</strong>
                    <span>{row['Employee ID'] || '-'}</span>
                  </div>
                </td>
                <td>{formatApprovalDate(row.Date || row.DateStr)}</td>
                <td>{row.PunchIn || row['Punch In'] || '-'}</td>
                <td>{row.PunchOut || row['Punch Out'] || '-'}</td>
                <td>{row.Duration || '-'}</td>
                <td><StatusPill tone={toneForApprovalStatus(row.Status)}>{row.Status || 'Pending'}</StatusPill></td>
                <td>
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
  );
}
