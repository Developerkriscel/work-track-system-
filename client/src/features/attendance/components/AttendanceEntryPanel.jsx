export function AttendanceEntryPanel({
  showForm,
  isPunchedIn,
  cameraReady,
  videoRef,
  canvasRef,
  photoBase64,
  submitting,
  punchAction,
  onClose,
  onCapturePhoto,
  onRetakePhoto,
  onPunch,
}) {
  if (!showForm) return null;

  const punchInBusy = punchAction?.action === 'Punch In';
  const punchOutBusy = punchAction?.action === 'Punch Out';
  const punchBusyText = punchAction?.stage === 'location' ? 'Getting location...' : 'Submitting...';

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <div>
          <h2>New Attendance Entry</h2>
          <p className="attendance-entry-panel__subtitle">Capture a live photo, location, and submit punch in or punch out.</p>
        </div>
        <button type="button" className="inline-action inline-action--ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="attendance-punch-pane attendance-entry-panel__pane">
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
    </article>
  );
}
