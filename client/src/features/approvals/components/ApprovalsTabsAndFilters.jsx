import { CustomSelect } from '@/components/common/CustomSelect';

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

function FilterBar({ tab, filters, userOptions, ticketCategories = [], onChange, onReset }) {
  const showCategory = tab === 'tickets';
  return (
    <div className="approval-filter-card">
      <div className="approval-filter-grid">
        <label className="dashboard-control">
          <span>Employee</span>
          <CustomSelect
            value={filters.employee}
            onChange={(val) => onChange({ employee: val })}
            options={userOptions.map((user) => ({ value: `${user.name} ${user.id}`, label: `${user.name} (${user.id})` }))}
            defaultLabel="All employees"
          />
        </label>

        {showCategory ? (
          <label className="dashboard-control">
            <span>Category</span>
            <CustomSelect
              value={filters.category}
              onChange={(val) => onChange({ category: val })}
              options={ticketCategories.map((category) => ({ value: category, label: category }))}
              defaultLabel="All categories"
            />
          </label>
        ) : null}

        <label className="dashboard-control">
          <span>Status</span>
          <CustomSelect
            value={filters.status}
            onChange={(val) => onChange({ status: val })}
            options={[
              { value: 'pending', label: 'Pending Action' },
              { value: 'approved', label: 'Approved / Closed' },
              { value: 'rejected', label: 'Rejected / Rework' }
            ]}
            defaultLabel="All Statuses"
          />
        </label>

        <label className="dashboard-control">
          <span>Start Date</span>
          <input type="date" value={filters.startDate} onChange={(event) => onChange({ startDate: event.target.value })} />
        </label>

        <label className="dashboard-control">
          <span>End Date</span>
          <input type="date" value={filters.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
        </label>

        <label className={`dashboard-control${showCategory ? '' : ' approval-filter-grid__wide'}`}>
          <span>Search</span>
          <input value={filters.search} onChange={(event) => onChange({ search: event.target.value })} placeholder="Search by description, reason, remarks..." />
        </label>
        
        <div className="approval-filter-actions" style={{ marginBottom: '2px' }}>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApprovalsTabsAndFilters({
  activeTab,
  counts,
  filters,
  userOptions,
  ticketCategories,
  onTabChange,
  onFilterChange,
  onFilterReset
}) {
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

      <FilterBar
        tab={activeTab}
        filters={filters[activeTab]}
        userOptions={userOptions}
        ticketCategories={ticketCategories}
        onChange={(patch) => onFilterChange(activeTab, patch)}
        onReset={() => onFilterReset(activeTab)}
      />
    </>
  );
}
