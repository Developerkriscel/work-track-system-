import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchClientNotifications, fetchEmployeeNotifications } from './api';

const POLL_MS = 45000;

function buildReadKey(mode, subjectId) {
  const normalizedSubject = String(subjectId || '').trim().toLowerCase();
  if (!normalizedSubject) return '';
  return `wt_notification_read_at_${mode}_${normalizedSubject.replace(/[^a-z0-9]+/g, '_')}`;
}

export function useNotificationCenter({ mode = 'employee', subjectId = '' } = {}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const [serverTime, setServerTime] = useState(0);

  const storageKey = useMemo(() => buildReadKey(mode, subjectId), [mode, subjectId]);

  useEffect(() => {
    if (!storageKey) {
      setLastSeenAt(0);
      return;
    }

    try {
      const stored = Number(localStorage.getItem(storageKey) || 0);
      setLastSeenAt(Number.isFinite(stored) ? stored : 0);
    } catch {
      setLastSeenAt(0);
    }
  }, [storageKey]);

  const persistLastSeenAt = useCallback((value) => {
    setLastSeenAt(value);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      // Ignore storage failures; notification reading should still work in-memory.
    }
  }, [storageKey]);

  const load = useCallback(async () => {
    if (!subjectId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = mode === 'client'
        ? await fetchClientNotifications(subjectId)
        : await fetchEmployeeNotifications(subjectId);
      const nextItems = result.notifications || result.updates || [];
      setItems(nextItems);
      setServerTime(Number(result.serverTime) || Date.parse(result.serverTime) || Date.now());
    } catch (loadError) {
      setError(loadError.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [mode, subjectId]);

  useEffect(() => {
    void load();
  }, [load, mode]);

  useEffect(() => {
    if (!subjectId) return undefined;
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, subjectId]);

  const decoratedItems = useMemo(() => items.map((item) => {
    const itemTs = Date.parse(item.Timestamp || item['Last Update Date'] || 0);
    const isNew = !lastSeenAt || (!Number.isNaN(itemTs) && itemTs > lastSeenAt);
    return { ...item, isNew };
  }), [items, lastSeenAt]);

  const count = useMemo(
    () => decoratedItems.filter((item) => item.isNew).length,
    [decoratedItems]
  );

  const markAllRead = useCallback((timestamp = serverTime || Date.now()) => {
    persistLastSeenAt(timestamp);
  }, [persistLastSeenAt, serverTime]);

  const close = useCallback(() => {
    if (open) {
      markAllRead();
    }
    setOpen(false);
  }, [markAllRead, open]);

  const toggleOpen = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  return {
    items: decoratedItems,
    count,
    open,
    loading,
    error,
    refresh: load,
    markAllRead,
    toggleOpen,
    close
  };
}
