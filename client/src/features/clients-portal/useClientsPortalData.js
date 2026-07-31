import { useEffect, useMemo, useState } from 'react';
import {
  deleteClientPortalData,
  fetchClientsPortalData,
  saveClientPortalData
} from '@/features/clients-portal/api';
import { useAuth } from '@/features/auth/AuthProvider';

function normalizeClientForm(values = {}) {
  return {
    Client_Id: values.Client_Id || values['Client ID'] || '',
    'Client Name': values['Client Name'] || '',
    'Mobile Number': values['Mobile Number'] || '',
    'Client Email ID': values['Client Email ID'] || '',
    Address: values.Address || '',
    Status: values.Status || 'Active',
    Password: values.Password || '',
    'Detail Shared': values['Detail Shared'] || '',
    Services: values.Services || ''
  };
}

export function useClientsPortalData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [filters, setFilters] = useState({
    client: '',
    status: '',
    service: ''
  });
  const [state, setState] = useState({
    loading: true,
    error: null,
    clients: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [editor, setEditor] = useState({
    open: false,
    client: normalizeClientForm({})
  });
  const [detailsClient, setDetailsClient] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let alive = true;

    async function loadClients() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchClientsPortalData();
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          clients: Array.isArray(payload.data) ? payload.data : []
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load clients portal data.',
          clients: []
        });
      }
    }

    loadClients();
    return () => {
      alive = false;
    };
  }, [refreshVersion]);

  const canManageClients = useMemo(
    () => /^(admin|super admin)$/i.test(String(user?.Role || '').trim()),
    [user?.Role]
  );
  const isSuperAdmin = useMemo(
    () => /^super admin$/i.test(String(user?.Role || '').trim()),
    [user?.Role]
  );

  const clientOptions = useMemo(() => {
    return state.clients
      .map((client) => ({
        id: client.Client_Id || client['Client ID'],
        name: client['Client Name'] || client.Client_Id || ''
      }))
      .filter((client) => client.id)
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
  }, [state.clients]);

  const serviceOptions = useMemo(() => {
    const set = new Set();
    state.clients.forEach((client) => {
      String(client.Services || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => set.add(item));
    });
    return Array.from(set).sort((left, right) => left.localeCompare(right));
  }, [state.clients]);

  const filteredClients = useMemo(() => {
    return state.clients.filter((client) => {
      const matchesClient = !filters.client || (client['Client Name'] || '') === filters.client;
      const matchesStatus = !filters.status || String(client.Status || '').toLowerCase() === filters.status.toLowerCase();
      const services = String(client.Services || '').toLowerCase();
      const matchesService = !filters.service || services.includes(filters.service.toLowerCase());
      return matchesClient && matchesStatus && matchesService;
    });
  }, [filters, state.clients]);

  function updateFilters(patch) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilters({ client: '', status: '', service: '' });
  }

  function refresh() {
    setRefreshVersion((current) => current + 1);
  }

  function openEditor(client) {
    setEditor({
      open: true,
      client: normalizeClientForm(client)
    });
  }

  function closeEditor() {
    setEditor((current) => ({ ...current, open: false }));
  }

  function updateEditor(patch) {
    setEditor((current) => ({
      ...current,
      client: {
        ...current.client,
        ...patch
      }
    }));
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
      const result = { success: false, message: error.message || 'Action failed.' };
      setMessage({ tone: 'danger', text: result.message });
      return result;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEditor() {
    const client = normalizeClientForm(editor.client);
    if (!client['Client Name'].trim()) {
      setMessage({ tone: 'danger', text: 'Client Name is required.' });
      return { success: false, message: 'Client Name is required.' };
    }

    if (!client.Client_Id && !client.Password.trim()) {
      const failure = { success: false, message: 'Password is required when adding a client.' };
      setMessage({ tone: 'danger', text: failure.message });
      return failure;
    }

    const result = await runAction(
      () => saveClientPortalData(client, employeeId),
      `Client ${client.Client_Id || client['Client Name']} saved successfully.`
    );
    if (result.success) closeEditor();
    return result;
  }

  function deleteClient(clientId) {
    return runAction(
      () => deleteClientPortalData(clientId, employeeId),
      `Client ${clientId} deleted successfully.`
    );
  }

  return {
    employeeId,
    currentUser: user || null,
    loading: state.loading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    clients: filteredClients,
    allClientsCount: state.clients.length,
    isAdmin: canManageClients,
    canManageClients,
    isSuperAdmin,
    submitting,
    message, clearMessage: () => setMessage(null),
    filters,
    updateFilters,
    resetFilters,
    refresh,
    clientOptions,
    serviceOptions,
    editor,
    openEditor,
    closeEditor,
    updateEditor,
    submitEditor,
    deleteClient,
    detailsClient,
    setDetailsClient
  };
}
