import { useEffect, useMemo, useRef, useState } from 'react';
import {
  exportReportForWeb,
  fetchFmsReportData,
  fetchTicketReportData
} from '@/features/reports/api';
import { useAuth } from '@/features/auth/AuthProvider';

const rangeOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' }
];

const initialTicketFilters = { priority: '', user: '', status: '', search: '' };
const initialFmsFilters = { status: '', search: '' };

function toYmd(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayReference() {
  return new Date();
}

function rangeBounds(range, customStart, customEnd) {
  const now = getTodayReference();
  const current = new Date(now);
  current.setHours(12, 0, 0, 0);

  switch (range) {
    case 'today':
      return { startDate: toYmd(current), endDate: toYmd(current) };
    case 'week': {
      const day = current.getDay();
      const offset = day === 0 ? 6 : day - 1;
      const start = new Date(current);
      start.setDate(current.getDate() - offset);
      return { startDate: toYmd(start), endDate: toYmd(current) };
    }
    case 'last_week': {
      const day = current.getDay();
      const offset = day === 0 ? 6 : day - 1;
      const end = new Date(current);
      end.setDate(current.getDate() - offset - 1);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return { startDate: toYmd(start), endDate: toYmd(end) };
    }
    case 'month': {
      const start = new Date(current.getFullYear(), current.getMonth(), 1, 12);
      return { startDate: toYmd(start), endDate: toYmd(current) };
    }
    case 'last_month': {
      const start = new Date(current.getFullYear(), current.getMonth() - 1, 1, 12);
      const end = new Date(current.getFullYear(), current.getMonth(), 0, 12);
      return { startDate: toYmd(start), endDate: toYmd(end) };
    }
    case 'custom':
      return { startDate: customStart || '', endDate: customEnd || '' };
    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
}

function parseMaybeStringPayload(payload) {
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function includesText(parts, query) {
  if (!query) return true;
  const haystack = parts
    .map((part) => String(part ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
  return haystack.includes(query);
}

function mimeTypeForFormat(format) {
  if (format === 'pdf') return 'application/pdf';
  if (format === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'text/csv';
}

function extensionForFormat(format) {
  if (format === 'pdf') return 'pdf';
  if (format === 'xlsx') return 'xlsx';
  return 'csv';
}

export function useReportsData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const role = user?.Role || 'User';
  const [activeTab, setActiveTab] = useState('management');
  const [range, setRange] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [ticketFilters, setTicketFilters] = useState(initialTicketFilters);
  const [fmsFilters, setFmsFilters] = useState(initialFmsFilters);
  const [state, setState] = useState({
    loading: true,
    error: null,
    tickets: [],
    fms: []
  });
  const [message, setMessage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const refreshIndex = useRef(0);

  const bounds = useMemo(
    () => rangeBounds(range, customStart, customEnd),
    [range, customStart, customEnd]
  );

  useEffect(() => {
    if (!employeeId) {
      setState({
        loading: false,
        error: null,
        tickets: [],
        fms: []
      });
      return undefined;
    }

    let alive = true;

    async function loadReports() {
      setState((current) => ({ ...current, loading: true, error: null }));
      setMessage(null);
      try {
        const [ticketPayloadRaw, fmsPayloadRaw] = await Promise.all([
          fetchTicketReportData(employeeId, bounds.startDate, bounds.endDate),
          fetchFmsReportData(employeeId, role, bounds.startDate, bounds.endDate)
        ]);

        if (!alive) return;

        const ticketPayload = parseMaybeStringPayload(ticketPayloadRaw);
        const fmsPayload = parseMaybeStringPayload(fmsPayloadRaw);

        setState({
          loading: false,
          error: null,
          tickets: safeArray(ticketPayload?.data),
          fms: safeArray(fmsPayload?.data)
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load reports.',
          tickets: [],
          fms: []
        });
      }
    }

    loadReports();
    return () => {
      alive = false;
    };
  }, [employeeId, role, bounds.startDate, bounds.endDate, refreshIndex.current]);

  const ticketPriorities = useMemo(
    () =>
      Array.from(new Set(state.tickets.map((item) => item.Priority).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [state.tickets]
  );

  const ticketUsers = useMemo(
    () =>
      Array.from(
        new Set(state.tickets.map((item) => item['Employee Name'] || item.User).filter(Boolean))
      ).sort((left, right) => left.localeCompare(right)),
    [state.tickets]
  );

  const ticketStatuses = useMemo(
    () =>
      Array.from(new Set(state.tickets.map((item) => item.Status).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [state.tickets]
  );

  const fmsStatuses = useMemo(
    () =>
      Array.from(new Set(state.fms.map((item) => item.Status).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [state.fms]
  );

  const filteredTickets = useMemo(() => {
    const search = String(ticketFilters.search || '').trim().toLowerCase();
    return state.tickets.filter((item) => {
      const matchesPriority = !ticketFilters.priority || item.Priority === ticketFilters.priority;
      const user = item['Employee Name'] || item.User || '';
      const matchesUser = !ticketFilters.user || user === ticketFilters.user;
      const matchesStatus = !ticketFilters.status || item.Status === ticketFilters.status;
      const matchesSearch = includesText(
        [
          item['Ticket ID'],
          item.Name,
          item['Employee Name'],
          item['Task Description'],
          item.Description,
          item.Priority,
          item.Status,
          item['Task Category'] || item.Category || ''
        ],
        search
      );
      return matchesPriority && matchesUser && matchesStatus && matchesSearch;
    });
  }, [state.tickets, ticketFilters]);

  const filteredFms = useMemo(() => {
    const search = String(fmsFilters.search || '').trim().toLowerCase();
    return state.fms.filter((item) => {
      const matchesStatus = !fmsFilters.status || item.Status === fmsFilters.status;
      const matchesSearch = includesText(
        [
          item['FMS Name'],
          item.Name,
          item['Task Name'],
          item['Task Description'],
          item.Description,
          item.Who,
          item['Assigned To'],
          item.Status
        ],
        search
      );
      return matchesStatus && matchesSearch;
    });
  }, [state.fms, fmsFilters]);

  function refresh() {
    refreshIndex.current += 1;
    setState((current) => ({ ...current }));
  }

  function resetTicketFilters() {
    setTicketFilters(initialTicketFilters);
  }

  function resetFmsFilters() {
    setFmsFilters(initialFmsFilters);
  }

  async function download(format) {
    setDownloading(true);
    setMessage(null);
    try {
      const sheetName = activeTab === 'tickets' ? 'Tickets_Report' : 'FMS_Report';
      const filters = activeTab === 'tickets'
        ? { ...ticketFilters }
        : { ...fmsFilters };
      const payload = await exportReportForWeb(
        format,
        sheetName,
        employeeId,
        role,
        bounds.startDate,
        bounds.endDate,
        filters
      );

      if (!payload?.success || !payload?.base64Data) {
        throw new Error(payload?.message || 'Report export failed.');
      }

      if (typeof window !== 'undefined') {
        const link = window.document.createElement('a');
        link.href = `data:${mimeTypeForFormat(format)};base64,${payload.base64Data}`;
        link.download = payload.fileName || `worktrack-report.${extensionForFormat(format)}`;
        link.click();
      }

      setMessage({
        tone: 'success',
        text: `${activeTab === 'tickets' ? 'Ticket' : 'FMS'} report exported successfully.`
      });
      return payload;
    } catch (error) {
      const text = error.message || 'Report export failed.';
      setMessage({ tone: 'danger', text });
      return { success: false, message: text };
    } finally {
      setDownloading(false);
    }
  }

  return {
    employeeId,
    currentUser: user || null,
    role,
    activeTab,
    setActiveTab,
    range,
    setRange,
    rangeOptions,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    bounds,
    loading: state.loading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    message, clearMessage: () => setMessage(null),
    downloading,
    tickets: filteredTickets,
    ticketStatuses,
    ticketPriorities,
    ticketUsers,
    ticketFilters,
    setTicketFilters,
    resetTicketFilters,
    fms: filteredFms,
    fmsStatuses,
    fmsFilters,
    setFmsFilters,
    resetFmsFilters,
    refresh,
    download
  };
}
