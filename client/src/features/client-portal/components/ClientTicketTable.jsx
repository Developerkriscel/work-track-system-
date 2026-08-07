import { CheckIcon, CircleCheckBig, MessageCircle, ReplyArrow, Undo2, Wrench } from '@/components/common/icons';
import { StatusPill } from '@/components/common/StatusPill';
import { DataTableShell, useDataTableState } from '@/components/tables';

function ActionIcon({ action }) {
  const className = 'client-ticket-table__action-icon';
  if (action === 'approve') return <CheckIcon className={className} />;
  if (action === 'reopen') return <Undo2 className={className} />;
  if (action === 'respond') return <ReplyArrow className={className} />;
  if (action === 'chat') return <MessageCircle className={className} />;
  if (action === 'closed') return <CircleCheckBig className={`${className} client-ticket-table__action-icon--closed`} />;
  return <Wrench className={`${className} client-ticket-table__action-icon--muted`} />;
}

function actionButtonClass(action) {
  if (action === 'approve') return 'client-ticket-table__icon-btn client-ticket-table__icon-btn--approve';
  if (action === 'reopen') return 'client-ticket-table__icon-btn client-ticket-table__icon-btn--reopen';
  if (action === 'respond' || action === 'chat') return 'client-ticket-table__reply-btn';
  return 'client-ticket-table__icon-indicator';
}

export function ClientTicketTable({
  activeTab,
  formatDate,
  latestUpdate,
  latestUpdatePreview,
  loading,
  onApprove,
  onChat,
  onOpenDetails,
  onReopen,
  onRespond,
  rows,
  shortDescription,
  statusLabel,
  statusTone,
  ticketPriorityTone,
  submitting
}) {
  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortValue: (row) => row.ID || row['Ticket ID'] || '',
      searchValue: (row) => row.ID || row['Ticket ID'] || ''
    },
    {
      key: 'description',
      label: 'Description',
      sortValue: (row) => row.Description || row['Task Description'] || '',
      searchValue: (row) => row.Description || row['Task Description'] || ''
    },
    {
      key: 'latestUpdate',
      label: 'Latest Update',
      sortValue: (row) => latestUpdate(row),
      searchValue: (row) => latestUpdate(row)
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (row) => statusLabel(row),
      searchValue: (row) => statusLabel(row)
    },
    ...(activeTab === 'response'
      ? []
      : [{
          key: 'priority',
          label: 'Priority',
          sortValue: (row) => row.Priority || '',
          searchValue: (row) => row.Priority || ''
        }]),
    {
      key: 'date',
      label: 'Date',
      sortValue: (row) => {
        const value = row.Date || row['Plan Date'] || row.Timestamp;
        const timestamp = value ? new Date(value).getTime() : 0;
        return Number.isNaN(timestamp) ? 0 : timestamp;
      },
      searchValue: (row) => formatDate(row.Date || row['Plan Date'] || row.Timestamp)
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      headerClassName: 'client-ticket-table__actions-col',
      searchValue: (row) => statusLabel(row)
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

  const colSpan = columns.length;

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
            visibleRows.map((row) => {
              const ticketId = row.ID || row['Ticket ID'] || '-';
              const normalizedStatus = String(row.Status || '').toLowerCase();
              const canRespond = normalizedStatus.includes('pending client response');
              const canApprove = normalizedStatus.includes('pending approval') && statusLabel(row) !== 'Auto-Approved';
              const canReopen = normalizedStatus.includes('pending approval') && statusLabel(row) !== 'Auto-Approved';
              const showsClosedIndicator = statusLabel(row) === 'Auto-Approved' || normalizedStatus.includes('closed') || normalizedStatus.includes('completed');
              const rowClassName = row.HasUnreadMessages ? 'client-ticket-table__row client-ticket-table__row--unread' : 'client-ticket-table__row';

              return (
                <tr key={ticketId} className={rowClassName}>
                  <td data-label="ID">
                    <button type="button" className="ticket-id-chip ticket-id-chip--button" onClick={() => onOpenDetails(row)}>
                      {ticketId}
                    </button>
                  </td>
                  <td data-label="Description" className="approval-table__copy" title={row.Description || row['Task Description'] || '-'}>
                    {shortDescription(row.Description || row['Task Description'])}
                  </td>
                  <td data-label="Latest Update" className="approval-table__copy client-ticket-table__update" title={latestUpdate(row)}>
                    <span className="client-ticket-table__update-text">{latestUpdatePreview(row)}</span>
                  </td>
                  <td data-label="Status"><StatusPill tone={statusTone(statusLabel(row))}>{statusLabel(row)}</StatusPill></td>
                  {activeTab === 'response' ? null : (
                    <td data-label="Priority">
                      <span className={`client-ticket-priority client-ticket-priority--${ticketPriorityTone(row.Priority)}`}>
                        {row.Priority || '-'}
                      </span>
                    </td>
                  )}
                  <td data-label="Date">{formatDate(row.Date || row['Plan Date'] || row.Timestamp)}</td>
                  <td data-label="Action">
                    <div className="ticket-actions client-ticket-table__actions">
                      {canRespond ? (
                        <button
                          type="button"
                          className={actionButtonClass('respond')}
                          disabled={submitting}
                          onClick={() => onRespond(row)}
                        >
                          <ReplyArrow className="client-ticket-table__action-icon" />
                          <span>Reply</span>
                        </button>
                      ) : null}
                      {(() => {
                        const hasUnread = row.HasUnreadMessages === true || String(row.HasUnreadMessages).toUpperCase() === 'TRUE';
                        return (
                          <button
                            type="button"
                            className={`${actionButtonClass('chat')} ${hasUnread ? 'ticket-action-btn--unread-active' : ''}`}
                            disabled={submitting}
                            onClick={() => onChat(row)}
                          >
                            <ActionIcon action="chat" />
                            <span>Chat</span>
                            {hasUnread && <span className="chat-unread-dot"></span>}
                          </button>
                        );
                      })()}
                      {canApprove ? (
                        <button
                          type="button"
                          className={actionButtonClass('approve')}
                          disabled={submitting}
                          onClick={() => onApprove(row)}
                          aria-label={`Approve ${ticketId}`}
                          title="Approve"
                        >
                          <ActionIcon action="approve" />
                        </button>
                      ) : null}
                      {canReopen ? (
                        <button
                          type="button"
                          className={actionButtonClass('reopen')}
                          disabled={submitting}
                          onClick={() => onReopen(row)}
                          aria-label={`Reopen ${ticketId}`}
                          title="Reopen"
                        >
                          <ActionIcon action="reopen" />
                        </button>
                      ) : null}
                      {!canRespond && !canApprove && !canReopen ? (
                        <span className={actionButtonClass('indicator')} title={showsClosedIndicator ? 'Closed/Auto-Approved' : 'Tracking'}>
                          <ActionIcon action={showsClosedIndicator ? 'closed' : 'indicator'} />
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={colSpan} className="dashboard-table__empty">
                {loading ? 'Refreshing ticket workspace...' : search ? 'No matching ticket records found.' : 'No tickets found for this view.'}
              </td>
            </tr>
          )}
        </tbody>
    </DataTableShell>
  );
}
