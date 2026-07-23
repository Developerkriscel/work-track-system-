import { featureContracts } from '@/architecture/featureContracts';

export const adminManifest = {
  feature: 'admin',
  contract: featureContracts.admin,
  plannedModules: [
    'AdminHeader',
    'AdminSummaryCards',
    'AdminTabsAndFilters',
    'AdminEditor',
    'AdminUsersTable',
    'AdminEmpMasterTable'
  ]
};
