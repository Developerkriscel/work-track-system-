import { useEffect, useState } from 'react';
import { httpClient } from '@/lib/api/httpClient';

const initialState = {
  loading: true,
  ok: false,
  data: null,
  error: null
};

export function useApiHealth() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let alive = true;

    async function loadHealth() {
      try {
        const data = await httpClient('/api/health');
        if (!alive) return;
        setState({
          loading: false,
          ok: true,
          data,
          error: null
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          ok: false,
          data: null,
          error: error.message || 'Health check failed'
        });
      }
    }

    loadHealth();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
