export function FmsHeader({ currentUser, employeeId, canCreateFms, isSuperAdmin, onCreate, onSync, submitting }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">FMS Workspace</p>
        <h1 className="page-card__title page-card__title--dashboard">FMS Tracker</h1>
      </div>
      <div className="dashboard-controls mobile-header-controls">
        <div className="page-card__status">
          {(currentUser?.['Employee Name'] || currentUser?.Name || 'Employee')} {employeeId ? `| ${employeeId}` : ''}
        </div>
        {canCreateFms ? (
          <>
            {isSuperAdmin && (
              <button
                type="button"
                className="fms-header-btn"
                onClick={onSync}
                disabled={submitting}
                style={{
                  marginRight: '12px',
                  padding: '8px 20px',
                  borderRadius: '999px',
                  background: '#fff',
                  color: '#6941C6',
                  border: '1.5px solid #6941C6',
                  fontWeight: '600',
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {submitting ? 'FETCHING...' : 'FETCH DATA'}
              </button>
            )}
            <button type="button" className="attendance-cta attendance-cta--purple fms-header-btn" onClick={onCreate}>
              Add FMS
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
