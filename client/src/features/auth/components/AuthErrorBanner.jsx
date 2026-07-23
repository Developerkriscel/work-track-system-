import { StatusPill } from '@/components/common/StatusPill';

export function AuthErrorBanner({ error }) {
  if (!error) return null;

  return (
    <div className="dashboard-banner dashboard-banner--error">
      <StatusPill tone="danger">Login failed</StatusPill>
      <span>{error}</span>
    </div>
  );
}
