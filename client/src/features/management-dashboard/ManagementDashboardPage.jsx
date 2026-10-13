import { StatusPill } from '@/components/common/StatusPill';
import { BatchAssignmentPlanner } from '@/features/management-dashboard/components/BatchAssignmentPlanner';
import { ClientExplorerSection } from '@/features/management-dashboard/components/ClientExplorerSection';
import { ManagementDashboardHeader } from '@/features/management-dashboard/components/ManagementDashboardHeader';
import { ManagementDashboardTabs } from '@/features/management-dashboard/components/ManagementDashboardTabs';
import { OverviewDashboardSection } from '@/features/management-dashboard/components/OverviewDashboardSection';
import { UserExplorerSection } from '@/features/management-dashboard/components/UserExplorerSection';
import { useManagementDashboardData } from '@/features/management-dashboard/useManagementDashboardData';

export function ManagementDashboardPage() {
  const {
    currentUser,
    loading,
    error, clearError,
    range,
    setRange,
    rangeOptions,
    activeTab,
    setActiveTab,
    kpis,
    users,
    clients,
    tickets,
    fms,
    todo,
    invoices,
    attendance,
    selectedUserId,
    setSelectedUserId,
    selectedUser,
    userExplorer,
    selectedClientId,
    setSelectedClientId,
    selectedClient,
    clientExplorer,
    refresh,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd
  } = useManagementDashboardData();

  return (
    <section className="page-card">
      <ManagementDashboardHeader
        currentUser={currentUser}
        range={range}
        rangeOptions={rangeOptions}
        onRangeChange={setRange}
        onRefresh={refresh}
        customStart={customStart}
        onCustomStartChange={setCustomStart}
        customEnd={customEnd}
        onCustomEndChange={setCustomEnd}
      />

      {error ? (
        <div className="dashboard-banner dashboard-banner--error">
          <span>{error}</span>
          <button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button>
        </div>
      ) : null}

      <ManagementDashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />
 
      {activeTab !== 'batch-planner' ? (
        <div className="management-dashboard-content-zoom" style={{ zoom: 1.1, width: '100%' }}>
          {activeTab === 'overview' ? (
            <OverviewDashboardSection
              kpis={kpis}
              tickets={tickets}
              fms={fms}
              todo={todo}
              users={users}
              clients={clients}
              invoices={invoices}
              attendance={attendance}
              onOpenBatchModal={(type) => setActiveTab('batch-planner')}
            />
          ) : null}

          {activeTab === 'user-explorer' ? (
            <UserExplorerSection
              users={users}
              selectedUserId={selectedUserId}
              onUserChange={setSelectedUserId}
              selectedUser={selectedUser}
              explorer={userExplorer}
            />
          ) : null}

          {activeTab === 'client-explorer' ? (
            <ClientExplorerSection
              clients={clients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
              selectedClient={selectedClient}
              explorer={clientExplorer}
              tickets={tickets}
              fms={fms}
              todo={todo}
              invoices={invoices}
            />
          ) : null}
        </div>
      ) : null}

      {activeTab === 'batch-planner' ? (
        <BatchAssignmentPlanner
          users={users}
          clients={clients}
          currentUser={currentUser}
          onCompleted={refresh}
        />
      ) : null}
    </section>
  );
}
