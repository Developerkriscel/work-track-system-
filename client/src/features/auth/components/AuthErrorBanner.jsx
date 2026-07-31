import { StatusPill } from '@/components/common/StatusPill';

export function AuthErrorBanner({ error }) {
  if (!error) return null;

  return (
    <div className="auth-error-banner">
      <StatusPill tone="danger">Login failed</StatusPill>
      <span>{error}</span>
    </div>
  );
}
