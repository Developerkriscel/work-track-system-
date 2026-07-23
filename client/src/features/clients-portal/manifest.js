import { featureContracts } from '@/architecture/featureContracts';

export const clientsPortalManifest = {
  feature: 'clients-portal',
  contract: featureContracts.clientsPortal,
  plannedModules: [
    'ClientDashboardPanel',
    'ClientTicketsPanel',
    'ClientInvoicesPanel',
    'ClientReportsPanel',
    'ClientAdminTable',
    'ClientEditorDialog'
  ]
};
