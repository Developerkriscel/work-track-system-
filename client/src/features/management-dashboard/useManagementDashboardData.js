import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchManagementDashboardData } from '@/features/management-dashboard/api';
import {
  managementRangeBounds,
  managementRangeOptions
} from '@/features/management-dashboard/services/managementDashboardPresentation';

function matchesUser(task, userId, userName) {
  const normalizedId = String(userId || '').trim().toUpperCase();
  const normalizedName = String(userName || '').trim().toLowerCase();
  const ownerId = String(task['Employee ID'] || task.EmpID || task.empId || '').trim().toUpperCase();
  const ownerName = String(task.User || task['Employee Name'] || task.Who || '').trim().toLowerCase();
  return ownerId === normalizedId || ownerName === normalizedName;
}

function matchesClient(task, clientId, clientName) {
  const normalizedId = String(clientId || '').trim().toUpperCase();
  const normalizedName = String(clientName || '').trim().toLowerCase();
  const rowId = String(task.Client_Id || task['Client ID'] || '').trim().toUpperCase();
  const rowName = String(task.Client || task['Client Name'] || '').trim().toLowerCase();
  return rowId === normalizedId || rowName === normalizedName;
}

export function useManagementDashboardData() {
  const { user } = useAuth();
  const [range, setRange] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [state, setState] = useState({
    loading: true,
    error: null,
    payload: null
  });
  const refreshRef = useRef(0);

  const bounds = useMemo(() => managementRangeBounds(range), [range]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchManagementDashboardData(bounds.startDate, bounds.endDate);
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          payload
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load management dashboard.',
          payload: null
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [bounds.startDate, bounds.endDate, refreshRef.current]);

  const data = state.payload?.data || {};
  const users = Array.isArray(data.users) ? data.users : [];
  const clients = Array.isArray(data.clients) ? data.clients : [];
  const tickets = Array.isArray(data.tickets) ? data.tickets : [];
  const fms = Array.isArray(data.fms) ? data.fms : [];
  const todo = Array.isArray(data.todo) ? data.todo : [];
  const attendance = Array.isArray(data.attendance) ? data.attendance : [];
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];

  useEffect(() => {
    if (!selectedUserId && users.length) {
      setSelectedUserId(users[0]['Employee ID'] || users[0].id || '');
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    if (!selectedClientId && clients.length) {
      setSelectedClientId(clients[0].Client_Id || clients[0].id || '');
    }
  }, [clients, selectedClientId]);

  const selectedUser = useMemo(
    () => users.find((row) => String(row['Employee ID'] || row.id || '').trim().toUpperCase() === String(selectedUserId || '').trim().toUpperCase()) || null,
    [users, selectedUserId]
  );

  const selectedClient = useMemo(
    () => clients.find((row) => String(row.Client_Id || row.id || '').trim().toUpperCase() === String(selectedClientId || '').trim().toUpperCase()) || null,
    [clients, selectedClientId]
  );

  const userExplorer = useMemo(() => {
    if (!selectedUser) {
      return { attendance: [], tickets: [], fms: [], todo: [] };
    }

    return {
      attendance: attendance.filter((row) => String(row['Employee ID'] || row.EmpID || '').trim().toUpperCase() === String(selectedUser['Employee ID'] || selectedUser.id || '').trim().toUpperCase()),
      tickets: tickets.filter((row) => matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name)),
      fms: fms.filter((row) => matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name)),
      todo: todo.filter((row) => matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name))
    };
  }, [attendance, tickets, fms, todo, selectedUser]);

  const clientExplorer = useMemo(() => {
    if (!selectedClient) {
      return { tasks: [], bandwidth: [], invoices: [] };
    }

    const taskRows = [...tickets, ...fms].filter((row) =>
      matchesClient(row, selectedClient.Client_Id || selectedClient.id, selectedClient['Client Name'] || selectedClient.name)
    );

    const bandwidthMap = new Map();
    taskRows.forEach((row) => {
      const owner = row.User || row['Employee Name'] || row['Employee ID'] || 'Unassigned';
      const current = bandwidthMap.get(owner) || { owner, count: 0, tat: 0 };
      current.count += 1;
      current.tat += Number(row.TAT || 0);
      bandwidthMap.set(owner, current);
    });

    return {
      tasks: taskRows,
      bandwidth: Array.from(bandwidthMap.values()),
      invoices: invoices.filter((row) => matchesClient(row, selectedClient.Client_Id || selectedClient.id, selectedClient['Client Name'] || selectedClient.name))
    };
  }, [tickets, fms, invoices, selectedClient]);

  function refresh() {
    refreshRef.current += 1;
    setState((current) => ({ ...current }));
  }

  return {
    currentUser: user || null,
    loading: state.loading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    range,
    setRange,
    rangeOptions: managementRangeOptions,
    activeTab,
    setActiveTab,
    kpis: data.kpis || {},
    users,
    clients,
    tickets,
    fms,
    todo,
    selectedUserId,
    setSelectedUserId,
    selectedUser,
    userExplorer,
    selectedClientId,
    setSelectedClientId,
    selectedClient,
    clientExplorer,
    refresh
  };
}
