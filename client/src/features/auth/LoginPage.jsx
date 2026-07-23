import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthErrorBanner } from '@/features/auth/components/AuthErrorBanner';
import { EmployeeLoginForm } from '@/features/auth/components/EmployeeLoginForm';
import { LoginShell } from '@/features/auth/components/LoginShell';
import { useAuth } from '@/features/auth/AuthProvider';

export function LoginPage() {
  const location = useLocation();
  const { isAuthenticated, loading, error, signIn, clearError } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || '/';

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearError();
    setSubmitting(true);
    const result = await signIn(employeeId.trim().toUpperCase(), password);
    if (!result.success) {
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  }

  return (
    <LoginShell>
      <AuthErrorBanner error={error} />
      <EmployeeLoginForm
        employeeId={employeeId}
        password={password}
        loading={loading}
        submitting={submitting}
        onEmployeeIdChange={setEmployeeId}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
      />
    </LoginShell>
  );
}
