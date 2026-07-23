const INVOICE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'paid', label: 'Fully Paid' },
  { value: 'cancelled', label: 'Cancelled' }
];

export function ClientInvoiceStatusTabs({ activeTab, counts, onChange }) {
  return (
    <div className="approval-tabs client-ticket-status-tabs">
      {INVOICE_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`approval-tab-btn${activeTab === tab.value ? ' approval-tab-btn--active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          <span>{tab.label}</span>
          <span className={`approval-tab-btn__count${counts[tab.value] ? '' : ' approval-tab-btn__count--muted'}`}>
            {counts[tab.value] || 0}
          </span>
        </button>
      ))}
    </div>
  );
}
