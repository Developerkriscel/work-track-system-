import { useEffect, useRef, useState } from 'react';
import { AppModal, ConfirmDialog } from '@/components/modals';
import { StatusPill } from '@/components/common/StatusPill';
import { CustomSelect } from '@/components/common/CustomSelect';
import { AttendanceActionRow } from '@/features/attendance/components/AttendanceActionRow';
import { AttendanceEntryPanel } from '@/features/attendance/components/AttendanceEntryPanel';
import { AttendanceHeader } from '@/features/attendance/components/AttendanceHeader';
import { AttendanceRangeToolbar } from '@/features/attendance/components/AttendanceRangeToolbar';
import {
  AttendanceHistoryTable,
  TeamAttendanceEditDialog,
  TeamAttendanceTable
} from '@/features/attendance/components/AttendanceTables';
import { AttendanceCalendar } from '@/features/attendance/components/AttendanceCalendar';
import { AttendanceLocationPolicyCard } from '@/features/attendance/components';
import { fetchAttendanceForUser } from '@/features/attendance/api';
import { formatElapsed, todayYmd } from '@/features/attendance/services/attendancePresentation';
import { useAttendanceData, toYmd, groupAttendanceRows } from '@/features/attendance/useAttendanceData';

export function AttendancePage() {
  const today = todayYmd();
  const {
    employeeId,
    currentUser,
    canManageTeamAttendance,
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    teamFilterDate,
    setTeamFilterDate,
    attendanceLoading,
    attendanceError,
    attendanceRows,
    leaves,
    intimations,
    teamAttendanceLoading,
    teamAttendanceError,
    clearAttendanceError,
    clearTeamAttendanceError,
    teamAttendanceRows,
    teamAttendanceUsers,
    locationPolicy,
    locationPolicyLoading,
    locationPolicySaving,
    submitting,
    session,
    recordPunch,
    createLeave,
    createIntimation,
    saveTeamAttendance,
    saveLocationPolicy
  } = useAttendanceData();

  const [activeTab, setActiveTab] = useState('punch');
  const [activeView, setActiveView] = useState('self');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showLocationPolicy, setShowLocationPolicy] = useState(false);
  const [timer, setTimer] = useState('00:00:00');
  const [message, setMessage] = useState(null);
  const [submitNotice, setSubmitNotice] = useState(null);
  const [punchAction, setPunchAction] = useState(null);
  const [photoBase64, setPhotoBase64] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraCycle, setCameraCycle] = useState(0);
  const [showEarlyOutWarning, setShowEarlyOutWarning] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamCalendarUser, setTeamCalendarUser] = useState('');
  const [teamCalendarRows, setTeamCalendarRows] = useState([]);
  const [teamCalendarLoading, setTeamCalendarLoading] = useState(false);
  const [teamEditor, setTeamEditor] = useState(null);
  const [teamEditorForm, setTeamEditorForm] = useState({ punchInTime: '', punchOutTime: '' });
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Sick Leave',
    dayType: 'Full Day',
    startDate: today,
    endDate: today,
    reason: ''
  });
  const [intimationForm, setIntimationForm] = useState({
    date: today,
    type: 'Work from Home',
    reason: ''
  });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const clearMessage = () => setMessage(null);

  useEffect(() => {
    if (!teamCalendarUser) {
      setTeamCalendarRows([]);
      return undefined;
    }

    let active = true;
    async function loadTeamCalendar() {
      setTeamCalendarLoading(true);
      try {
        const date = new Date(teamFilterDate ? `${teamFilterDate}T00:00:00` : Date.now());
        const y = date.getFullYear();
        const m = date.getMonth();
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0);
        
        const startStr = toYmd(start);
        const endStr = toYmd(end);
        
        const payload = await fetchAttendanceForUser(teamCalendarUser, startStr, endStr);
        if (active && payload?.data) {
          const rawRows = payload.data || [];
          const bounds = { startDate: startStr, endDate: endStr };
          const processed = groupAttendanceRows(rawRows, bounds);
          setTeamCalendarRows(processed);
        }
      } catch (err) {
        // ignore
      }
      if (active) setTeamCalendarLoading(false);
    }
    loadTeamCalendar();
    return () => { active = false; };
  }, [teamCalendarUser, teamFilterDate]);

  useEffect(() => {
    if (!session.isPunchedIn) {
      setTimer('00:00:00');
      return undefined;
    }

    setTimer(formatElapsed(session.startedAt));
    const timerId = window.setInterval(() => {
      setTimer(formatElapsed(session.startedAt));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [session.isPunchedIn, session.startedAt]);

  useEffect(() => {
    if (!submitNotice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setSubmitNotice(null);
    }, 2400);
    return () => window.clearTimeout(timeoutId);
  }, [submitNotice]);

  useEffect(() => {
    if (!showForm || activeTab !== 'punch') return undefined;

    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch {
        setCameraReady(false);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraReady(false);
    };
  }, [showForm, activeTab, cameraCycle]);

  const visibleTeamRows = (teamAttendanceRows || []).filter((row) => {
    const query = teamSearch.trim().toLowerCase();
    const matchesDate = !teamFilterDate || row.date === teamFilterDate;
    if (!query) return matchesDate;
    const searchable = [
      row.employeeName,
      row.employeeId,
      row.role,
      row.department,
      row.date,
      row.status
    ].join(' ').toLowerCase();
    return matchesDate && searchable.includes(query);
  });

  const openForm = (tab) => {
    setActiveTab(tab);
    setShowForm(true);
    setMessage(null);
    setPunchAction(null);
    setPhotoBase64('');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotoBase64(canvas.toDataURL('image/jpeg', 0.9));
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const retakePhoto = () => {
    setPhotoBase64('');
    setMessage(null);
    setPunchAction(null);
    setCameraCycle((current) => current + 1);
  };

  const getLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Location is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
        (error) => reject(new Error(error?.code === 1
          ? 'Location permission is blocked. Allow location access to mark attendance.'
          : 'Unable to capture your live location. Please try again.')),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });

  const handlePunch = async (action) => {
    if (!photoBase64) {
      setMessage({ tone: 'danger', text: 'Capture a live photo before punching attendance.' });
      return;
    }
    
    if (action === 'Punch Out' && session?.startedAt) {
      const punchInTime = new Date(session.startedAt).getTime();
      const diffMins = (Date.now() - punchInTime) / 60000;
      if (diffMins < 8 * 60) {
        setShowEarlyOutWarning(true);
        return;
      }
    }
    
    await executePunch(action);
  };

  const executePunch = async (action) => {
    setMessage(null);
    setPunchAction({ action, stage: 'location' });
    try {
      const location = await getLocation();
      setPunchAction({ action, stage: 'submitting' });
      const result = await recordPunch(action, {
        employeeName: currentUser?.['Employee Name'] || currentUser?.Name || employeeId,
        photoBase64,
        ...location
      });
      if (result.success) {
        setPhotoBase64('');
        setShowForm(false);
        setMessage({ tone: 'success', text: result.message || `${action} recorded successfully.` });
      } else {
        setMessage({ tone: 'danger', text: result.message });
      }
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message || 'Unable to capture live location.' });
    } finally {
      setPunchAction(null);
    }
  };

  const handleLeaveSubmit = async (event) => {
    event.preventDefault();
    const result = await createLeave(leaveForm);
    if (result.success) {
      setMessage(null);
      setSubmitNotice({
        title: 'Leave Submitted',
        text: 'Leave submitted successfully.',
        tone: 'success'
      });
      setLeaveForm((current) => ({ ...current, reason: '', startDate: current.startDate, endDate: current.endDate }));
    } else {
      setSubmitNotice({
        title: 'Leave Submission Failed',
        text: result.message || 'Leave could not be submitted.',
        tone: 'danger'
      });
    }
  };

  const handleIntimationSubmit = async (event) => {
    event.preventDefault();
    const result = await createIntimation(intimationForm);
    if (result.success) {
      setMessage(null);
      setSubmitNotice({
        title: 'Intimation Submitted',
        text: 'Intimation submitted successfully.',
        tone: 'success'
      });
      setIntimationForm((current) => ({ ...current, reason: '', date: today }));
    } else {
      setSubmitNotice({
        title: 'Intimation Submission Failed',
        text: result.message || 'Intimation could not be submitted.',
        tone: 'danger'
      });
    }
  };

  const openTeamEditor = (row) => {
    const currentPunchIn =
      row?.punchInTime ||
      row?.punchIn?.Time ||
      row?.punchIn?.['Punch In'] ||
      '';
    const currentPunchOut =
      row?.punchOutTime ||
      row?.punchOut?.Time ||
      row?.punchOut?.['Punch Out'] ||
      '';

    setTeamEditor(row);
    setTeamEditorForm({
      punchInTime: currentPunchIn,
      punchOutTime: currentPunchOut
    });
    setMessage(null);
  };

  const handleTeamAttendanceSave = async () => {
    if (!teamEditor) return;
    const result = await saveTeamAttendance({
      employeeId: teamEditor.employeeId,
      date: teamEditor.date,
      punchInTime: teamEditorForm.punchInTime,
      punchOutTime: teamEditorForm.punchOutTime
    });
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? (result.message || 'Attendance updated.') : result.message
    });
    if (result.success) {
      setTeamEditor(null);
    }
  };

  return (
    <section className="page-card attendance-page">
      <AttendanceHeader
        title="Attendance & Activity Log"
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
        isPunchedIn={session.isPunchedIn}
        timer={timer}
        actions={
          <AttendanceActionRow
            onOpenForm={openForm}
            canManageTeamAttendance={canManageTeamAttendance}
            onOpenLocationPolicy={() => setShowLocationPolicy(true)}
          />
        }
      />

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>{message.tone === 'danger' ? 'Issue' : 'Done'}</StatusPill>
          <span>{message.text}</span>
          <button type="button" className="dashboard-banner__close" onClick={clearMessage}>OK</button>
        </div>
      ) : null}

      {showLocationPolicy ? (
        <AppModal
          title="Attendance Location Policy"
          onClose={() => setShowLocationPolicy(false)}
          width="840px"
        >
          <AttendanceLocationPolicyCard
            policy={locationPolicy}
            canEdit={canManageTeamAttendance}
            loading={locationPolicyLoading}
            saving={locationPolicySaving}
            onSave={async (payload) => {
              const result = await saveLocationPolicy(payload);
              setMessage({
                tone: result.success ? 'success' : 'danger',
                text: result.success ? (result.message || 'Attendance policy saved.') : result.message
              });
              if (result.success) {
                setShowLocationPolicy(false);
              }
            }}
          />
        </AppModal>
      ) : null}

      {submitNotice ? (
        <AppModal
          title={submitNotice.title}
          onClose={() => setSubmitNotice(null)}
          width="420px"
        >
          <div className={`attendance-submit-notice attendance-submit-notice--${submitNotice.tone}`}>
            <p>{submitNotice.text}</p>
            <button type="button" className="attendance-cta attendance-cta--blue" onClick={() => setSubmitNotice(null)}>
              OK
            </button>
          </div>
        </AppModal>
      ) : null}

      {showEarlyOutWarning && (
        <ConfirmDialog
          title="Early Punch Out"
          message="You are punching out before completing 8 hours. This will be marked as a Half Day. Do you want to proceed?"
          confirmLabel="Yes, Punch Out"
          cancelLabel="Cancel"
          onConfirm={() => {
            setShowEarlyOutWarning(false);
            executePunch('Punch Out');
          }}
          onCancel={() => setShowEarlyOutWarning(false)}
        />
      )}

      <AttendanceEntryPanel
        activeTab={activeTab}
        showForm={showForm}
        isPunchedIn={session.isPunchedIn}
        cameraReady={cameraReady}
        videoRef={videoRef}
        canvasRef={canvasRef}
        photoBase64={photoBase64}
        leaveForm={leaveForm}
        intimationForm={intimationForm}
        submitting={submitting}
        punchAction={punchAction}
        onClose={() => setShowForm(false)}
        onTabChange={setActiveTab}
        onCapturePhoto={capturePhoto}
        onRetakePhoto={retakePhoto}
        onPunch={handlePunch}
        onLeaveFormChange={(field, value) => setLeaveForm((current) => (
          field === 'dayType' && /half\s*day/i.test(value)
            ? { ...current, dayType: value, endDate: current.startDate }
            : { ...current, [field]: value }
        ))}
        onIntimationFormChange={(field, value) => setIntimationForm((current) => ({ ...current, [field]: value }))}
        onLeaveSubmit={handleLeaveSubmit}
        onIntimationSubmit={handleIntimationSubmit}
      />

      <AttendanceRangeToolbar
        activeView={activeView}
        canManageTeamAttendance={canManageTeamAttendance}
        onViewChange={setActiveView}
      />

      {activeView === 'self' ? (
        <>
          {attendanceError ? <div className="dashboard-banner dashboard-banner--error"><span>{attendanceError}</span><button type="button" className="dashboard-banner__close" onClick={clearAttendanceError}>OK</button></div> : null}
          <article className="migration-panel migration-panel--full" style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <div className="migration-panel__row attendance-log-header">
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Attendance Log</h2>
                <StatusPill tone={attendanceLoading ? 'neutral' : 'info'}>
                  {attendanceLoading ? 'Refreshing' : `${attendanceRows?.length || 0} records found`}
                </StatusPill>
              </div>
              
              <div className="dashboard-controls" style={{ gap: '12px', alignItems: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCalendar(!showCalendar)}
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    border: '1px solid #cbd5e1', 
                    backgroundColor: showCalendar ? '#eff6ff' : '#ffffff', 
                    color: showCalendar ? '#3b82f6' : '#64748b',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  title="Toggle Calendar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
                </button>
                <label className="dashboard-control">
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Date Range</span>
                  <select 
                    value={range} 
                    onChange={(event) => setRange(event.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '500' }}
                  >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="all">All History</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                {range === 'custom' ? (
                  <>
                    <label className="dashboard-control">
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Start Date</span>
                      <input 
                        type="date" 
                        value={customStart} 
                        onChange={(event) => setCustomStart(event.target.value)} 
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '500' }}
                      />
                    </label>
                    <label className="dashboard-control">
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>End Date</span>
                      <input 
                        type="date" 
                        value={customEnd} 
                        onChange={(event) => setCustomEnd(event.target.value)} 
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '500' }}
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>

            <AttendanceHistoryTable rows={attendanceRows || []} />

            {showCalendar && (
              <div style={{ marginTop: '24px' }}>
                <AttendanceCalendar rows={attendanceRows || []} />
              </div>
            )}
          </article>
        </>
      ) : (
        <>
          {teamAttendanceError ? <div className="dashboard-banner dashboard-banner--error"><span>{teamAttendanceError}</span><button type="button" className="dashboard-banner__close" onClick={clearTeamAttendanceError}>OK</button></div> : null}
          <article className="migration-panel migration-panel--full">
            <div className="migration-panel__row">
              <h2>My Team Attendance</h2>
              <StatusPill tone={teamAttendanceLoading ? 'neutral' : 'info'}>
                {teamAttendanceLoading ? 'Refreshing' : `${visibleTeamRows.length} rows`}
              </StatusPill>
            </div>
            <div className="attendance-team-toolbar">
              <label className="dashboard-control attendance-team-toolbar__search">
                <span>Search Employee</span>
                <input
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  placeholder="Search by employee, ID, role, department..."
                />
              </label>
              <label className="dashboard-control attendance-team-toolbar__date">
                <span>Attendance Date</span>
                <input
                  type="date"
                  value={teamFilterDate}
                  onChange={(event) => setTeamFilterDate(event.target.value || today)}
                />
              </label>
              <label className="dashboard-control attendance-team-toolbar__search">
                <span>View Employee Calendar</span>
                <CustomSelect
                  value={teamCalendarUser}
                  onChange={setTeamCalendarUser}
                  defaultLabel="-- Select Employee --"
                  options={(teamAttendanceUsers || []).map((u) => ({
                    value: u.id,
                    label: `${u.name} (${u.id})`
                  }))}
                />
              </label>
            </div>
            {teamCalendarUser && (
              <div style={{ marginBottom: '24px' }}>
                {teamCalendarLoading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontWeight: '500' }}>Loading Calendar...</div>
                ) : (
                  <AttendanceCalendar rows={teamCalendarRows} />
                )}
              </div>
            )}
            <TeamAttendanceTable rows={visibleTeamRows} onEdit={openTeamEditor} />
          </article>
        </>
      )}

      <TeamAttendanceEditDialog
        row={teamEditor}
        form={teamEditorForm}
        saving={submitting}
        onChange={(field, value) => setTeamEditorForm((current) => ({ ...current, [field]: value }))}
        onClose={() => setTeamEditor(null)}
        onSubmit={handleTeamAttendanceSave}
      />
    </section>
  );
}
