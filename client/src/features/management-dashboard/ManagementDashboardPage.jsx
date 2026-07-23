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
    error,
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
    selectedUserId,
    setSelectedUserId,
    selectedUser,
    userExplorer,
    selectedClientId,
    setSelectedClientId,
    selectedClient,
    clientExplorer,
    refresh
  } = useManagementDashboardData();

  return (
    <section className="page-card">
      <ManagementDashboardHeader
        currentUser={currentUser}
        range={range}
        rangeOptions={rangeOptions}
        onRangeChange={setRange}
        onRefresh={refresh}
      />

      {error ? (
        <div className="dashboard-banner dashboard-banner--error">{error}</div>
      ) : null}

      <ManagementDashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <OverviewDashboardSection
          kpis={kpis}
          tickets={tickets}
          fms={fms}
          todo={todo}
          users={users}
          clients={clients}
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
        />
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
