import { useEffect, useRef, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { AttendanceActionRow } from '@/features/attendance/components/AttendanceActionRow';
import { AttendanceEntryPanel } from '@/features/attendance/components/AttendanceEntryPanel';
import { AttendanceHeader } from '@/features/attendance/components/AttendanceHeader';
import { AttendanceRangeToolbar } from '@/features/attendance/components/AttendanceRangeToolbar';
import { AttendanceSummaryStats } from '@/features/attendance/components/AttendanceSummaryStats';
import { AttendanceHistoryTable } from '@/features/attendance/components/AttendanceTables';
import { formatElapsed, todayYmd } from '@/features/attendance/services/attendancePresentation';
import { useAttendanceData } from '@/features/attendance/useAttendanceData';

export function AttendancePage() {
  const today = todayYmd();
  const {
    employeeId,
    currentUser,
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    attendanceLoading,
    attendanceError,
    attendanceRows,
    submitting,
    session,
    recordPunch,
    createLeave,
    createIntimation
  } = useAttendanceData();

  const [activeTab, setActiveTab] = useState('punch');
  const [showForm, setShowForm] = useState(false);
  const [timer, setTimer] = useState('00:00:00');
  const [message, setMessage] = useState(null);
  const [photoBase64, setPhotoBase64] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraCycle, setCameraCycle] = useState(0);
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

  const todayRowsCount = attendanceRows.length;
  const openForm = (tab) => {
    setActiveTab(tab);
    setShowForm(true);
    setMessage(null);
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
    setMessage({ tone: 'success', text: 'Photo captured. You can punch now.' });
  };

  const retakePhoto = () => {
    setPhotoBase64('');
    setMessage(null);
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
    setMessage(null);
    try {
      const location = await getLocation();
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
    }
  };

  const handleLeaveSubmit = async (event) => {
    event.preventDefault();
    const result = await createLeave(leaveForm);
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? 'Leave request submitted.' : result.message
    });
    if (result.success) {
      setLeaveForm((current) => ({ ...current, reason: '' }));
    }
  };

  const handleIntimationSubmit = async (event) => {
    event.preventDefault();
    const result = await createIntimation(intimationForm);
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? 'Intimation submitted.' : result.message
    });
    if (result.success) {
      setIntimationForm((current) => ({ ...current, reason: '' }));
    }
  };

  return (
    <section className="page-card attendance-page">
      <AttendanceHeader
        title="Attendance & Activity Log"
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
        isPunchedIn={session.isPunchedIn}
        timer={timer}
        actions={<AttendanceActionRow onOpenForm={openForm} />}
      />

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>{message.tone === 'danger' ? 'Issue' : 'Done'}</StatusPill>
          <span>{message.text}</span>
        </div>
      ) : null}

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
        range={range}
        customStart={customStart}
        customEnd={customEnd}
        onRangeChange={setRange}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />



      {attendanceError ? <div className="dashboard-banner dashboard-banner--error">{attendanceError}</div> : null}
      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>Attendance Log</h2>
          <StatusPill tone={attendanceLoading ? 'neutral' : 'info'}>
            {attendanceLoading ? 'Refreshing' : `${attendanceRows.length} rows`}
          </StatusPill>
        </div>
        <AttendanceHistoryTable rows={attendanceRows} />
      </article>

    </section>
  );
}
