import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SessionStatusScreen } from '@/features/auth/components/SessionStatusScreen';
import { useClientAuth } from '@/features/auth/ClientAuthProvider';

export function RequireClientAuth() {
  const location = useLocation();
  const { loading, isAuthenticated } = useClientAuth();

  if (loading) {
    return <SessionStatusScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/client/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
