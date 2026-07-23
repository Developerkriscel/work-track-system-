import { featureContracts } from '@/architecture/featureContracts';

export const clientPortalManifest = {
  feature: 'client-portal',
  contract: featureContracts.clientPortal,
  plannedModules: [
    'ClientShell',
    'ClientDashboardPage',
    'ClientTicketsPage',
    'ClientInvoicesPage',
    'ClientReportsPage'
  ]
};
