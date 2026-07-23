import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchEmployeeSession, loginEmployee } from '@/features/auth/api';
import { persistEmployeeSession, readStoredEmployeeSession } from '@/features/auth/services/sessionPersistence';
import { persistClientSession } from '@/features/auth/services/clientSessionPersistence';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredEmployeeSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const stored = readStoredEmployeeSession();

    async function validate() {
      if (!stored?.user?.['Employee ID']) {
        if (alive) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      try {
        const payload = await fetchEmployeeSession(stored.user['Employee ID']);
        if (!alive) return;
        const nextSession = {
          user: payload.user,
          token: payload.token
        };
        setSession(nextSession);
        persistEmployeeSession(nextSession);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setSession(null);
        persistEmployeeSession(null);
        setError(err.message || 'Your session expired. Please login again.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    validate();
    return () => {
      alive = false;
    };
  }, []);

  async function signIn(employeeId, password) {
    setLoading(true);
    setError(null);
    try {
      const payload = await loginEmployee(employeeId, password);
      const nextSession = {
        user: payload.user,
        token: payload.token
      };
      setSession(nextSession);
      persistEmployeeSession(nextSession);
      persistClientSession(null);
      return { success: true, user: payload.user };
    } catch (err) {
      const message = err.message || 'Login failed.';
      setError(message);
      setSession(null);
      persistEmployeeSession(null);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    setSession(null);
    setError(null);
    persistEmployeeSession(null);
  }

  const value = useMemo(() => ({
    loading,
    error,
    isAuthenticated: Boolean(session?.user),
    session,
    user: session?.user || null,
    signIn,
    signOut,
    clearError: () => setError(null)
  }), [loading, error, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
