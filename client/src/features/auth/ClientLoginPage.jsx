import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useClientAuth } from '@/features/auth/ClientAuthProvider';
import { AuthErrorBanner } from '@/features/auth/components/AuthErrorBanner';
import { ClientLoginForm } from '@/features/auth/components/ClientLoginForm';
import { LoginShell } from '@/features/auth/components/LoginShell';

export function ClientLoginPage() {
  const location = useLocation();
  const { isAuthenticated, loading, error, signIn, clearError } = useClientAuth();
  const [clientId, setClientId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || '/client';

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearError();
    setSubmitting(true);
    const result = await signIn(clientId.trim().toUpperCase(), password);
    if (!result.success) {
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  }

  return (
    <LoginShell
      eyebrow="Client Portal"
      title="WorkTrack Client Portal"
      copy="Login with your client ID and password. Your session is validated against the live backend and database."
    >
      <AuthErrorBanner error={error} />
      <ClientLoginForm
        clientId={clientId}
        password={password}
        loading={loading}
        submitting={submitting}
        onClientIdChange={setClientId}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
      />
    </LoginShell>
  );
}
