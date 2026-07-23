import { useEffect, useState } from 'react';
import { useClientAuth } from '@/features/auth/ClientAuthProvider';

export function useClientPortalResource(loadResource, initialValue) {
  const { client } = useClientAuth();
  const clientId = client?.Client_Id || client?.['Client ID'] || '';
  const [state, setState] = useState({
    loading: true,
    error: null,
    value: initialValue
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!clientId) {
        setState({
          loading: false,
          error: 'Client session is missing a client ID.',
          value: initialValue
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const value = await loadResource(clientId);
        if (!alive) return;
        setState({ loading: false, error: null, value });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load client workspace data.',
          value: initialValue
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [clientId, loadResource]);

  return {
    client,
    clientId,
    loading: state.loading,
    error: state.error,
    value: state.value
  };
}
