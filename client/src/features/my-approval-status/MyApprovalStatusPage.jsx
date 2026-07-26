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
    error,
    rows,
    summary,
    filters,
    typeOptions,
    updateFilters,
    resetFilters,
    refresh
  } = useMyApprovalStatusData();

  return (
    <section className="page-card">
      <MyApprovalStatusHeader
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
        onRefresh={refresh}
      />

      {error ? <div className="dashboard-banner dashboard-banner--error">{error}</div> : null}

      {!error && loading ? (
        <div className="dashboard-banner">
          <StatusPill tone="info">Refreshing</StatusPill>
          <span>Loading your approval history...</span>
        </div>
      ) : null}

      <MyApprovalStatusSummary summary={summary} />
      <MyApprovalStatusFilters
        filters={filters}
        typeOptions={typeOptions}
        onChange={updateFilters}
        onReset={resetFilters}
      />
      <MyApprovalStatusTable rows={rows} loading={loading} />
    </section>
  );
}
