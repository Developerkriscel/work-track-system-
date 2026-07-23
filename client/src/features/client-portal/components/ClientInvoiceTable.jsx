import { StatusPill } from '@/components/common/StatusPill';
import { DataTableShell, useDataTableState } from '@/components/tables';
import { clientNumber } from '@/features/client-portal/services';

export function ClientInvoiceTable({ formatCurrency, formatDate, invoiceTone, loading, rows }) {
  const columns = [
    {
      key: 'invoiceId',
      label: 'Invoice ID',
      sortValue: (row) => row.InvoiceID || row['Invoice ID'] || row.ID || '',
      searchValue: (row) => row.InvoiceID || row['Invoice ID'] || row.ID || ''
    },
    {
      key: 'date',
      label: 'Date',
      sortValue: (row) => {
        const value = row.Date || row['Invoice Date'];
        const timestamp = value ? new Date(value).getTime() : 0;
        return Number.isNaN(timestamp) ? 0 : timestamp;
      },
      searchValue: (row) => formatDate(row.Date || row['Invoice Date'])
    },
    {
      key: 'amount',
      label: 'Amount',
      sortValue: (row) => clientNumber(row.Amount || row.Total || 0),
      searchValue: (row) => formatCurrency(row.Amount || row.Total || 0)
    },
    {
      key: 'outstanding',
      label: 'Due Amount',
      sortValue: (row) => clientNumber(row.Outstanding || 0),
      searchValue: (row) => formatCurrency(row.Outstanding || 0)
    },
    {
      key: 'status',
      label: 'Payment Status',
      sortValue: (row) => row.Status || '',
      searchValue: (row) => row.Status || ''
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
  } = useDataTableState(rows, columns, {
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
            <tr key={row.InvoiceID || row['Invoice ID'] || row.ID}>
              <td><span className="ticket-id-chip">{row.InvoiceID || row['Invoice ID'] || row.ID || '-'}</span></td>
              <td>{formatDate(row.Date || row['Invoice Date'])}</td>
              <td>{formatCurrency(row.Amount || row.Total || 0)}</td>
              <td>{formatCurrency(row.Outstanding || 0)}</td>
              <td><StatusPill tone={invoiceTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="dashboard-table__empty">
              {loading ? 'Refreshing invoices...' : search ? 'No matching invoices found.' : 'No invoices found for this client.'}
            </td>
          </tr>
        )}
      </tbody>
    </DataTableShell>
  );
}
