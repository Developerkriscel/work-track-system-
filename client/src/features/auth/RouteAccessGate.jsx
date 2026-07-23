import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

export function RouteAccessGate({ route, children }) {
  const location = useLocation();
  const { user } = useAuth();

  if (route?.accessCheck && !route.accessCheck(user)) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
