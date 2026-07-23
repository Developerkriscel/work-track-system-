import { featureContracts } from '@/architecture/featureContracts';

export const formsPortalManifest = {
  feature: 'forms-portal',
  contract: featureContracts.formsPortal,
  plannedModules: [
    'FormsPortalFilters',
    'FormsPortalTable',
    'FormAccessSummary',
    'FormEditorDialog',
    'FormAccessDialog'
  ]
};
