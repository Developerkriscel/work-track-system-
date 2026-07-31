export function AttendanceEntryPanel({
  activeTab,
  showForm,
  isPunchedIn,
  cameraReady,
  videoRef,
  canvasRef,
  photoBase64,
  leaveForm,
  intimationForm,
  submitting,
  punchAction,
  onClose,
  onTabChange,
  onCapturePhoto,
  onRetakePhoto,
  onPunch,
  onLeaveFormChange,
  onIntimationFormChange,
  onLeaveSubmit,
  onIntimationSubmit
}) {
  if (!showForm) return null;

  const punchInBusy = punchAction?.action === 'Punch In';
  const punchOutBusy = punchAction?.action === 'Punch Out';
  const punchBusyText = punchAction?.stage === 'location' ? 'Getting location...' : 'Submitting...';

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>New Attendance Entry</h2>
        <button type="button" className="inline-action inline-action--ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="attendance-tabs">
        {['punch', 'leave', 'intimation'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`attendance-tab${activeTab === tab ? ' attendance-tab--active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {tab === 'punch' ? 'Attendance Punch' : tab === 'leave' ? 'Leave Request' : 'Work Intimation'}
          </button>
        ))}
      </div>

      {activeTab === 'punch' ? (
        <div className="attendance-punch-pane">
          <div className="attendance-camera-card" data-captured={photoBase64 ? 'true' : 'false'}>
            {photoBase64 ? (
              <img src={photoBase64} alt="Captured attendance" className="attendance-camera attendance-captured-photo" />
            ) : (
              <video ref={videoRef} className="attendance-camera" autoPlay playsInline muted />
            )}
            <canvas ref={canvasRef} className="attendance-capture-canvas" aria-hidden="true" />
            {!cameraReady && !photoBase64 ? <div className="attendance-camera__fallback">Camera access not available yet.</div> : null}
          </div>

          <div className="attendance-punch-actions">
            <button
              type="button"
              className={`attendance-cta attendance-cta--purple${photoBase64 ? ' attendance-cta--hidden' : ''}`}
              disabled={!cameraReady || submitting || Boolean(photoBase64) || Boolean(punchAction)}
              onClick={onCapturePhoto}
            >
              Capture
            </button>
            {photoBase64 ? (
              <button type="button" className="attendance-cta attendance-cta--gray" disabled={submitting || Boolean(punchAction)} onClick={onRetakePhoto}>
                Retake
              </button>
            ) : null}
            <button
              type="button"
              className={`attendance-cta attendance-cta--green${punchInBusy ? ' attendance-cta--busy' : ''}`}
              disabled={submitting || !photoBase64 || isPunchedIn || Boolean(punchAction)}
              onClick={() => onPunch('Punch In')}
            >
              {punchInBusy ? punchBusyText : 'Punch In'}
            </button>
            <button
              type="button"
              className={`attendance-cta attendance-cta--red${punchOutBusy ? ' attendance-cta--busy' : ''}`}
              disabled={submitting || !photoBase64 || !isPunchedIn || Boolean(punchAction)}
              onClick={() => onPunch('Punch Out')}
            >
              {punchOutBusy ? punchBusyText : 'Punch Out'}
            </button>
            <button
              type="button"
              className="attendance-cta attendance-cta--gray"
              disabled={submitting || Boolean(punchAction)}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'leave' ? (
        <form className="attendance-form-grid" onSubmit={onLeaveSubmit}>
          <label className="dashboard-control">
            <span>Leave Type</span>
            <select value={leaveForm.leaveType} onChange={(event) => onLeaveFormChange('leaveType', event.target.value)}>
              <option>Sick Leave</option>
              <option>Casual Leave</option>
              <option>Leave Without Pay (LWP)</option>
            </select>
          </label>
          <label className="dashboard-control">
            <span>Day Type</span>
            <select value={leaveForm.dayType} onChange={(event) => onLeaveFormChange('dayType', event.target.value)}>
              <option>Full Day</option>
              <option>Half Day - First Half</option>
              <option>Half Day - Second Half</option>
            </select>
          </label>
          <label className="dashboard-control">
            <span>Start Date</span>
            <input type="date" value={leaveForm.startDate} onChange={(event) => onLeaveFormChange('startDate', event.target.value)} />
          </label>
          <label className={`dashboard-control${/half\s*day/i.test(leaveForm.dayType) ? ' attendance-field--hidden' : ''}`}>
            <span>End Date</span>
            <input type="date" required={!/half\s*day/i.test(leaveForm.dayType)} value={leaveForm.endDate} onChange={(event) => onLeaveFormChange('endDate', event.target.value)} />
          </label>
          <label className="dashboard-control attendance-form-grid__full">
            <span>Reason</span>
            <textarea required value={leaveForm.reason} onChange={(event) => onLeaveFormChange('reason', event.target.value)} rows="4" />
          </label>
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={submitting}>
            Submit Leave Request
          </button>
        </form>
      ) : null}

      {activeTab === 'intimation' ? (
        <form className="attendance-form-grid" onSubmit={onIntimationSubmit}>
          <label className="dashboard-control">
            <span>Date</span>
            <input type="date" required value={intimationForm.date} onChange={(event) => onIntimationFormChange('date', event.target.value)} />
          </label>
          <label className="dashboard-control">
            <span>Intimation Type</span>
            <select value={intimationForm.type} onChange={(event) => onIntimationFormChange('type', event.target.value)}>
              <option>Work from Home</option>
              <option>On-site Client Visit</option>
              <option>Late Arrival</option>
              <option>Early Departure</option>
            </select>
          </label>
          <label className="dashboard-control attendance-form-grid__full">
            <span>Reason / Details</span>
            <textarea required value={intimationForm.reason} onChange={(event) => onIntimationFormChange('reason', event.target.value)} rows="4" />
          </label>
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={submitting}>
            Submit Intimation
          </button>
        </form>
      ) : null}
    </article>
  );
}
