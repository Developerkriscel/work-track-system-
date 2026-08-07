import { BatchAssignmentPlanner } from '@/features/management-dashboard/components/BatchAssignmentPlanner';
import { ClientExplorerSection } from '@/features/management-dashboard/components/ClientExplorerSection';
import { ManagementDashboardTabs } from '@/features/management-dashboard/components/ManagementDashboardTabs';
import { UserExplorerSection } from '@/features/management-dashboard/components/UserExplorerSection';
import { useManagementDashboardData } from '@/features/management-dashboard/useManagementDashboardData';
import { OverviewDashboardSection } from '@/features/management-dashboard/components/OverviewDashboardSection';
import { RefreshCw } from '@/components/common/icons';

export function ManagementDashboardReportTab() {
  const {
    currentUser,
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
    <>
      {error ? <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div> : null}

      <ManagementDashboardTabs activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="reports-toolbar__actions">
          {activeTab !== 'batch-planner' && (
            <label className="dashboard-control" style={{ marginRight: '12px' }}>
              <span>Date Range</span>
              <select value={range} onChange={(event) => setRange(event.target.value)}>
                {rangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </ManagementDashboardTabs>

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
    </>
  );
}
