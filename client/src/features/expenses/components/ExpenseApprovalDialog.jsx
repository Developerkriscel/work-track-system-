import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function ExpenseApprovalDialog({ action, busy, onClose, onSubmit }) {
  const isReject = action?.mode === 'Rejected';
  const [remarks, setRemarks] = useState(isReject ? 'Please review and resubmit this expense claim.' : 'Approved from Work Track System.');

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ remarks });
  }

  return (
    <AppModal
      title={isReject ? `Reject Expense ${action?.expense?.ExpenseID || ''}` : `Approve Expense ${action?.expense?.ExpenseID || ''}`}
      onClose={onClose}
      width="560px"
    >
      <form className="ticket-form-grid" onSubmit={handleSubmit}>
        <div className="dashboard-banner">
          <span>
            {isReject
              ? 'Add a clear rejection remark so the employee knows what to fix.'
              : 'Add approval remarks before processing this expense claim.'}
          </span>
        </div>

        <label className="dashboard-control forms-editor__full">
          <span>Remarks</span>
          <textarea rows="4" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </label>

        <div className="ticket-form-actions forms-editor__full">
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={isReject ? 'attendance-cta attendance-cta--red' : 'attendance-cta attendance-cta--blue'} disabled={busy}>
            {busy ? 'Submitting...' : isReject ? 'Reject Expense' : 'Approve Expense'}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
