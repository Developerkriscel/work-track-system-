import { RefreshCw } from '@/components/common/icons';

export function ClientSocialHeader({ clientId, onClientIdChange, onRefresh }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Client Social Workspace</p>
        <h1 className="page-card__title">Social Tasks</h1>
      </div>

      <div className="dashboard-controls">
        <label className="dashboard-control">
          <span>Client ID</span>
          <input value={clientId} onChange={(event) => onClientIdChange(event.target.value)} placeholder="e.g. CL000" />
        </label>
        <button type="button" className="attendance-cta attendance-cta--blue approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
