export function ManagementDashboardTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'overview', label: 'Overview Dashboard' },
    { id: 'user-explorer', label: 'User Explorer' },
    { id: 'client-explorer', label: 'Client Explorer' },
    { id: 'batch-planner', label: 'Batch Planner' }
  ];

  return (
    <article className="migration-panel migration-panel--full">
      <div className="approval-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`approval-tab-btn${activeTab === tab.id ? ' approval-tab-btn--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </article>
  );
}
