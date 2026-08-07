import { Clock3 } from '@/components/common/icons';

export function AttendanceHeader({ title, employeeLabel, isPunchedIn, timer, actions }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Attendance Workspace</p>
        <h1 className="page-card__title page-card__title--dashboard">{title}</h1>
        {isPunchedIn ? (
          <div className="attendance-live-timer">
            <Clock3 className="attendance-live-timer__icon" />
            <strong>{timer}</strong>
          </div>
        ) : null}
      </div>

      <div className="dashboard-controls">
        {actions}
      </div>
    </div>
  );
}
