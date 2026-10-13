import React from 'react';

function getCategoryIcon(category = '') {
  const cat = String(category).toLowerCase();
  if (cat.includes('laptop') || cat.includes('hardware') || cat.includes('desktop')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="12" rx="2" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    );
  }
  if (cat.includes('peripheral') || cat.includes('monitor') || cat.includes('screen') || cat.includes('mouse') || cat.includes('keyboard')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }
  if (cat.includes('mobile') || cat.includes('phone') || cat.includes('sim')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function MyAssetsSection({ assets = [], onOpenRequest, onOpenShow }) {
  return (
    <div className="assets-table-container">
      <div className="table-header-bar">
        <div className="my-assets-header-info">
          <h3 className="table-header-title">My Assigned Assets</h3>
          <span className="my-assets-count-tag">{assets.length} {assets.length === 1 ? 'Asset' : 'Assets'} Allocated</span>
        </div>
        <button className="btn-primary-action" onClick={onOpenRequest}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Request New Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="modern-empty-state" style={{ padding: '56px 24px' }}>
          <div className="empty-icon-circle">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="empty-title">No Assets Allocated</div>
          <p className="empty-desc">You currently do not have any company hardware or devices issued to your account.</p>
          <button className="btn-secondary-action" onClick={onOpenRequest} style={{ marginTop: '14px' }}>
            Request an Asset
          </button>
        </div>
      ) : (
        <div className="my-assets-cards-grid">
          {assets.map((asset) => {
            const id = asset.AssetID || asset['Asset ID'] || 'N/A';
            const name = asset['Asset Name'] || 'Assigned Asset';
            const category = asset.Category || 'IT Hardware';
            const brand = asset.Brand || '';
            const modelNumber = asset['Model Number'] || '';
            const serial = asset['Serial Number'] || '—';
            const assignedDate = asset['Assigned Date'] || (asset['Created At'] ? asset['Created At'].slice(0, 10) : 'Recent');
            const condition = asset.Condition || 'Good';
            
            // Extract Assigned By and Handover Remarks
            const history = Array.isArray(asset.History) ? asset.History : [];
            const latestAssign = history.slice().reverse().find((h) => h.action === 'Assigned' || h.assignedBy) || {};
            const assignedBy = asset['Assigned By'] || latestAssign.assignedBy || asset['Created By'] || 'HR / Admin';
            const handoverRemarks = asset['Handover Remarks'] || latestAssign.remarks || '';
            const expectedReturn = asset['Expected Return Date'] || latestAssign.expectedReturnDate || '';

            return (
              <div key={id} className="my-asset-card modern-elevated">
                {/* Top Badge Bar */}
                <div className="my-asset-card-top">
                  <div className="my-asset-cat-wrapper">
                    <span className="my-asset-cat-icon">
                      {getCategoryIcon(category)}
                    </span>
                    <span className="asset-category-pill">{category}</span>
                  </div>
                  <span className="status-pill pill-assigned">
                    <span className="status-dot"></span>
                    Allocated
                  </span>
                </div>

                {/* Asset Title & Subtitle */}
                <div className="my-asset-header-content">
                  <h4 className="my-asset-title">{name}</h4>
                  <p className="my-asset-brand">
                    {brand && <span>{brand}</span>}
                    {brand && modelNumber && <span className="meta-sep">•</span>}
                    {modelNumber && <span className="my-asset-model">Mod: {modelNumber}</span>}
                    {!brand && !modelNumber && <span>Standard Company Device</span>}
                  </p>
                </div>

                {/* Structured Metadata Grid */}
                <div className="my-asset-details-grid">
                  <div className="detail-grid-item">
                    <span className="detail-label">Asset ID</span>
                    <span className="detail-val asset-id-badge">{id}</span>
                  </div>

                  <div className="detail-grid-item">
                    <span className="detail-label">Serial Number</span>
                    <code className="detail-val serial-code">{serial}</code>
                  </div>

                  <div className="detail-grid-item">
                    <span className="detail-label">Assigned Date</span>
                    <span className="detail-val">{assignedDate}</span>
                  </div>

                  <div className="detail-grid-item">
                    <span className="detail-label">Assigned By</span>
                    <span className="detail-val detail-assigned-by">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {assignedBy}
                    </span>
                  </div>

                  <div className="detail-grid-item">
                    <span className="detail-label">Condition</span>
                    <span className="detail-val">
                      <span className={`condition-tag cond-${condition.toLowerCase()}`}>
                        {condition}
                      </span>
                    </span>
                  </div>

                  <div className="detail-grid-item">
                    <span className="detail-label">Return / Validity</span>
                    <span className="detail-val validity-val">
                      {expectedReturn ? expectedReturn : 'Permanent Issue'}
                    </span>
                  </div>
                </div>

                {/* Handover Remarks Notes */}
                {handoverRemarks && (
                  <div className="my-asset-remarks-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <div className="remarks-body">
                      <span className="remarks-label">Handover Note:</span> {handoverRemarks}
                    </div>
                  </div>
                )}

                {/* Bottom Card Action */}
                <div className="my-asset-card-footer">
                  {onOpenShow && (
                    <button
                      className="my-asset-card-action-btn show-btn"
                      onClick={() => onOpenShow(asset)}
                      title="View all specifications and details"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Show
                    </button>
                  )}
                  <button
                    className="my-asset-card-action-btn"
                    onClick={onOpenRequest}
                    title="Need help, replacement, or peripheral for this device?"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Report Issue
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
