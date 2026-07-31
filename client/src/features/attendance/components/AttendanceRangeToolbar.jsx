export function AttendanceRangeToolbar({
  activeView,
  canManageTeamAttendance,
  onViewChange
}) {
  return (
    <div className="attendance-section-head">
      <div className="attendance-section-tabs">
        <button
          type="button"
          className={`attendance-tab${activeView === 'self' ? ' attendance-tab--active' : ''}`}
          onClick={() => onViewChange('self')}
        >
          Attendance Log
        </button>
        {canManageTeamAttendance ? (
          <button
            type="button"
            className={`attendance-tab${activeView === 'team' ? ' attendance-tab--active' : ''}`}
            onClick={() => onViewChange('team')}
          >
            My Team Attendance
          </button>
        ) : null}
      </div>
    </div>
  );
}
