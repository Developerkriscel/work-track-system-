import { StatusPill } from '@/components/common/StatusPill';
import { formatPunchTime, toneForAttendanceStatus } from '@/features/attendance/services/attendancePresentation';

function dateParts(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { weekday: '-', day: '-', month: '-' };
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    day: date.getDate(),
    month: date.toLocaleDateString('en-US', { month: 'short' })
  };
}

function AttendanceEvent({ row, action }) {
  const event = action === 'in' ? row.punchIn : row.punchOut;
  const value = event?.[action === 'in' ? 'Punch In' : 'Punch Out'];
  if (!event || !value) return <span className="attendance-empty-time">{action === 'in' && row.isPendingToday ? 'Not Punched Yet' : '-- : --'}</span>;
  const hasLocation = Boolean((event.Latitude || event.Lattitude) && event.Longitude);
  const hasPhoto = Boolean(event.Photo || event['Photo Url'] || event['Photo URL']);
  return (
    <div className="attendance-event">
      <strong>{formatPunchTime(value)}</strong>
      <div className="attendance-event__meta">
        <span className={hasLocation ? 'attendance-meta-chip attendance-meta-chip--location' : 'attendance-meta-chip'} title="Location capture">Location</span>
        <span className={hasPhoto ? 'attendance-meta-chip attendance-meta-chip--photo' : 'attendance-meta-chip'} title="Photo capture">Photo</span>
      </div>
    </div>
  );
}

export function AttendanceHistoryTable({ rows }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Status</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.date}>
                <td>
                  <div className="attendance-date-card">
                    <span>{dateParts(row.date).weekday}</span>
                    <strong>{dateParts(row.date).day}</strong>
                    <small>{dateParts(row.date).month}</small>
                  </div>
                </td>
                <td><AttendanceEvent row={row} action="in" /></td>
                <td><AttendanceEvent row={row} action="out" /></td>
                <td>
                  <StatusPill tone={toneForAttendanceStatus(row.status)}>{row.status}</StatusPill>
                </td>
                <td>{row.duration}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="dashboard-table__empty">
                No attendance records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function LeaveHistoryTable({ rows = [] }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Duration</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row['Leave ID'] || row.LeaveID || row.Timestamp}>
                <td>
                  <strong>{row['Leave Type']}</strong>
                  <br />
                  <small>{row['Day Type']}</small>
                </td>
                <td>
                  {formatDate(row['Start Date'])}
                  {row['Start Date'] !== row['End Date'] && ` to ${formatDate(row['End Date'])}`}
                </td>
                <td>{row.Reason}</td>
                <td>
                  <StatusPill tone={/approved/i.test(row.Status) ? 'success' : /pending/i.test(row.Status) ? 'warning' : 'danger'}>
                    {row.Status}
                  </StatusPill>
                </td>
                <td>{row['Admin Remarks'] || '-'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="dashboard-table__empty">
                No leave records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function IntimationHistoryTable({ rows = [] }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row['Intimation ID'] || row.IntimationID || row.Timestamp}>
                <td>{formatDate(row['Intimation Date'])}</td>
                <td><strong>{row['Intimation Type']}</strong></td>
                <td>{row.Reason}</td>
                <td>
                  <StatusPill tone={/approved/i.test(row.Status) ? 'success' : /submitted/i.test(row.Status) ? 'warning' : 'danger'}>
                    {row.Status}
                  </StatusPill>
                </td>
                <td>{row['Admin Remarks'] || '-'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="dashboard-table__empty">
                No intimation records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TeamAttendanceTable({ rows = [], onEdit }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table attendance-team-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="attendance-team-user">
                    <strong>{row.employeeName || row.employeeId}</strong>
                    <span>{[row.employeeId, row.role, row.department].filter(Boolean).join(' | ')}</span>
                  </div>
                </td>
                <td>
                  <div className="attendance-date-card">
                    <span>{dateParts(row.date).weekday}</span>
                    <strong>{dateParts(row.date).day}</strong>
                    <small>{dateParts(row.date).month}</small>
                  </div>
                </td>
                <td><AttendanceEvent row={row} action="in" /></td>
                <td><AttendanceEvent row={row} action="out" /></td>
                <td><StatusPill tone={toneForAttendanceStatus(row.status)}>{row.status}</StatusPill></td>
                <td>{row.duration || '-'}</td>
                <td>
                  <button type="button" className="attendance-cta attendance-cta--blue attendance-team-table__edit" onClick={() => onEdit(row)}>
                    Edit Times
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="dashboard-table__empty">
                No team attendance records found for this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TeamAttendanceEditDialog({
  row,
  form,
  saving,
  onChange,
  onClose,
  onSubmit
}) {
  if (!row) return null;

  return (
    <div className="app-modal-layer" role="presentation">
      <button type="button" className="app-modal-layer__backdrop" aria-label="Close attendance editor" onClick={onClose} />
      <section className="app-modal attendance-team-modal" role="dialog" aria-modal="true" aria-label="Edit team attendance">
        <header className="app-modal__header">
          <div>
            <div className="login-card__eyebrow">Team Attendance</div>
            <div className="app-modal__title">Edit Punch Time</div>
            <p className="attendance-team-modal__meta">
              {row.employeeName || row.employeeId} {row.employeeId ? `| ${row.employeeId}` : ''} {row.date ? `| ${row.date}` : ''}
            </p>
          </div>
          <button type="button" className="app-modal__close" onClick={onClose}>X</button>
        </header>
        <div className="app-modal__body">
          <div className="attendance-team-modal__grid">
            <label className="dashboard-control">
              <span>Punch In Time</span>
              <input
                type="text"
                value={form.punchInTime}
                onChange={(event) => onChange('punchInTime', event.target.value)}
                placeholder="e.g. 09:45 am"
              />
            </label>
            <label className="dashboard-control">
              <span>Punch Out Time</span>
              <input
                type="text"
                value={form.punchOutTime}
                onChange={(event) => onChange('punchOutTime', event.target.value)}
                placeholder="e.g. 06:30 pm"
              />
            </label>
          </div>
          <div className="attendance-team-modal__hint">
            Use the same time style as the old app, like <strong>09:58 am</strong> or <strong>06:42 pm</strong>.
          </div>
          <div className="client-ticket-details__actions attendance-team-modal__actions">
            <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="attendance-cta attendance-cta--green" onClick={onSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
