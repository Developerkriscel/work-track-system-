import { AppModal } from './AppModal';

export function ConfirmDialog({ title = 'Confirm action', message, confirmLabel = 'Confirm', busy = false, onClose, onConfirm }) {
  return (
    <AppModal title={title} onClose={onClose} width="460px">
      <div className="confirm-dialog">
        <p>{message}</p>
        <div className="ticket-form-actions">
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button>
          <button type="button" className="attendance-cta attendance-cta--red" disabled={busy} onClick={onConfirm}>{busy ? 'Working...' : confirmLabel}</button>
        </div>
      </div>
    </AppModal>
  );
}
