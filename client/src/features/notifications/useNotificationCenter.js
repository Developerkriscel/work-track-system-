import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchClientNotifications, fetchEmployeeNotifications } from './api';

const POLL_MS = 45000;
const MAX_READ_KEYS = 500;
const TERMINAL_STATUS_RE = /closed|done|completed|resolved|cancelled|canceled|paid|approved/i;
const PASSIVE_STATUS_RE = /present|active/i;

function buildReadKey(mode, subjectId) {
  const normalizedSubject = String(subjectId || '').trim().toLowerCase();
  if (!normalizedSubject) return '';
  return `wt_notification_read_at_${mode}_${normalizedSubject.replace(/[^a-z0-9]+/g, '_')}`;
}

function buildReadItemsKey(mode, subjectId) {
  const normalizedSubject = String(subjectId || '').trim().toLowerCase();
  if (!normalizedSubject) return '';
  return `wt_notification_read_items_${mode}_${normalizedSubject.replace(/[^a-z0-9]+/g, '_')}`;
}

function notificationFingerprint(item = {}) {
  const parts = [
    item.module,
    item.type,
    item.id || item['Ticket ID'] || item['Task ID'] || item.ID,
    item.Status,
    item.Timestamp || item['Last Update Date'],
    item.Message
  ];
  return parts.map((part) => String(part ?? '').trim().toLowerCase()).join('|');
}

function notificationTime(item = {}) {
  const parsed = Date.parse(item.Timestamp || item['Last Update Date'] || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isActionableNotification(item = {}) {
  const status = String(item.Status || '').trim();
  if (!status) return true;
  if (/pending approval/i.test(status)) return true;
  if (TERMINAL_STATUS_RE.test(status)) return false;
  if (PASSIVE_STATUS_RE.test(status)) return false;
  return true;
}

export function useNotificationCenter({ mode = 'employee', subjectId = '' } = {}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const [serverTime, setServerTime] = useState(0);
  const [readKeys, setReadKeys] = useState(() => new Set());
  const lastSeenRef = useRef(0);
  const readKeysRef = useRef(new Set());

  const storageKey = useMemo(() => buildReadKey(mode, subjectId), [mode, subjectId]);
  const readItemsKey = useMemo(() => buildReadItemsKey(mode, subjectId), [mode, subjectId]);

  useEffect(() => {
    if (!storageKey) {
      setLastSeenAt(0);
      setReadKeys(new Set());
      lastSeenRef.current = 0;
      readKeysRef.current = new Set();
      return;
    }

    try {
      const stored = Number(localStorage.getItem(storageKey) || 0);
      const nextLastSeenAt = Number.isFinite(stored) ? stored : 0;
      const storedKeys = JSON.parse(localStorage.getItem(readItemsKey) || '[]');
      const nextReadKeys = new Set(Array.isArray(storedKeys) ? storedKeys : []);
      setLastSeenAt(nextLastSeenAt);
      setReadKeys(nextReadKeys);
      lastSeenRef.current = nextLastSeenAt;
      readKeysRef.current = nextReadKeys;
    } catch {
      setLastSeenAt(0);
      setReadKeys(new Set());
      lastSeenRef.current = 0;
      readKeysRef.current = new Set();
    }
  }, [readItemsKey, storageKey]);

  const persistReadState = useCallback((value, keys = readKeysRef.current) => {
    const nextLastSeenAt = Number(value) || 0;
    const nextReadKeys = new Set(Array.from(keys).filter(Boolean).slice(-MAX_READ_KEYS));
    lastSeenRef.current = nextLastSeenAt;
    readKeysRef.current = nextReadKeys;
    setReadKeys(nextReadKeys);
    setLastSeenAt(nextLastSeenAt);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, String(nextLastSeenAt));
      localStorage.setItem(readItemsKey, JSON.stringify(Array.from(nextReadKeys)));
    } catch {
      // Ignore storage failures; notification reading should still work in-memory.
    }
  }, [readItemsKey, storageKey]);

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
      const nextItems = (result.notifications || result.updates || []).filter(isActionableNotification);
      const nextServerTime = Number(result.serverTime) || Date.parse(result.serverTime) || Date.now();
      setItems(nextItems);
      setServerTime(nextServerTime);

      if (!lastSeenRef.current && readKeysRef.current.size === 0) {
        persistReadState(nextServerTime, new Set(nextItems.map(notificationFingerprint)));
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [mode, persistReadState, subjectId]);

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
    const key = notificationFingerprint(item);
    const itemTs = notificationTime(item);
    const isNew = !readKeys.has(key) && (!lastSeenAt || (itemTs > 0 && itemTs > lastSeenAt));
    return { ...item, isNew, notificationKey: key };
  }), [items, lastSeenAt, readKeys]);

  const count = useMemo(
    () => decoratedItems.filter((item) => item.isNew).length,
    [decoratedItems]
  );

  const markAllRead = useCallback((timestamp = serverTime || Date.now()) => {
    const latestItemTime = decoratedItems.reduce((latest, item) => Math.max(latest, notificationTime(item)), 0);
    const nextTimestamp = Math.max(Number(timestamp) || 0, Date.now(), latestItemTime);
    const nextReadKeys = new Set(readKeysRef.current);
    decoratedItems.forEach((item) => nextReadKeys.add(item.notificationKey || notificationFingerprint(item)));
    persistReadState(nextTimestamp, nextReadKeys);
  }, [decoratedItems, persistReadState, serverTime]);

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
