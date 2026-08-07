export function ManagementDashboardTabs({ activeTab, onTabChange, children = null }) {
  const tabs = [
    { id: 'overview', label: 'Overview Dashboard' },
    { id: 'user-explorer', label: 'User Explorer' },
    { id: 'client-explorer', label: 'Client Explorer' },
    { id: 'batch-planner', label: 'Batch Planner' }
  ];

  return (
    <div className="migration-panel__row" style={{ margin: '8px 0 24px', borderBottom: 'none', paddingBottom: 0 }}>
      <div className="reports-sub-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`reports-sub-tab-btn${activeTab === tab.id ? ' reports-sub-tab-btn--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
