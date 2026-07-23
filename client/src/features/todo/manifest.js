import { featureContracts } from '@/architecture/featureContracts';

export const todoManifest = {
  feature: 'todo',
  contract: featureContracts.todo,
  plannedModules: [
    'TodoPage',
    'TodoToolbar',
    'TodoSummaryCards',
    'TodoFormPanel',
    'TodoTable',
    'TodoRowActions'
  ]
};
