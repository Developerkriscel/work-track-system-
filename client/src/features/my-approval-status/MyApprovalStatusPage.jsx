import { StatusPill } from '@/components/common/StatusPill';
import { MyApprovalStatusFilters } from '@/features/my-approval-status/components/MyApprovalStatusFilters';
import { MyApprovalStatusHeader } from '@/features/my-approval-status/components/MyApprovalStatusHeader';
import { MyApprovalStatusSummary } from '@/features/my-approval-status/components/MyApprovalStatusSummary';
import { MyApprovalStatusTable } from '@/features/my-approval-status/components/MyApprovalStatusTable';
import { useMyApprovalStatusData } from '@/features/my-approval-status/useMyApprovalStatusData';

export function MyApprovalStatusPage() {
  const {
    employeeId,
    currentUser,
    loading,
    error, clearError,
    activeTab,
    rows,
    counts,
    summary,
    filters,
    updateFilters,
    setActiveTab,
    resetFilters,
    refresh
  } = useMyApprovalStatusData();

  return (
    <section className="page-card">
      <MyApprovalStatusHeader
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
        onRefresh={refresh}
      />

      {error ? <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div> : null}

      {!error && loading ? (
        <div className="dashboard-banner">
          <StatusPill tone="info">Refreshing</StatusPill>
          <span>Loading your approval history...</span>
        </div>
      ) : null}

      <MyApprovalStatusSummary summary={summary} />
      <MyApprovalStatusFilters
        activeTab={activeTab}
        counts={counts}
        filters={filters[activeTab]}
        onTabChange={setActiveTab}
        onChange={(patch) => updateFilters(activeTab, patch)}
        onReset={() => resetFilters(activeTab)}
      />
      <MyApprovalStatusTable rows={rows} loading={loading} />
    </section>
  );
}
