import React, { useState } from 'react';

export function AssetRequestsTable({ requests = [], canManage = false, onApproveRequest, onOpenRequest }) {
  const [activeActionId, setActiveActionId] = useState(null);
  const [remarksInput, setRemarksInput] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const handleStartDecision = (id, action) => {
    setActiveActionId(id);
    setPendingAction(action);
    setRemarksInput('');
  };

  const handleConfirmDecision = (id) => {
    if (!pendingAction) return;
    onApproveRequest(id, pendingAction, remarksInput);
    setActiveActionId(null);
    setRemarksInput('');
    setPendingAction('');
  };

  const handleCancelDecision = () => {
    setActiveActionId(null);
    setRemarksInput('');
    setPendingAction('');
  };

  return (
    <div className="assets-table-container">
      <div className="table-header-bar">
        <h3 className="table-header-title">
          {canManage ? 'Asset Requisitions & Approvals' : 'My Asset Requests'}
        </h3>
        <button className="btn-primary-action" onClick={onOpenRequest}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Asset Request
        </button>
      </div>

      <div className="table-responsive-wrapper">
        <table className="assets-data-table">
          <thead>
            <tr>
              <th>Request ID & Date</th>
              <th>Employee</th>
              <th>Requested Asset</th>
              <th>Reason & Purpose</th>
              <th>Urgency</th>
              <th>Status</th>
              {canManage && <th style={{ textAlign: 'right' }}>Review Decision</th>}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="assets-empty-cell">
                  <div className="modern-empty-state">
                    <div className="empty-icon-circle">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                    <div className="empty-title">No Asset Requests</div>
                    <p className="empty-desc">There are no pending or past asset requests to display.</p>
                    <button className="btn-secondary-action" onClick={onOpenRequest} style={{ marginTop: '12px' }}>
                      Create First Request
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              requests.map((r) => {
                const id = r.RequestID || r['Request ID'] || r.id;
                const empName = r['Employee Name'] || 'Employee';
                const empId = r['Employee ID'] || '';
                const assetName = r['Asset Name'] || r.assetName || '';
                const category = r.Category || 'Hardware';
                const reason = r.Reason || 'No reason provided';
                const urgency = r.Urgency || 'Normal';
                const status = r.Status || 'Pending';
                const date = r['Requested Date'] || (r['Created At'] ? r['Created At'].slice(0, 10) : 'Recent');
                const adminRemarks = r['Admin Remarks'] || '';

                const isPending = status.toLowerCase() === 'pending';
                const isApproved = status.toLowerCase() === 'approved';

                return (
                  <tr key={id}>
                    <td>
                      <div className="asset-primary-cell">
                        <span className="asset-cell-id">{id}</span>
                        <span className="cell-sub-meta">{date}</span>
                      </div>
                    </td>
                    <td>
                      <div className="employee-cell">
                        <span className="assigned-name">{empName}</span>
                        <span className="cell-sub-meta">{empId}</span>
                      </div>
                    </td>
                    <td>
                      <div className="asset-sub-cell">
                        <span className="asset-cell-name">{assetName}</span>
                        <span className="asset-category-pill">{category}</span>
                      </div>
                    </td>
                    <td>
                      <div className="reason-cell">
                        <p className="reason-text">{reason}</p>
                        {adminRemarks && <span className="admin-remarks-tag">Admin Note: {adminRemarks}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`urgency-pill urgency-${urgency.toLowerCase()}`}>
                        {urgency}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill pill-${status.toLowerCase()}`}>
                        <span className="status-dot"></span>
                        {status}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        {isPending ? (
                          activeActionId === id ? (
                            <div className="decision-popover">
                              <input
                                type="text"
                                className="remarks-quick-input"
                                placeholder={`Remarks for ${pendingAction}...`}
                                value={remarksInput}
                                onChange={(e) => setRemarksInput(e.target.value)}
                                autoFocus
                              />
                              <div className="decision-popover-actions">
                                <button
                                  className={`btn-confirm-${pendingAction.toLowerCase()}`}
                                  onClick={() => handleConfirmDecision(id)}
                                >
                                  Confirm {pendingAction}
                                </button>
                                <button className="btn-cancel-text" onClick={handleCancelDecision}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="action-buttons-group">
                              <button
                                className="btn-pill-approve"
                                onClick={() => handleStartDecision(id, 'Approved')}
                                title="Approve Request"
                              >
                                Approve
                              </button>
                              <button
                                className="btn-pill-reject"
                                onClick={() => handleStartDecision(id, 'Rejected')}
                                title="Reject Request"
                              >
                                Reject
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="decision-final-text">
                            {isApproved ? 'Approved' : 'Closed'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
