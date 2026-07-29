import { RefreshCw } from '@/components/common/icons';
import { StatusPill } from '@/components/common/StatusPill';

export function ClientSocialHeader({ clientId, clientName, onRefresh }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Client Social Workspace</p>
        <h1 className="page-card__title">Social Tasks</h1>
      </div>

      <div className="dashboard-controls">
        <StatusPill tone="info">{clientName || clientId || 'Client Session'}</StatusPill>
        <button type="button" className="attendance-cta attendance-cta--blue approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
