export function ClientTicketRangeFilter({
  range,
  onRangeChange,
  rangeOptions,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange
}) {
  return (
    <div className="dashboard-controls client-ticket-range">
      <label className="dashboard-control">
        <span>Date Range</span>
        <select value={range} onChange={(event) => onRangeChange(event.target.value)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {range === 'custom' ? (
        <>
          <label className="dashboard-control">
            <span>Start Date</span>
            <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
          </label>
          <label className="dashboard-control">
            <span>End Date</span>
            <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
          </label>
        </>
      ) : null}
    </div>
  );
}
