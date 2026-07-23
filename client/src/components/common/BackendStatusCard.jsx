import { useApiHealth } from '@/hooks/useApiHealth';
import { StatusPill } from '@/components/common/StatusPill';

export function BackendStatusCard() {
  const { loading, ok, data, error } = useApiHealth();

  return (
    <article className="migration-panel">
      <div className="migration-panel__row">
        <h2>Backend readiness</h2>
        {loading ? (
          <StatusPill tone="neutral">Checking</StatusPill>
        ) : ok ? (
          <StatusPill tone="success">Connected</StatusPill>
        ) : (
          <StatusPill tone="danger">Unavailable</StatusPill>
        )}
      </div>

      {ok ? (
        <div className="kv-grid">
          <div>
            <span className="kv-grid__label">Service</span>
            <strong>{data.service}</strong>
          </div>
          <div>
            <span className="kv-grid__label">Mode</span>
            <strong>{data.mode}</strong>
          </div>
        </div>
      ) : (
        <p>{error || 'Could not reach the API server.'}</p>
      )}
    </article>
  );
}
