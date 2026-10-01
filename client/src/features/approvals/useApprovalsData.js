import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchPendingApprovals,
  fetchTaskApproversList,
  submitApprovalAction,
  submitTicketApproval,
  transferTicketApproval
} from '@/features/approvals/api';
import { useAuth } from '@/features/auth/AuthProvider';

const DEFAULT_FILTERS = Object.freeze({
  employee: '',
  category: '',
  startDate: '',
  endDate: '',
  search: '',
  status: ''
});

const DEFAULT_PAGE_SIZE = 200;
const ATTENDANCE_PAGE_SIZE = 25;

function pageSizeForTab(tab) {
  return tab === 'attendance' ? ATTENDANCE_PAGE_SIZE : DEFAULT_PAGE_SIZE;
}

function emptyPaginationState() {
  return {
    tickets: { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, hasMore: false },
    leaves: { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, hasMore: false },
    intimations: { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, hasMore: false },
    attendance: { page: 1, pageSize: ATTENDANCE_PAGE_SIZE, total: 0, hasMore: false }
  };
}

function emptyTabFilters() {
  return {
    tickets: { ...DEFAULT_FILTERS },
    leaves: { ...DEFAULT_FILTERS },
    intimations: { ...DEFAULT_FILTERS },
    attendance: { ...DEFAULT_FILTERS }
  };
}

function normalizeCounts(payload = {}) {
  return {
    tickets: Number(payload.tickets || 0),
    leaves: Number(payload.leaves || 0),
    intimations: Number(payload.intimations || 0),
    attendance: Number(payload.attendance || 0)
  };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstAvailableTab(counts = {}) {
  return ['leaves', 'intimations', 'attendance', 'tickets'].find((tab) => Number(counts[tab] || 0) > 0) || 'leaves';
}

export function useApprovalsData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [activeTab, setActiveTab] = useState('leaves');
  const [filters, setFilters] = useState(() => emptyTabFilters());
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [approvers, setApprovers] = useState([]);
  const [counts, setCounts] = useState(() => normalizeCounts());
  const [userOptions, setUserOptions] = useState([]);
  const [ticketCategories, setTicketCategories] = useState([]);
  const [rowsState, setRowsState] = useState({
    tickets: [],
    leaves: [],
    intimations: [],
    attendance: []
  });
  const [pagination, setPagination] = useState(() => emptyPaginationState());
  const refreshRef = useRef(0);
  const loadTokenRef = useRef(0);

  useEffect(() => {
    if (!employeeId) {
      setSummaryLoading(false);
      setRowsLoading(false);
      setCounts(normalizeCounts());
      setRowsState({ tickets: [], leaves: [], intimations: [], attendance: [] });
      setPagination(emptyPaginationState());
      setUserOptions([]);
      setTicketCategories([]);
      return undefined;
    }

    let alive = true;
    async function loadSummary() {
      setSummaryLoading(true);
      setError(null);
      try {
        const payload = await fetchPendingApprovals(employeeId, { mode: 'summary' });
        if (!alive) return;
        const nextCounts = normalizeCounts(payload.counts || {});
        setCounts(nextCounts);
        setUserOptions(safeArray(payload.users).sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))));
        setTicketCategories(safeArray(payload.ticketCategories));
        setActiveTab((current) => ((nextCounts[current] || 0) > 0 ? current : firstAvailableTab(nextCounts)));
      } catch (loadError) {
        if (!alive) return;
        setError(loadError.message || 'Failed to load approvals.');
        setCounts(normalizeCounts());
        setRowsState({ tickets: [], leaves: [], intimations: [], attendance: [] });
        setPagination(emptyPaginationState());
        setUserOptions([]);
        setTicketCategories([]);
      } finally {
        if (alive) setSummaryLoading(false);
      }
    }

    loadSummary();
    return () => {
      alive = false;
    };
  }, [employeeId, refreshRef.current]);

  useEffect(() => {
    let alive = true;

    async function loadApprovers() {
      try {
        const payload = await fetchTaskApproversList();
        if (!alive) return;
        setApprovers(safeArray(payload));
      } catch {
        if (!alive) return;
        setApprovers([]);
      }
    }

    loadApprovers();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!employeeId) return undefined;

    const token = loadTokenRef.current + 1;
    loadTokenRef.current = token;
    let cancelled = false;

    async function loadRowsPage() {
      setRowsLoading(true);
      setError(null);
      setRowsState((current) => ({ ...current, [activeTab]: [] }));

      const activeFilters = filters[activeTab] || DEFAULT_FILTERS;
      const activePagination = pagination[activeTab] || emptyPaginationState()[activeTab];
      const requestedPage = Math.max(1, Number(activePagination.page || 1));
      const requestedPageSize = pageSizeForTab(activeTab);
      try {
        const payload = await fetchPendingApprovals(employeeId, {
          mode: 'rows',
          tab: activeTab,
          page: requestedPage,
          pageSize: requestedPageSize,
          filters: activeFilters
        });
        if (cancelled || loadTokenRef.current !== token) return;

        const nextRows = safeArray(payload.rows);
        if (activeTab === 'tickets' && Array.isArray(payload.ticketCategories)) {
          setTicketCategories(payload.ticketCategories);
        }
        setRowsState((current) => ({
          ...current,
          [activeTab]: nextRows
        }));
        const pageMeta = payload.pagination || {};
        setPagination((current) => ({
          ...current,
          [activeTab]: {
            page: Number(pageMeta.page || requestedPage),
            pageSize: Number(pageMeta.pageSize || requestedPageSize),
            total: Number(pageMeta.total || nextRows.length),
            hasMore: Boolean(pageMeta.hasMore)
          }
        }));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Failed to load approvals.');
          setRowsState((current) => ({ ...current, [activeTab]: [] }));
          setPagination((current) => ({
            ...current,
            [activeTab]: { ...current[activeTab], total: 0, hasMore: false }
          }));
        }
      } finally {
        if (!cancelled && loadTokenRef.current === token) {
          setRowsLoading(false);
        }
      }
    }

    loadRowsPage();
    return () => {
      cancelled = true;
    };
  }, [employeeId, activeTab, filters, pagination[activeTab]?.page]);

  function updateFilter(tab, patch) {
    setFilters((current) => ({
      ...current,
      [tab]: {
        ...current[tab],
        ...patch
      }
    }));
    setPagination((current) => ({
      ...current,
      [tab]: { ...current[tab], page: 1 }
    }));
  }

  function resetFilter(tab) {
    setFilters((current) => ({
      ...current,
      [tab]: { ...DEFAULT_FILTERS }
    }));
    setPagination((current) => ({
      ...current,
      [tab]: { ...current[tab], page: 1 }
    }));
  }

  function selectTab(tab) {
    setActiveTab(tab);
  }

  function setApprovalPage(tab, page) {
    const nextPage = Math.max(1, Number(page || 1));
    setPagination((current) => ({
      ...current,
      [tab]: { ...current[tab], page: nextPage }
    }));
  }

  function refresh() {
    refreshRef.current += 1;
    setRowsState({ tickets: [], leaves: [], intimations: [], attendance: [] });
    setPagination(emptyPaginationState());
    setSummaryLoading(true);
  }

  function rowMatchesAction(tab, row = {}, id = '') {
    const target = String(id || '').trim().toLowerCase();
    if (!target) return false;
    if (tab === 'tickets') return [row['Ticket ID'], row.ID, row.ticketId].some((value) => String(value || '').trim().toLowerCase() === target);
    if (tab === 'leaves') return [row.LeaveID, row['Leave ID'], row.ID, row.leaveId, ...(row.LeaveIDs || []), ...(row._groupedLeaveIds || [])].some((value) => String(value || '').trim().toLowerCase() === target);
    if (tab === 'intimations') return [row.IntimationID, row['Intimation ID'], row.ID, row.intimationId].some((value) => String(value || '').trim().toLowerCase() === target);
    if (tab === 'attendance') return [row.AttendanceID, row.ID, row.attendanceId, row._groupKey].some((value) => String(value || '').trim().toLowerCase() === target);
    return false;
  }

  function applyLocalAction(tab, id) {
    if (!tab || !id) return;
    setRowsState((current) => {
      const existing = safeArray(current[tab]);
      return { ...current, [tab]: existing.filter((row) => !rowMatchesAction(tab, row, id)) };
    });
    setCounts((current) => ({
      ...current,
      [tab]: Math.max(0, Number(current?.[tab] || 0) - 1)
    }));
    setPagination((current) => ({
      ...current,
      [tab]: {
        ...current[tab],
        total: Math.max(0, Number(current?.[tab]?.total || 0) - 1)
      }
    }));
  }

  async function runAction(action, successMessage, localUpdate) {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage({
        tone: result.success ? 'success' : 'danger',
        text: result.success ? successMessage : result.message
      });
      if (result.success && typeof localUpdate === 'function') localUpdate(result);
      else if (result.success) refresh();
      return result;
    } catch (actionError) {
      const result = { success: false, message: actionError.message || 'Action failed.' };
      setMessage({ tone: 'danger', text: result.message });
      return result;
    } finally {
      setSubmitting(false);
    }
  }

  function approveItem(type, id, values = {}) {
    const payload = typeof values === 'string' ? { remarks: values } : values;
    return runAction(
      () => submitApprovalAction({
        adminId: employeeId,
        type,
        id,
        action: 'Approved',
        remarks: payload.remarks || '',
        ...(payload.newPunchIn ? { newPunchIn: payload.newPunchIn } : {}),
        ...(payload.newPunchOut ? { newPunchOut: payload.newPunchOut } : {})
      }),
      `${type} approved successfully.`,
      () => {
        const tab = /leave/i.test(type) ? 'leaves' : /intimation/i.test(type) ? 'intimations' : /attendance/i.test(type) ? 'attendance' : '';
        if (tab) applyLocalAction(tab, id);
      }
    );
  }

  function rejectItem(type, id, values = {}) {
    const payload = typeof values === 'string' ? { remarks: values } : values;
    return runAction(
      () => submitApprovalAction({
        adminId: employeeId,
        type,
        id,
        action: 'Rejected',
        remarks: payload.remarks || ''
      }),
      `${type} rejected successfully.`,
      () => {
        const tab = /leave/i.test(type) ? 'leaves' : /intimation/i.test(type) ? 'intimations' : /attendance/i.test(type) ? 'attendance' : '';
        if (tab) applyLocalAction(tab, id);
      }
    );
  }

  function approveTicket(ticketId, remarks = '') {
    return runAction(
      () => submitTicketApproval(ticketId, employeeId, 'Approve', remarks),
      `Ticket ${ticketId} approved successfully.`,
      () => applyLocalAction('tickets', ticketId)
    );
  }

  function reworkTicket(ticketId, remarks = '') {
    return runAction(
      () => submitTicketApproval(ticketId, employeeId, 'Reject', remarks),
      `Ticket ${ticketId} sent for rework.`,
      () => applyLocalAction('tickets', ticketId)
    );
  }

  function moveTicketApproval(ticketId, targetManagerId, remarks = '') {
    return runAction(
      () => transferTicketApproval(ticketId, targetManagerId, employeeId, remarks),
      `Approval transferred for ${ticketId}.`,
      () => applyLocalAction('tickets', ticketId)
    );
  }

  return {
    employeeId,
    currentUser: user || null,
    activeTab,
    setActiveTab: selectTab,
    loading: summaryLoading,
    rowsLoading,
    pagination,
    setApprovalPage,
    error,
    clearError: () => setError(null),
    submitting,
    message,
    clearMessage: () => setMessage(null),
    userOptions,
    approvers,
    ticketCategories,
    counts,
    filters,
    updateFilter,
    resetFilter,
    refresh,
    filteredTickets: rowsState.tickets,
    filteredLeaves: rowsState.leaves,
    filteredIntimations: rowsState.intimations,
    filteredAttendance: rowsState.attendance,
    approveItem,
    rejectItem,
    approveTicket,
    reworkTicket,
    moveTicketApproval
  };
}
