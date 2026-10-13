import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchManagementDashboardData } from '@/features/management-dashboard/api';
import {
  managementRangeBounds,
  managementRangeOptions
} from '@/features/management-dashboard/services/managementDashboardPresentation';

function matchesUser(task, userId, userName) {
  if (!task) return false;
  const normalizedId = String(userId || '').trim().toUpperCase();
  const normalizedName = String(userName || '').trim().toLowerCase();
  const ownerId = String(task['Employee ID'] || task.EmpID || task.empId || task['User ID'] || task.employeeId || task['Employee Id'] || task.id || '').trim().toUpperCase();
  const ownerName = String(task.User || task['Employee Name'] || task.Who || task.Name || task.name || task['Assigned To'] || '').trim().toLowerCase();
  if (normalizedId && ownerId && normalizedId === ownerId) return true;
  if (normalizedName && ownerName) {
    if (normalizedName === ownerName) return true;
    if (normalizedName.length >= 3 && ownerName.length >= 3 && (normalizedName.includes(ownerName) || ownerName.includes(normalizedName))) return true;
  }
  return false;
}

function matchesClient(task, clientId, clientName) {
  if (!task) return false;
  const normalizedId = String(clientId || '').trim().toUpperCase();
  const normalizedName = String(clientName || '').trim().toLowerCase();
  const rowId = String(task.Client_Id || task['Client ID'] || task.CustomerID || '').trim().toUpperCase();
  const rowName = String(task.Client || task['Client Name'] || task.CustomerName || '').trim().toLowerCase();
  if (normalizedId && rowId && normalizedId === rowId) return true;
  if (normalizedName && rowName) {
    if (normalizedName === rowName) return true;
    if (normalizedName.length >= 3 && rowName.length >= 3 && (normalizedName.includes(rowName) || rowName.includes(normalizedName))) return true;
  }
  return false;
}

export function useManagementDashboardData() {
  const { user } = useAuth();
  const [range, setRange] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  const [overviewState, setOverviewState] = useState({
    loading: true,
    error: null,
    payload: null
  });
  const [explorerState, setExplorerState] = useState({
    loading: false,
    error: null,
    payload: null,
    key: ''
  });
  const refreshRef = useRef(0);

  const bounds = useMemo(() => managementRangeBounds(range, customStart, customEnd), [range, customStart, customEnd]);
  const rangeKey = `${bounds.startDate || ''}:${bounds.endDate || ''}`;

  useEffect(() => {
    let alive = true;

    async function load() {
      setOverviewState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchManagementDashboardData(bounds.startDate, bounds.endDate, 'overview');
        if (!alive) return;
        setOverviewState({
          loading: false,
          error: null,
          payload
        });
      } catch (error) {
        if (!alive) return;
        setOverviewState({
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

  const needsUserExplorer = activeTab === 'user-explorer' && Boolean(selectedUserId);
  const needsClientExplorer = activeTab === 'client-explorer' && Boolean(selectedClientId);

  useEffect(() => {
    const explorerKey = needsUserExplorer
      ? `user:${selectedUserId}:${rangeKey}`
      : needsClientExplorer
        ? `client:${selectedClientId}:${rangeKey}`
        : '';

    if (!explorerKey) return undefined;
    if (explorerState.key === explorerKey && explorerState.payload && !explorerState.error) {
      return undefined;
    }

    let alive = true;

    async function loadExplorer() {
      setExplorerState((current) => ({
        ...current,
        loading: true,
        error: null
      }));

      try {
        const payload = needsUserExplorer
          ? await fetchManagementDashboardData(bounds.startDate, bounds.endDate, 'user-explorer', { selectedUserId })
          : await fetchManagementDashboardData(bounds.startDate, bounds.endDate, 'client-explorer', { selectedClientId });
        if (!alive) return;
        setExplorerState({
          loading: false,
          error: null,
          payload,
          key: explorerKey
        });
      } catch (error) {
        if (!alive) return;
        setExplorerState({
          loading: false,
          error: error.message || 'Failed to load management explorer data.',
          payload: null,
          key: explorerKey
        });
      }
    }

    loadExplorer();
    return () => {
      alive = false;
    };
  }, [needsUserExplorer, needsClientExplorer, selectedUserId, selectedClientId, bounds.startDate, bounds.endDate, rangeKey, explorerState.key, explorerState.payload, explorerState.error]);

  const overviewData = overviewState.payload?.data || {};
  const explorerData = explorerState.payload?.data || {};
  const sourceData = (needsUserExplorer || needsClientExplorer) && explorerState.payload ? explorerData : overviewData;

  const users = Array.isArray(sourceData.users) ? sourceData.users : [];
  const clients = Array.isArray(sourceData.clients) ? sourceData.clients : [];
  const tickets = Array.isArray(sourceData.tickets) ? sourceData.tickets : [];
  const fms = Array.isArray(sourceData.fms) ? sourceData.fms : [];
  const todo = Array.isArray(sourceData.todo) ? sourceData.todo : [];
  const attendance = Array.isArray(sourceData.attendance) ? sourceData.attendance : [];
  const invoices = Array.isArray(sourceData.invoices) ? sourceData.invoices : [];
  const charts = overviewData.charts || sourceData.charts || {};

  const leaves = Array.isArray(sourceData.leaves) ? sourceData.leaves : [];
  const intimations = Array.isArray(sourceData.intimations) ? sourceData.intimations : [];

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

  const selectedUser = useMemo(() => {
    if (selectedUserId === 'ALL_USERS') {
      return {
        'Employee ID': 'ALL_USERS',
        'Employee Name': 'All Employees / Users',
        name: 'All Employees / Users',
        id: 'ALL_USERS'
      };
    }
    return (
      users.find(
        (row) =>
          String(row['Employee ID'] || row.id || '').trim().toUpperCase() ===
          String(selectedUserId || '').trim().toUpperCase()
      ) || null
    );
  }, [users, selectedUserId]);

  const selectedClient = useMemo(
    () => clients.find((row) => String(row.Client_Id || row.id || '').trim().toUpperCase() === String(selectedClientId || '').trim().toUpperCase()) || null,
    [clients, selectedClientId]
  );

  const userExplorer = useMemo(() => {
    if (!selectedUser) {
      return { attendance: [], tickets: [], fms: [], todo: [], leaves: [], intimations: [], startDate: bounds.startDate, endDate: bounds.endDate };
    }

    const isAllUsers = selectedUserId === 'ALL_USERS';

    return {
      attendance: isAllUsers
        ? attendance
        : attendance.filter((row) =>
            matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name)
          ),
      tickets: isAllUsers
        ? tickets
        : tickets.filter((row) =>
            matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name)
          ),
      fms: isAllUsers
        ? fms
        : fms.filter((row) =>
            matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name)
          ),
      todo: isAllUsers
        ? todo
        : todo.filter((row) =>
            matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name)
          ),
      leaves: isAllUsers
        ? leaves
        : leaves.filter((row) =>
            matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name)
          ),
      intimations: isAllUsers
        ? intimations
        : intimations.filter((row) =>
            matchesUser(row, selectedUser['Employee ID'] || selectedUser.id, selectedUser['Employee Name'] || selectedUser.name)
          ),
      startDate: bounds.startDate,
      endDate: bounds.endDate
    };
  }, [attendance, tickets, fms, todo, leaves, intimations, selectedUser, selectedUserId, bounds.startDate, bounds.endDate]);

  const clientExplorer = useMemo(() => {
    if (!selectedClient) {
      return { tasks: [], bandwidth: [], invoices: [], startDate: bounds.startDate, endDate: bounds.endDate };
    }

    const taskRows = [...tickets, ...fms, ...todo].filter((row) =>
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
      invoices: invoices.filter((row) => matchesClient(row, selectedClient.Client_Id || selectedClient.id, selectedClient['Client Name'] || selectedClient.name)),
      startDate: bounds.startDate,
      endDate: bounds.endDate
    };
  }, [tickets, fms, todo, invoices, selectedClient, bounds.startDate, bounds.endDate]);

  function refresh() {
    refreshRef.current += 1;
    setOverviewState((current) => ({ ...current }));
    setExplorerState({
      loading: false,
      error: null,
      payload: null,
      key: ''
    });
  }

  const loading = (needsUserExplorer || needsClientExplorer) ? (overviewState.loading || explorerState.loading) : overviewState.loading;
  const error = explorerState.error || overviewState.error;

  return {
    currentUser: user || null,
    loading,
    error,
    clearError: () => {
      setOverviewState((current) => ({ ...current, error: null }));
      setExplorerState((current) => ({ ...current, error: null }));
    },
    range,
    setRange,
    rangeOptions: managementRangeOptions,
    activeTab,
    setActiveTab,
    kpis: sourceData.kpis || overviewData.kpis || {},
    charts,
    users,
    clients,
    tickets,
    fms,
    todo,
    invoices,
    attendance,
    selectedUserId,
    setSelectedUserId,
    selectedUser,
    userExplorer,
    selectedClientId,
    setSelectedClientId,
    selectedClient,
    clientExplorer,
    refresh,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd
  };
}
