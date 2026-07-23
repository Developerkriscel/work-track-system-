import { featureContracts } from '@/architecture/featureContracts';

export const clientSocialManifest = {
  feature: 'client-social',
  contract: featureContracts.clientSocial,
  plannedModules: [
    'ClientSocialPage',
    'ClientSocialFilters',
    'ClientSocialTable',
    'ClientSocialDetailsPanel',
    'ClientSocialSummaryCards'
  ]
};
