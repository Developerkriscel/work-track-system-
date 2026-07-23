function ClientTicketModeButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      className={`approval-tab-btn${active ? ' approval-tab-btn--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function ClientTicketModeTabs({ activeMode, options, onChange }) {
  return (
    <div className="approval-tabs client-ticket-mode-tabs">
      {options.map((option) => (
        <ClientTicketModeButton
          key={option.value}
          active={option.value === activeMode}
          label={option.label}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}
