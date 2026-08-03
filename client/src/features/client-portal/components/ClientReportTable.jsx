import { StatusPill } from '@/components/common/StatusPill';
import { DataTableShell, useDataTableState } from '@/components/tables';

export function ClientReportTable({ details, formatDate, loading, reportTypeTone }) {
  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortValue: (row) => row.ID || '',
      searchValue: (row) => row.ID || ''
    },
    {
      key: 'type',
      label: 'Type',
      sortValue: (row) => row.TaskType || '',
      searchValue: (row) => row.TaskType || ''
    },
    {
      key: 'description',
      label: 'Description',
      sortValue: (row) => row.Description || '',
      searchValue: (row) => row.Description || ''
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (row) => row.Status || '',
      searchValue: (row) => row.Status || ''
    },
    {
      key: 'date',
      label: 'Date',
      sortValue: (row) => {
        const value = row.Date;
        const timestamp = value ? new Date(value).getTime() : 0;
        return Number.isNaN(timestamp) ? 0 : timestamp;
      },
      searchValue: (row) => formatDate(row.Date)
    }
  ];

  const {
    pageInfo,
    pageSize,
    search,
    setPage,
    setPageSize,
    setSearch,
    sortDirection,
    sortKey,
    toggleSort,
    visibleRows
  } = useDataTableState(details, columns, {
    initialSortKey: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10
  });

  return (
    <DataTableShell
      columns={columns}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onSearchChange={setSearch}
      pageInfo={pageInfo}
      pageSize={pageSize}
      search={search}
      sortDirection={sortDirection}
      sortKey={sortKey}
      toggleSort={toggleSort}
    >
      <tbody>
        {visibleRows.length ? (
          visibleRows.map((row) => (
            <tr key={`${row.TaskType}-${row.ID}`}>
              <td data-label="ID"><span className="ticket-id-chip">{row.ID || '-'}</span></td>
              <td data-label="Type"><StatusPill tone={reportTypeTone(row.TaskType)}>{row.TaskType || '-'}</StatusPill></td>
              <td data-label="Description" className="approval-table__copy">{row.Description || '-'}</td>
              <td data-label="Status">{row.Status || '-'}</td>
              <td data-label="Date">{formatDate(row.Date)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="dashboard-table__empty">
              {loading ? 'Refreshing reports...' : search ? 'No matching report rows found.' : 'No report details found for this client.'}
            </td>
          </tr>
        )}
      </tbody>
    </DataTableShell>
  );
}
