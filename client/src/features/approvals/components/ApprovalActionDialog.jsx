import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function ApprovalActionDialog({ action, approvers = [], saving, onClose, onSubmit }) {
  const isTransfer = action?.kind === 'ticket-transfer';
  const isRework = action?.kind === 'ticket-rework' || action?.kind === 'reject';
  const isAttendanceApprove = action?.kind === 'approve' && action?.type === 'Attendance';
  const [remarks, setRemarks] = useState(isRework ? 'Please rework and resubmit.' : 'Approved from Work Track System.');
  const [target, setTarget] = useState(approvers[0]?.id || '');
  const [newPunchIn, setNewPunchIn] = useState(action?.row?.PunchIn && action.row.PunchIn !== '-' ? String(action.row.PunchIn).slice(0, 5) : '');
  const [newPunchOut, setNewPunchOut] = useState(action?.row?.PunchOut && action.row.PunchOut !== '-' ? String(action.row.PunchOut).slice(0, 5) : '');

  function handleSubmit(event) {
    event.preventDefault();
    if (isTransfer && !target) return;
    onSubmit(
      isTransfer
        ? { target, remarks }
        : isAttendanceApprove
          ? { remarks, newPunchIn, newPunchOut }
          : { remarks }
    );
  }

  return (
    <AppModal title={isTransfer ? 'Transfer Ticket Approval' : isRework ? 'Add Rework Remarks' : 'Add Approval Remarks'} onClose={onClose} width="580px">
      <form className="ticket-form-grid" onSubmit={handleSubmit}>
        {isTransfer ? <label className="dashboard-control"><span>Transfer To</span><select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">Select approver</option>{approvers.map((approver) => <option key={approver.id} value={approver.id}>{approver.name} ({approver.id})</option>)}</select></label> : null}
        {isAttendanceApprove ? (
          <>
            <div style={{ background: '#eff6ff', color: '#1e3a8a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', gridColumn: '1 / -1' }}>
              <span>💡 You can correct punch timings before approving this attendance entry.</span>
            </div>
            <label className="dashboard-control">
              <span>Punch In</span>
              <input type="time" value={newPunchIn} onChange={(event) => setNewPunchIn(event.target.value)} />
            </label>
            <label className="dashboard-control">
              <span>Punch Out</span>
              <input type="time" value={newPunchOut} onChange={(event) => setNewPunchOut(event.target.value)} />
            </label>
          </>
        ) : null}
        <label className="dashboard-control forms-editor__full"><span>Remarks</span><textarea rows="4" value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
        <div className="ticket-form-actions forms-editor__full"><button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button><button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Submitting...' : isTransfer ? 'Transfer Approval' : 'Submit Action'}</button></div>
      </form>
    </AppModal>
  );
}
