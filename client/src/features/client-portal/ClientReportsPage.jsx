import { StatusPill } from '@/components/common/StatusPill';
import { ClientPortalHeader, ClientPortalSummaryGrid, ClientReportTable } from '@/features/client-portal/components';
import { useClientReportsData } from '@/features/client-portal/useClientReportsData';

export function ClientReportsPage() {
  const { loading, error, clearError, details, summaryItems, reportTypeTone, formatDate } = useClientReportsData();

  return (
    <section className="page-card">
      <ClientPortalHeader title="Reports" statusLabel="All Time" />

      {error ? <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div> : null}

      <ClientPortalSummaryGrid items={summaryItems} />

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>Report Details</h2>
          <StatusPill tone="info">{details.length} rows</StatusPill>
        </div>

        <ClientReportTable
          details={details}
          formatDate={formatDate}
          loading={loading}
          reportTypeTone={reportTypeTone}
        />
      </article>
    </section>
  );
}
