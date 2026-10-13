import React, { useState } from 'react';

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function CreateAssetModal({ isOpen, onClose, onSubmit, submitting, loading }) {
  const isBusy = Boolean(submitting || loading);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('IT Hardware');
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [condition, setCondition] = useState('New');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (typeof onSubmit === 'function') {
      onSubmit({
        name: name.trim(),
        category,
        brand: brand.trim(),
        modelNumber: modelNumber.trim(),
        serialNumber: serialNumber.trim(),
        purchaseCost: Number(purchaseCost) || 0,
        purchaseDate,
        warrantyExpiry,
        condition
      });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Register New Asset
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Asset Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                required
                placeholder="e.g. MacBook Pro M2 14-inch / Dell Latitude 3420"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Category <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="IT Hardware">IT Hardware (Laptops, Desktops)</option>
                <option value="Peripherals">Peripherals (Monitors, Keyboards)</option>
                <option value="Mobile & SIM">Mobile & SIM Cards</option>
                <option value="Office Equipment">Office Equipment (Printers, UPS)</option>
                <option value="Furniture">Furniture</option>
                <option value="Software License">Software License / Keys</option>
              </select>
            </div>

            <div className="form-group">
              <label>Brand / Manufacturer</label>
              <input
                type="text"
                placeholder="e.g. Apple, Dell, Lenovo, HP"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Model Number</label>
              <input
                type="text"
                placeholder="e.g. Latitude 3420 / A2779"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Serial Number (Unique)</label>
              <input
                type="text"
                placeholder="e.g. C02XYZ123456"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Purchase Cost (₹)</label>
              <input
                type="number"
                placeholder="e.g. 65000"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Warranty Expiry</label>
              <input
                type="date"
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Initial Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="New">Brand New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isBusy}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={isBusy || !name.trim()}>
              {isBusy ? 'Registering...' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AssignAssetModal({ isOpen, asset, employees = [], onClose, onSubmit, submitting, loading }) {
  const isBusy = Boolean(submitting || loading);
  const [employeeId, setEmployeeId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  if (!isOpen || !asset) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!employeeId) return;
    if (typeof onSubmit === 'function') {
      onSubmit({
        assetId: asset.AssetID || asset['Asset ID'],
        employeeId,
        remarks,
        expectedReturnDate
      });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Assign Asset to Employee
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="asset-brief-box">
            <span className="brief-label">Asset:</span>
            <strong>{asset['Asset Name']}</strong>
            <span className="brief-serial">({asset['Serial Number'] || asset.AssetID})</span>
          </div>

          <div className="form-group">
            <label>Select Active Employee <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">-- Choose Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id}) {emp.department ? `- ${emp.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Expected Return Date (Optional)</label>
            <input
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Handover Remarks / Notes</label>
            <textarea
              rows="3"
              placeholder="e.g. Handed over with charger, bag, and mouse. Screen in mint condition."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isBusy}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={isBusy || !employeeId}>
              {isBusy ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReturnAssetModal({ isOpen, asset, onClose, onSubmit, submitting, loading }) {
  const isBusy = Boolean(submitting || loading);
  const [returnCondition, setReturnCondition] = useState('Good');
  const [remarks, setRemarks] = useState('');

  if (!isOpen || !asset) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeof onSubmit === 'function') {
      onSubmit({
        assetId: asset.AssetID || asset['Asset ID'],
        returnCondition,
        remarks
      });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
            Return Asset to Inventory
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="asset-brief-box">
            <span className="brief-label">Returning Asset:</span>
            <strong>{asset['Asset Name']}</strong>
            <span className="brief-serial">from {asset['Assigned To Name'] || 'Employee'}</span>
          </div>

          <div className="form-group">
            <label>Physical Condition on Return <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value)}
            >
              <option value="Good">Good / Fully Intact</option>
              <option value="Fair">Fair / Normal Wear</option>
              <option value="Damaged">Damaged / Requires Repair (Status will be set to In Repair)</option>
              <option value="Scrapped">Scrapped / Non-functional</option>
            </select>
          </div>

          <div className="form-group">
            <label>Inspection Remarks</label>
            <textarea
              rows="3"
              placeholder="e.g. Received all cables and original packaging. Checked working."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isBusy}>
              Cancel
            </button>
            <button type="submit" className="btn-submit btn-submit-return" disabled={isBusy}>
              {isBusy ? 'Returning...' : 'Accept Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RequestAssetModal({ isOpen, onClose, onSubmit, submitting, loading }) {
  const isBusy = Boolean(submitting || loading);
  const [assetName, setAssetName] = useState('');
  const [category, setCategory] = useState('IT Hardware');
  const [urgency, setUrgency] = useState('Normal');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!assetName.trim()) return;
    if (typeof onSubmit === 'function') {
      onSubmit({
        assetName: assetName.trim(),
        category,
        urgency,
        reason: reason.trim()
      });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Submit Asset Requisition
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>
              What asset / equipment do you need? <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Secondary Monitor (24-inch) / Replacement Keyboard"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="IT Hardware">IT Hardware (Laptop / Desktop)</option>
                <option value="Peripherals">Peripherals (Monitor, Mouse, Keyboard)</option>
                <option value="Mobile & SIM">Mobile Phone / SIM Card</option>
                <option value="Office Equipment">Office Equipment</option>
                <option value="Software License">Software License / Tool Key</option>
              </select>
            </div>

            <div className="form-group">
              <label>Urgency Level</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value="Low">Low (Can wait 2-3 weeks)</option>
                <option value="Normal">Normal (Within 1 week)</option>
                <option value="High">High (Urgent - Work blocked)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              Reason / Business Justification <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows="3"
              required
              placeholder="Describe why you need this asset and how it helps your daily work..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isBusy}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={isBusy || !assetName.trim()}>
              {isBusy ? 'Submitting...' : 'Send Request to HR / Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ShowAssetModal({ isOpen, asset, onClose, onAssign, onReturn, canManage }) {
  if (!isOpen || !asset) return null;

  const id = asset.AssetID || asset['Asset ID'] || 'N/A';
  const name = asset['Asset Name'] || 'Asset Details';
  const category = asset.Category || 'IT Hardware';
  const brand = asset.Brand || '';
  const modelNumber = asset['Model Number'] || '';
  const serial = asset['Serial Number'] || '—';
  const status = asset.Status || 'Available';
  const condition = asset.Condition || 'Good';
  const purchaseCost = asset['Purchase Cost'] ? `₹${Number(asset['Purchase Cost']).toLocaleString('en-IN')}` : '—';
  const purchaseDate = asset['Purchase Date'] || '—';
  const warrantyExpiry = asset['Warranty Expiry'] || '—';
  const assignedTo = asset['Assigned To Name'] || '';
  const assignedToId = asset['Assigned To ID'] || '';
  const assignedDate = asset['Assigned Date'] || '';
  const assignedBy = asset['Assigned By'] || 'HR / Admin';
  const expectedReturn = asset['Expected Return Date'] || '';
  const handoverRemarks = asset['Handover Remarks'] || '';
  const history = Array.isArray(asset.History) ? asset.History : [];

  const isAssigned = String(status).toLowerCase() === 'assigned';
  const isAvailable = String(status).toLowerCase() === 'available';

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card-details">
        <div className="modal-header">
          <div className="modal-header-with-status">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              {name}
            </h3>
            <span className={`status-pill pill-${status.toLowerCase().replace(/\s+/g, '-')}`}>
              <span className="status-dot"></span>
              {status}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-form modal-details-body">
          {/* Quick Highlight Header */}
          <div className="asset-details-banner">
            <div className="banner-item">
              <span className="banner-label">Asset ID</span>
              <span className="banner-value id-code">{id}</span>
            </div>
            <div className="banner-item">
              <span className="banner-label">Category</span>
              <span className="banner-value">{category}</span>
            </div>
            <div className="banner-item">
              <span className="banner-label">Brand & Model</span>
              <span className="banner-value">{brand || '—'} {modelNumber ? `(${modelNumber})` : ''}</span>
            </div>
            <div className="banner-item">
              <span className="banner-label">Serial Number</span>
              <span className="banner-value serial-chip">{serial}</span>
            </div>
          </div>

          {/* Allocation Section if Assigned */}
          {isAssigned && (
            <div className="asset-details-section">
              <div className="section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Current Allocation Details
              </div>
              <div className="asset-details-grid-box">
                <div className="detail-item">
                  <span className="label">Assigned To</span>
                  <span className="value strong-val">{assignedTo} {assignedToId ? `(${assignedToId})` : ''}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Assigned On</span>
                  <span className="value">{assignedDate || 'Recent'}</span>
                </div>
                <div className="detail-item full-span">
                  <span className="label">Assigned By (HR / Admin)</span>
                  <span className="value highlight-assigner">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                    </svg>
                    {assignedBy}
                  </span>
                </div>
                {expectedReturn && (
                  <div className="detail-item">
                    <span className="label">Expected Return</span>
                    <span className="value">{expectedReturn}</span>
                  </div>
                )}
                {handoverRemarks && (
                  <div className="detail-item full-span">
                    <span className="label">Handover Remarks</span>
                    <span className="value remarks-quote">"{handoverRemarks}"</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hardware & Purchase Specs */}
          <div className="asset-details-section">
            <div className="section-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Specifications & Procurement
            </div>
            <div className="asset-details-grid-box">
              <div className="detail-item">
                <span className="label">Condition</span>
                <span className="value"><span className={`condition-tag cond-${condition.toLowerCase()}`}>{condition}</span></span>
              </div>
              <div className="detail-item">
                <span className="label">Purchase Cost</span>
                <span className="value">{purchaseCost}</span>
              </div>
              <div className="detail-item">
                <span className="label">Purchase Date</span>
                <span className="value">{purchaseDate}</span>
              </div>
              <div className="detail-item">
                <span className="label">Warranty Expiry</span>
                <span className="value">{warrantyExpiry}</span>
              </div>
            </div>
          </div>

          {/* Activity History Timeline */}
          {history.length > 0 && (
            <div className="asset-details-section">
              <div className="section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Lifecycle History ({history.length})
              </div>
              <div className="timeline-container">
                {history.map((h, idx) => (
                  <div key={idx} className="timeline-entry">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div className="timeline-top">
                        <strong className="timeline-action">{h.action}</strong>
                        <span className="timeline-date">{h.assignedDate || (h.timestamp ? h.timestamp.slice(0, 10) : '')}</span>
                      </div>
                      <div className="timeline-meta">
                        {h.employeeName && <span>To: <strong>{h.employeeName} ({h.employeeId})</strong></span>}
                        {h.assignedBy && <span className="meta-assigner">• By: {h.assignedBy}</span>}
                        {h.returnCondition && <span className="meta-condition">• Cond: {h.returnCondition}</span>}
                      </div>
                      {h.remarks && <p className="timeline-remarks">"{h.remarks}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '8px' }}>
            {canManage && isAvailable && onAssign && (
              <button
                type="button"
                className="btn-submit"
                onClick={() => {
                  onClose();
                  onAssign(asset);
                }}
              >
                Assign Asset
              </button>
            )}
            {canManage && isAssigned && onReturn && (
              <button
                type="button"
                className="btn-submit btn-submit-return"
                onClick={() => {
                  onClose();
                  onReturn(asset);
                }}
              >
                Accept Return
              </button>
            )}
            <button type="button" className="btn-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
