export function AttendanceRangeToolbar({
  activeView,
  canManageTeamAttendance,
  range,
  customStart,
  customEnd,
  onViewChange,
  onRangeChange,
  onCustomStartChange,
  onCustomEndChange
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
      <div className="dashboard-controls">
        <label className="dashboard-control">
          <span>Date Range</span>
          <select value={range} onChange={(event) => onRangeChange(event.target.value)}>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="last_week">Last Week</option>
            <option value="month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="all">All History</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {range === 'custom' ? (
          <>
            <label className="dashboard-control">
              <span>Start Date</span>
              <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
            </label>
            <label className="dashboard-control">
              <span>End Date</span>
              <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
