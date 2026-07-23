import { featureContracts } from '@/architecture/featureContracts';

export const fmsManifest = {
  feature: 'fms',
  contract: featureContracts.fms,
  plannedModules: [
    'FmsHeader',
    'FmsTabsPanel',
    'FmsFilterPanel',
    'FmsTaskTable',
    'FmsCompletionDialog',
    'FmsExternalFormDialog'
  ]
};
