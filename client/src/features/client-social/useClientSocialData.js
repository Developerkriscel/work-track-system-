import { useEffect, useMemo, useState } from 'react';
import { useClientAuth } from '@/features/auth/ClientAuthProvider';
import {
  addClientSocialRemark,
  fetchClientSocialTasks,
  fetchSocialTaskDetails,
  fetchSocialTaskHistory,
  updateClientSocialStatus
} from '@/features/client-social/api';
import {
  persistClientSocialId,
  readStoredClientSocialId
} from '@/features/client-social/services/clientSocialPresentation';

export function useClientSocialData() {
  const { client } = useClientAuth();
  const authenticatedClientId = String(client?.Client_Id || client?.['Client ID'] || '').trim().toUpperCase();
  const [clientId, setClientIdState] = useState(() => readStoredClientSocialId() || authenticatedClientId);
  const [filters, setFilters] = useState({
    platform: '',
    status: ''
  });
  const [state, setState] = useState({
    loading: true,
    error: null,
    rows: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [details, setDetails] = useState({
    loading: false,
    post: null,
    history: []
  });
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    persistClientSocialId(clientId);
  }, [clientId]);

  useEffect(() => {
    if (authenticatedClientId && authenticatedClientId !== clientId) {
      setClientIdState(authenticatedClientId);
    }
  }, [authenticatedClientId, clientId]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!clientId) {
        setState({ loading: false, error: null, rows: [] });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchClientSocialTasks(clientId, null, null);
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          rows: Array.isArray(payload.data) ? payload.data : []
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load client social tasks.',
          rows: []
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [clientId, refreshVersion]);

  const visibleRows = useMemo(() => {
    return state.rows.filter((row) => {
      const matchesPlatform = !filters.platform || String(row.Platform || '').toLowerCase() === filters.platform.toLowerCase();
      const matchesStatus = !filters.status || String(row.Status || '').toLowerCase() === filters.status.toLowerCase();
      return matchesPlatform && matchesStatus;
    });
  }, [state.rows, filters]);

  const platformOptions = useMemo(() => {
    return Array.from(new Set(state.rows.map((row) => row.Platform).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [state.rows]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(state.rows.map((row) => row.Status).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [state.rows]);

  function setClientId(value) {
    setClientIdState(String(value || '').trim().toUpperCase());
  }

  function updateFilters(patch) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilters({ platform: '', status: '' });
  }

  function refresh() {
    setRefreshVersion((current) => current + 1);
  }

  async function openDetails(row) {
    setDetails({ loading: true, post: null, history: [] });
    try {
      const [postPayload, historyPayload] = await Promise.all([
        fetchSocialTaskDetails(row['Post ID'] || row.ID, authenticatedClientId),
        fetchSocialTaskHistory(row['Post ID'] || row.ID, authenticatedClientId)
      ]);
      setDetails({
        loading: false,
        post: postPayload.data || row,
        history: Array.isArray(historyPayload.history) ? historyPayload.history : []
      });
    } catch (error) {
      setDetails({ loading: false, post: row, history: [] });
      setMessage({ tone: 'danger', text: error.message || 'Failed to load social task details.' });
    }
  }

  function closeDetails() {
    setDetails({ loading: false, post: null, history: [] });
  }

  async function runAction(action, successText) {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage({
        tone: result.success ? 'success' : 'danger',
        text: result.success ? successText : result.message
      });
      if (result.success) refresh();
      return result;
    } catch (error) {
      const text = error.message || 'Action failed.';
      setMessage({ tone: 'danger', text });
      return { success: false, message: text };
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(row, newStatus, remarks) {
    return runAction(
      () => updateClientSocialStatus(row['Post ID'] || row.ID, newStatus, remarks, {
        Client_Id: authenticatedClientId,
        'Client ID': authenticatedClientId,
        'Client Name': client?.['Client Name'] || clientId
      }),
      `Social task ${row['Post ID'] || row.ID} updated successfully.`
    );
  }

  async function addRemark(historyId, clientRemark) {
    return runAction(
      () => addClientSocialRemark(historyId, clientRemark, authenticatedClientId),
      'Client remark added successfully.'
    );
  }

  return {
    clientId,
    setClientId,
    loading: state.loading,
    error: state.error,
    rows: visibleRows,
    allRows: state.rows,
    submitting,
    message,
    filters,
    updateFilters,
    resetFilters,
    refresh,
    platformOptions,
    statusOptions,
    details,
    openDetails,
    closeDetails,
    updateStatus,
    addRemark
  };
}
