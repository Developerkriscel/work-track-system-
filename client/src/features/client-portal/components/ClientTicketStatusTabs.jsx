function ClientTicketStatusButton({ active, count, label, onClick }) {
  return (
    <button
      type="button"
      className={`approval-tab-btn${active ? ' approval-tab-btn--active' : ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <span className={`approval-tab-btn__count${count ? '' : ' approval-tab-btn__count--muted'}`}>{count}</span>
    </button>
  );
}

export function ClientTicketStatusTabs({ activeTab, counts, options, onChange }) {
  return (
    <div className="approval-tabs client-ticket-status-tabs">
      {options.map((option) => (
        <ClientTicketStatusButton
          key={option.value}
          active={option.value === activeTab}
          count={counts[option.value] || 0}
          label={option.label}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}
