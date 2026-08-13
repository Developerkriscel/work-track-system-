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

const PAGE_SIZE = 20;

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
  const refreshRef = useRef(0);
  const loadTokenRef = useRef(0);

  useEffect(() => {
    if (!employeeId) {
      setSummaryLoading(false);
      setRowsLoading(false);
      setCounts(normalizeCounts());
      setRowsState({ tickets: [], leaves: [], intimations: [], attendance: [] });
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
    if (!employeeId || summaryLoading) return undefined;

    const token = loadTokenRef.current + 1;
    loadTokenRef.current = token;
    let cancelled = false;

    async function loadRowsProgressively() {
      setRowsLoading(true);
      setError(null);
      setRowsState((current) => ({ ...current, [activeTab]: [] }));

      const activeFilters = filters[activeTab] || DEFAULT_FILTERS;
      let page = 1;
      let shouldContinue = true;

      try {
        while (!cancelled && shouldContinue) {
          const payload = await fetchPendingApprovals(employeeId, {
            mode: 'rows',
            tab: activeTab,
            page,
            pageSize: PAGE_SIZE,
            filters: activeFilters
          });
          if (cancelled || loadTokenRef.current !== token) return;

          const nextRows = safeArray(payload.rows);
          const pagination = payload.pagination || {};
          if (activeTab === 'tickets' && Array.isArray(payload.ticketCategories)) {
            setTicketCategories(payload.ticketCategories);
          }
          setRowsState((current) => ({
            ...current,
            [activeTab]: page === 1 ? nextRows : [...current[activeTab], ...nextRows]
          }));

          shouldContinue = Boolean(pagination.hasMore);
          page += 1;

          if (shouldContinue) {
            await new Promise((resolve) => {
              setTimeout(resolve, 0);
            });
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Failed to load approvals.');
          setRowsState((current) => ({ ...current, [activeTab]: [] }));
        }
      } finally {
        if (!cancelled && loadTokenRef.current === token) {
          setRowsLoading(false);
        }
      }
    }

    loadRowsProgressively();
    return () => {
      cancelled = true;
    };
  }, [employeeId, activeTab, filters, summaryLoading]);

  function updateFilter(tab, patch) {
    setFilters((current) => ({
      ...current,
      [tab]: {
        ...current[tab],
        ...patch
      }
    }));
  }

  function resetFilter(tab) {
    setFilters((current) => ({
      ...current,
      [tab]: { ...DEFAULT_FILTERS }
    }));
  }

  function refresh() {
    refreshRef.current += 1;
    setRowsState({ tickets: [], leaves: [], intimations: [], attendance: [] });
    setSummaryLoading(true);
  }

  function keepApprovedItemVisible(tab) {
    setFilters((current) => {
      if (!current?.[tab] || current[tab].status !== 'pending') return current;
      return {
        ...current,
        [tab]: {
          ...current[tab],
          status: ''
        }
      };
    });
  }

  async function runAction(action, successMessage) {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage({
        tone: result.success ? 'success' : 'danger',
        text: result.success ? successMessage : result.message
      });
      if (result.success) refresh();
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
      `${type} approved successfully.`
    ).then((result) => {
      if (result?.success) {
        const tab = /leave/i.test(type) ? 'leaves' : /intimation/i.test(type) ? 'intimations' : /attendance/i.test(type) ? 'attendance' : '';
        if (tab) keepApprovedItemVisible(tab);
      }
      return result;
    });
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
      `${type} rejected successfully.`
    ).then((result) => {
      if (result?.success) {
        const tab = /leave/i.test(type) ? 'leaves' : /intimation/i.test(type) ? 'intimations' : /attendance/i.test(type) ? 'attendance' : '';
        if (tab) keepApprovedItemVisible(tab);
      }
      return result;
    });
  }

  function approveTicket(ticketId, remarks = '') {
    return runAction(
      () => submitTicketApproval(ticketId, employeeId, 'Approve', remarks),
      `Ticket ${ticketId} approved successfully.`
    );
  }

  function reworkTicket(ticketId, remarks = '') {
    return runAction(
      () => submitTicketApproval(ticketId, employeeId, 'Reject', remarks),
      `Ticket ${ticketId} sent for rework.`
    );
  }

  function moveTicketApproval(ticketId, targetManagerId, remarks = '') {
    return runAction(
      () => transferTicketApproval(ticketId, targetManagerId, employeeId, remarks),
      `Approval transferred for ${ticketId}.`
    );
  }

  return {
    employeeId,
    currentUser: user || null,
    activeTab,
    setActiveTab,
    loading: summaryLoading,
    rowsLoading,
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
