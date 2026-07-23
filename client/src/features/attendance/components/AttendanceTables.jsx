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
