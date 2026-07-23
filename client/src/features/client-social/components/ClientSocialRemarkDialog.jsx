import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function ClientSocialRemarkDialog({ action, saving, onClose, onSubmit }) {
  const [remark, setRemark] = useState(action?.defaultValue || '');
  const title = action?.type === 'approve' ? 'Approve Social Task' : action?.type === 'feedback' ? 'Request Creative Changes' : 'Add Client Remark';

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(remark);
  }

  return (
    <AppModal title={title} onClose={onClose} width="560px">
      <form className="ticket-form-grid" onSubmit={handleSubmit}>
        <label className="dashboard-control forms-editor__full"><span>Remarks</span><textarea rows="5" value={remark} onChange={(event) => setRemark(event.target.value)} required /></label>
        <div className="ticket-form-actions forms-editor__full"><button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button><button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Saving...' : 'Submit'}</button></div>
      </form>
    </AppModal>
  );
}
