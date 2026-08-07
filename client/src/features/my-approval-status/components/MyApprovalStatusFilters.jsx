function TabButton({ active, count, onClick, children }) {
  return (
    <button
      type="button"
      className={`approval-tab-btn${active ? ' approval-tab-btn--active' : ''}`}
      onClick={onClick}
    >
      <span>{children}</span>
      <span className={`approval-tab-btn__count${count ? '' : ' approval-tab-btn__count--muted'}`}>{count}</span>
    </button>
  );
}

export function MyApprovalStatusFilters({ activeTab, counts, filters, onTabChange, onChange, onReset }) {
  return (
    <>
      <div className="approval-tabs">
        <TabButton active={activeTab === 'tickets'} count={counts.tickets} onClick={() => onTabChange('tickets')}>
          Pending Tickets
        </TabButton>
        <TabButton active={activeTab === 'leaves'} count={counts.leaves} onClick={() => onTabChange('leaves')}>
          Leave Requests
        </TabButton>
        <TabButton active={activeTab === 'intimations'} count={counts.intimations} onClick={() => onTabChange('intimations')}>
          Intimations
        </TabButton>
        <TabButton active={activeTab === 'attendance'} count={counts.attendance} onClick={() => onTabChange('attendance')}>
          Attendance
        </TabButton>
      </div>

      <div className="approval-filter-card">
        <div className="approval-filter-grid">
          <label className="dashboard-control">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => onChange({ status: event.target.value })}>
              <option value="">All Statuses</option>
              <option value="pending">Pending Action</option>
              <option value="approved">Approved / Closed</option>
              <option value="rejected">Rejected / Rework</option>
            </select>
          </label>

          <label className="dashboard-control">
            <span>Start Date</span>
            <input type="date" value={filters.startDate} onChange={(event) => onChange({ startDate: event.target.value })} />
          </label>

          <label className="dashboard-control">
            <span>End Date</span>
            <input type="date" value={filters.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
          </label>

          <label className="dashboard-control approval-filter-grid__wide">
            <span>Search</span>
            <input
              value={filters.search}
              onChange={(event) => onChange({ search: event.target.value })}
              placeholder="Search by subtype, status, reason, remarks..."
            />
          </label>

          <div className="approval-filter-actions">
            <button type="button" className="attendance-cta attendance-cta--gray" onClick={onReset}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
