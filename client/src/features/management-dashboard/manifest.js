import { featureContracts } from '@/architecture/featureContracts';

export const managementDashboardManifest = {
  feature: 'management-dashboard',
  contract: featureContracts.managementDashboard,
  plannedModules: [
    'ManagementDashboardPage',
    'OverviewDashboardPanel',
    'UserExplorerPanel',
    'ClientExplorerPanel',
    'BatchAssignmentPlanner'
  ]
};
