export function AttendanceRangeToolbar({
  activeView,
  canManageTeamAttendance,
  onViewChange
}) {
  return (
    <div className="attendance-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            Team Attendance
          </button>
        ) : null}
      </div>
    </div>
  );
}
