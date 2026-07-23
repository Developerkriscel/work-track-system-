import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchClientNotifications, fetchEmployeeNotifications } from './api';

const POLL_MS = 45000;

export function useNotificationCenter({ mode = 'employee', subjectId = '' } = {}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lastCheckRef = useRef(mode === 'employee' ? 0 : new Date(0).toISOString());

  const load = useCallback(async () => {
    if (!subjectId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = mode === 'client'
        ? await fetchClientNotifications(subjectId, lastCheckRef.current)
        : await fetchEmployeeNotifications(subjectId, lastCheckRef.current);
      const nextItems = result.notifications || result.updates || [];
      setItems(nextItems);
      lastCheckRef.current = result.serverTime || Date.now();
    } catch (loadError) {
      setError(loadError.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [mode, subjectId]);

  useEffect(() => {
    lastCheckRef.current = mode === 'client' ? new Date(0).toISOString() : 0;
    void load();
  }, [load, mode]);

  useEffect(() => {
    if (!subjectId) return undefined;
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, subjectId]);

  const count = useMemo(
    () => items.filter((item) => !/closed|done|completed|resolved/i.test(String(item.Status || ''))).length,
    [items]
  );

  return {
    items,
    count,
    open,
    loading,
    error,
    refresh: load,
    toggleOpen: () => setOpen((value) => !value),
    close: () => setOpen(false)
  };
}
