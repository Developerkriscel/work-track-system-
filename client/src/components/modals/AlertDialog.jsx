import { AppModal } from './AppModal';

export function AlertDialog({ title = 'Notice', message, buttonLabel = 'OK', onClose }) {
  if (!message) return null;

  return (
    <AppModal title={title} onClose={onClose} width="400px">
      <div className="confirm-dialog">
        <p style={{ textAlign: 'center', margin: '0 0 24px', fontSize: '15px', color: 'var(--wt-text)' }}>
          {message}
        </p>
        <div className="ticket-form-actions" style={{ justifyContent: 'center' }}>
          <button 
            type="button" 
            className="attendance-cta attendance-cta--blue" 
            onClick={onClose}
            autoFocus
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
