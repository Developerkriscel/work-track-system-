import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SessionStatusScreen } from '@/features/auth/components/SessionStatusScreen';
import { useAuth } from '@/features/auth/AuthProvider';

export function RequireAuth() {
  const location = useLocation();
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <SessionStatusScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
