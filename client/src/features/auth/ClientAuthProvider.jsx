import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchClientSession, loginClient } from '@/features/auth/api';
import {
  persistClientSession,
  readStoredClientSession
} from '@/features/auth/services/clientSessionPersistence';
import { persistEmployeeSession } from '@/features/auth/services/sessionPersistence';

const ClientAuthContext = createContext(null);

export function ClientAuthProvider({ children }) {
  const [session, setSession] = useState(readStoredClientSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const stored = readStoredClientSession();

    async function validate() {
      if (!stored?.client?.Client_Id && !stored?.client?.['Client ID']) {
        if (alive) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      try {
        const clientId = stored.client.Client_Id || stored.client['Client ID'];
        const payload = await fetchClientSession(clientId);
        if (!alive) return;
        const nextSession = {
          client: payload.client,
          token: payload.token
        };
        setSession(nextSession);
        persistClientSession(nextSession);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setSession(null);
        persistClientSession(null);
        setError(err.message || 'Client session expired. Please login again.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    validate();
    return () => {
      alive = false;
    };
  }, []);

  async function signIn(clientId, password) {
    setLoading(true);
    setError(null);
    try {
      const payload = await loginClient(clientId, password);
      const nextSession = {
        client: payload.client,
        token: payload.token
      };
      setSession(nextSession);
      persistClientSession(nextSession);
      persistEmployeeSession(null);
      return { success: true, client: payload.client };
    } catch (err) {
      const message = err.message || 'Client login failed.';
      setError(message);
      setSession(null);
      persistClientSession(null);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    setSession(null);
    setError(null);
    persistClientSession(null);
  }

  const value = useMemo(
    () => ({
      loading,
      error,
      isAuthenticated: Boolean(session?.client),
      session,
      client: session?.client || null,
      signIn,
      signOut,
      clearError: () => setError(null)
    }),
    [loading, error, session]
  );

  return <ClientAuthContext.Provider value={value}>{children}</ClientAuthContext.Provider>;
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within ClientAuthProvider.');
  }
  return context;
}
