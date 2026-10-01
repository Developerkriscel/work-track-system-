import { useEffect, useMemo, useRef, useState } from 'react';
import {
  exportReportForWeb,
  fetchFmsReportData,
  fetchTicketReportData,
  fetchAttendanceReportData
} from '@/features/reports/api';
import { useAuth } from '@/features/auth/AuthProvider';

// Removed rangeBounds and rangeOptions as user requested direct Start/End dates

const initialTicketFilters = { priority: '', user: '', status: '', search: '' };
const initialFmsFilters = { status: '', search: '' };

function toYmd(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const normalizedRole = String(role || '').trim().toLowerCase();
  const isManagerOnly = normalizedRole === 'manager';
  const [activeTab, setActiveTab] = useState(isManagerOnly ? 'tickets' : 'management');
  
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    return toYmd(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [customEnd, setCustomEnd] = useState(() => toYmd(new Date()));
  const [ticketFilters, setTicketFilters] = useState(initialTicketFilters);
  const [fmsFilters, setFmsFilters] = useState(initialFmsFilters);
  const [attendanceFilters, setAttendanceFilters] = useState({ employees: [] }); // array of employee IDs
  const [state, setState] = useState({
    loading: true,
    error: null,
    tickets: [],
    fms: [],
    attendance: [],
    attendanceUsers: []
  });
  const [message, setMessage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const refreshIndex = useRef(0);

  useEffect(() => {
    if (isManagerOnly && activeTab === 'management') {
      setActiveTab('tickets');
    }
  }, [activeTab, isManagerOnly]);

  const bounds = useMemo(
    () => ({ startDate: customStart || '', endDate: customEnd || '' }),
    [customStart, customEnd]
  );

  useEffect(() => {
    if (!employeeId) {
      setState({
        loading: false,
        error: null,
        tickets: [],
        fms: [],
        attendance: [],
        attendanceUsers: []
      });
      return undefined;
    }

    let alive = true;

    if (!isManagerOnly && activeTab === 'management') {
      setState({
        loading: false,
        error: null,
        tickets: [],
        fms: [],
        attendance: [],
        attendanceUsers: []
      });
      return undefined;
    }

    async function loadReports() {
      setState((current) => ({ ...current, loading: true, error: null }));
      setMessage(null);
      try {
        const [ticketPayloadRaw, fmsPayloadRaw, attendancePayloadRaw] = await Promise.all([
          fetchTicketReportData(employeeId, bounds.startDate, bounds.endDate),
          fetchFmsReportData(employeeId, role, bounds.startDate, bounds.endDate),
          fetchAttendanceReportData(bounds.startDate, bounds.endDate)
        ]);

        if (!alive) return;

        const ticketPayload = parseMaybeStringPayload(ticketPayloadRaw);
        const fmsPayload = parseMaybeStringPayload(fmsPayloadRaw);
        const attendancePayload = parseMaybeStringPayload(attendancePayloadRaw);

        setState({
          loading: false,
          error: null,
          tickets: safeArray(ticketPayload?.data),
          fms: safeArray(fmsPayload?.data),
          attendance: safeArray(attendancePayload?.data),
          attendanceUsers: safeArray(attendancePayload?.users)
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load reports.',
          tickets: [],
          fms: [],
          attendance: [],
          attendanceUsers: []
        });
      }
    }

    loadReports();
    return () => {
      alive = false;
    };
  }, [employeeId, role, activeTab, isManagerOnly, bounds.startDate, bounds.endDate, refreshIndex.current]);

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

  const filteredAttendance = useMemo(() => {
    return state.attendance.filter((item) => {
      // If no employees selected, show all available to the reviewer
      if (!attendanceFilters.employees || attendanceFilters.employees.length === 0) return true;
      return attendanceFilters.employees.includes(item.employeeId);
    });
  }, [state.attendance, attendanceFilters]);

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

  function resetAttendanceFilters() {
    setAttendanceFilters({ employees: [] });
  }

  async function download(format) {
    setDownloading(true);
    setMessage(null);
    try {
      let sheetName = 'Report';
      let filters = {};

      if (activeTab === 'tickets') {
        sheetName = 'Tickets_Report';
        filters = { ...ticketFilters };
      } else if (activeTab === 'fms') {
        sheetName = 'FMS_Report';
        filters = { ...fmsFilters };
      } else if (activeTab === 'attendance') {
        sheetName = 'Attendance_Report';
        filters = { ...attendanceFilters };
      }

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
        const binaryString = window.atob(payload.base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeTypeForFormat(format) });
        const url = URL.createObjectURL(blob);
        
        const link = window.document.createElement('a');
        link.href = url;
        link.download = payload.fileName || `worktrack-report.${extensionForFormat(format)}`;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }

      const reportName = activeTab === 'tickets' ? 'Ticket' : activeTab === 'fms' ? 'FMS' : 'Attendance';
      setMessage({
        tone: 'success',
        text: `${reportName} report exported successfully.`
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
    isManagerOnly,
    activeTab,
    setActiveTab,
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
    attendance: filteredAttendance,
    attendanceUsers: state.attendanceUsers,
    attendanceFilters,
    setAttendanceFilters,
    resetAttendanceFilters,
    refresh,
    download
  };
}
