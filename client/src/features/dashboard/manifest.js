import { featureContracts } from '@/architecture/featureContracts';

export const dashboardManifest = {
  feature: 'dashboard',
  contract: featureContracts.dashboard,
  plannedModules: [
    'DashboardHeader',
    'DashboardKpiGrid',
    'DashboardMiniStats',
    'DashboardChartsSection',
    'DashboardTasksSection',
    'ModuleOverviewGrid'
  ]
};
