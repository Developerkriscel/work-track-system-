import { StatusPill } from '@/components/common/StatusPill';
import { ClientInvoiceStatusTabs, ClientInvoiceTable, ClientPortalHeader, ClientPortalSummaryGrid } from '@/features/client-portal/components';
import { useClientInvoicesData } from '@/features/client-portal/useClientInvoicesData';

export function ClientInvoicesPage() {
  const {
    activeTab,
    client,
    loading,
    error, clearError,
    summaryItems,
    invoiceTone,
    formatDate,
    formatCurrency,
    setActiveTab,
    tabCounts,
    visibleRows
  } = useClientInvoicesData();

  return (
    <section className="page-card">
      <ClientPortalHeader title="Invoices" statusLabel={client?.['Client Name'] || 'Finance View'} />

      {error ? <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div> : null}

      <ClientPortalSummaryGrid items={summaryItems} />

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row client-ticket-workspace__header">
          <h2>Invoice Register</h2>
          <StatusPill tone="info">{visibleRows.length} visible</StatusPill>
        </div>

        <ClientInvoiceStatusTabs activeTab={activeTab} counts={tabCounts} onChange={setActiveTab} />
        <ClientInvoiceTable
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          invoiceTone={invoiceTone}
          loading={loading}
          rows={visibleRows}
        />
      </article>
    </section>
  );
}
