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
    loading,
    error, clearError,
    range,
    setRange,
    rangeOptions,
    activeTab,
    setActiveTab,
    kpis,
    charts,
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
    refresh
  } = useManagementDashboardData();

  return (
    <>
      {error ? <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div> : null}
      {loading ? <div className="dashboard-banner"><span>Loading report data from MongoDB...</span></div> : null}

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

      {activeTab !== 'batch-planner' ? (
        <div className="management-dashboard-content-zoom" style={{ zoom: 1.1, width: '100%' }}>
          {activeTab === 'overview' ? (
            <OverviewDashboardSection
              kpis={kpis}
              charts={charts}
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
    </>
  );
}
