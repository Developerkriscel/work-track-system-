export function AttendanceActionRow({ onOpenForm, canManageTeamAttendance, onOpenLocationPolicy }) {
  return (
    <div className="attendance-action-row">
      <button type="button" className="attendance-cta attendance-cta--green" onClick={() => onOpenForm('punch')}>
        Punch
      </button>
      <button type="button" className="attendance-cta attendance-cta--blue" onClick={() => onOpenForm('leave')}>
        Apply Leave
      </button>
      <button type="button" className="attendance-cta attendance-cta--purple" onClick={() => onOpenForm('intimation')}>
        Intimation
      </button>
      {canManageTeamAttendance ? (
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onOpenLocationPolicy}>
          Location Policy
        </button>
      ) : null}
    </div>
  );
}
