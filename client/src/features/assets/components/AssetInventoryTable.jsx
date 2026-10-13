import React from 'react';

export function AssetInventoryTable({
  assets = [],
  filters,
  canManage,
  onOpenCreate,
  onOpenAssign,
  onOpenReturn,
  onOpenShow
}) {
  const { search, setSearch, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter } = filters;

  const categories = ['All', 'IT Hardware', 'Peripherals', 'Mobile & SIM', 'Office Equipment', 'Furniture', 'Software License'];
  const statuses = ['All', 'Available', 'Assigned', 'In Repair', 'Damaged', 'Scrapped'];

  const handleExportCsv = () => {
    if (!assets.length) return;
    const headers = ['Asset ID', 'Asset Name', 'Category', 'Brand', 'Serial Number', 'Status', 'Condition', 'Assigned To ID', 'Assigned To Name', 'Assigned Date', 'Purchase Cost'];
    const rows = assets.map((a) => [
      a.AssetID || a['Asset ID'] || '',
      `"${(a['Asset Name'] || '').replace(/"/g, '""')}"`,
      `"${(a.Category || '').replace(/"/g, '""')}"`,
      `"${(a.Brand || '').replace(/"/g, '""')}"`,
      `"${(a['Serial Number'] || '').replace(/"/g, '""')}"`,
      a.Status || '',
      a.Condition || '',
      a['Assigned To ID'] || '',
      `"${(a['Assigned To Name'] || '').replace(/"/g, '""')}"`,
      a['Assigned Date'] || '',
      a['Purchase Cost'] || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Asset_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="assets-table-container">
      {/* Table Toolbar */}
      <div className="assets-toolbar">
        <div className="assets-search-box">
          <svg className="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search assets by name, ID, serial, or employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        <div className="assets-filter-group">
          <select
            className="assets-select-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>

          <select
            className="assets-select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                Status: {s}
              </option>
            ))}
          </select>

          <button className="btn-secondary-action" onClick={handleExportCsv} title="Export to CSV">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-responsive-wrapper">
        <table className="assets-data-table">
          <thead>
            <tr>
              <th>Asset Info</th>
              <th>Category & Brand</th>
              <th>Serial Number</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Condition</th>
              {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="assets-empty-cell">
                  <div className="modern-empty-state">
                    <div className="empty-icon-circle">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    </div>
                    <div className="empty-title">No Assets Found</div>
                    <p className="empty-desc">
                      {search || categoryFilter !== 'All' || statusFilter !== 'All'
                        ? 'Try adjusting your search terms or filters.'
                        : 'No assets have been recorded in the company inventory yet.'}
                    </p>
                    {canManage && (
                      <button className="btn-secondary-action" onClick={onOpenCreate} style={{ marginTop: '12px' }}>
                        Add First Asset
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              assets.map((asset) => {
                const id = asset.AssetID || asset['Asset ID'] || 'N/A';
                const name = asset['Asset Name'] || 'Unnamed Asset';
                const category = asset.Category || 'IT Hardware';
                const brand = asset.Brand || asset['Model Number'] || '';
                const serial = asset['Serial Number'] || '—';
                const status = asset.Status || 'Available';
                const assignedTo = asset['Assigned To Name'] || '';
                const assignedId = asset['Assigned To ID'] || '';
                const assignedDate = asset['Assigned Date'] || '';
                const condition = asset.Condition || 'Good';

                const isAssigned = status.toLowerCase() === 'assigned';
                const isAvailable = status.toLowerCase() === 'available';

                return (
                  <tr key={id}>
                    <td>
                      <div className="asset-primary-cell">
                        <span className="asset-cell-name">{name}</span>
                        <span className="asset-cell-id">{id}</span>
                      </div>
                    </td>
                    <td>
                      <div className="asset-sub-cell">
                        <span className="asset-category-pill">{category}</span>
                        {brand && <span className="cell-sub-meta">{brand}</span>}
                      </div>
                    </td>
                    <td>
                      <code className="asset-serial-code">{serial}</code>
                    </td>
                    <td>
                      <span className={`status-pill pill-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                        <span className="status-dot"></span>
                        {status}
                      </span>
                    </td>
                    <td>
                      {isAssigned && assignedTo ? (
                        <div className="employee-cell">
                          <span className="assigned-name">{assignedTo}</span>
                          <span className="cell-sub-meta">
                            {assignedId} {assignedDate ? `• ${assignedDate}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-unassigned">— In Stock</span>
                      )}
                    </td>
                    <td>
                      <span className="condition-indicator">{condition}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons-group">
                          <button
                            className="btn-pill-action-show"
                            onClick={() => onOpenShow && onOpenShow(asset)}
                            title="View Asset Details"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Show
                          </button>
                          {isAvailable && (
                            <button
                              className="btn-pill-action-assign"
                              onClick={() => onOpenAssign(asset)}
                            >
                              Assign
                            </button>
                          )}
                          {isAssigned && (
                            <button
                              className="btn-pill-action-return"
                              onClick={() => onOpenReturn(asset)}
                            >
                              Return
                            </button>
                          )}
                        </div>
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
