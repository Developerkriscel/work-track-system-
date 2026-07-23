function SortGlyph({ active, direction }) {
  return (
    <span className={`react-data-table__sort${active ? ' react-data-table__sort--active' : ''}`}>
      <span>{direction === 'asc' && active ? '▲' : '△'}</span>
      <span>{direction === 'desc' && active ? '▼' : '▽'}</span>
    </span>
  );
}

export function DataTableShell({
  children,
  columns,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  pageInfo,
  pageSize,
  search,
  sortDirection,
  sortKey,
  toggleSort
}) {
  return (
    <div className="react-data-table">
      <div className="react-data-table__toolbar">
        <label className="react-data-table__length">
          <span>Show</span>
          <select value={pageSize} onChange={(event) => onPageSizeChange(event.target.value)}>
            {[10, 25, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span>entries</span>
        </label>

        <label className="react-data-table__search">
          <span>Search:</span>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search records..." />
        </label>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table client-ticket-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.headerClassName || ''}>
                  {column.sortable === false ? (
                    <span className="react-data-table__header-label">{column.label}</span>
                  ) : (
                    <button type="button" className="react-data-table__sort-btn" onClick={() => toggleSort(column.key)}>
                      <span className="react-data-table__header-label">{column.label}</span>
                      <SortGlyph active={sortKey === column.key} direction={sortDirection} />
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {children}
        </table>
      </div>

      <div className="react-data-table__footer">
        <div className="react-data-table__info">
          Showing {pageInfo.start} to {pageInfo.end} of {pageInfo.total} entries
        </div>

        <div className="react-data-table__pager">
          <button type="button" onClick={() => onPageChange(1)} disabled={pageInfo.page === 1}>
            «
          </button>
          <button type="button" onClick={() => onPageChange(pageInfo.page - 1)} disabled={pageInfo.page === 1}>
            ‹
          </button>
          <button type="button" className="react-data-table__pager-current" disabled>
            {pageInfo.page}
          </button>
          <button type="button" onClick={() => onPageChange(pageInfo.page + 1)} disabled={pageInfo.page === pageInfo.totalPages}>
            ›
          </button>
          <button type="button" onClick={() => onPageChange(pageInfo.totalPages)} disabled={pageInfo.page === pageInfo.totalPages}>
            »
          </button>
        </div>
      </div>
    </div>
  );
}
