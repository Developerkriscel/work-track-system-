import {
  appscriptUiInventory,
  featureFolderBlueprint,
  screenOwnershipMap
} from './appscriptUiInventory';

export const reactFrontendBlueprint = {
  productionFolders: Object.keys(featureFolderBlueprint),
  featureFolderBlueprint,
  reusableModules: [
    {
      key: 'shell',
      target: 'components/layout',
      responsibilities: ['Sidebar', 'Topbar', 'Route frame', 'Theme toggle', 'Session header']
    },
    {
      key: 'notifications',
      target: 'components/modals + features/auth',
      responsibilities: ['Notification drawer', 'Badge', 'Empty state', 'Notification item card']
    },
    {
      key: 'tables',
      target: 'components/tables',
      responsibilities: ['Table shell', 'Column config', 'Search/filters row', 'Row actions', 'Pagination']
    },
    {
      key: 'forms',
      target: 'components/forms',
      responsibilities: ['Section forms', 'Field wrappers', 'Upload controls', 'Validation messages']
    },
    {
      key: 'modals',
      target: 'components/modals',
      responsibilities: ['Confirmation dialogs', 'Editor dialogs', 'Chat modal', 'Form-open modal']
    },
    {
      key: 'charts',
      target: 'components/charts',
      responsibilities: ['Chart card', 'Legend shell', 'Range-aware wrappers']
    }
  ],
  screenMap: [
    ...screenOwnershipMap.employeePortal,
    ...screenOwnershipMap.clientPortal,
    ...screenOwnershipMap.managementDashboard
  ].map((screen) => ({
    legacyScreen: screen.key,
    reactFeature: screen.reactFeature,
    route: screen.route,
    page: screen.page,
    featureModules: screen.featureModules,
    reusableNeeds: [
      screen.tables?.length ? 'components/tables' : null,
      screen.forms?.length ? 'components/forms' : null,
      screen.modals?.length ? 'components/modals' : null,
      screen.charts?.length ? 'components/charts' : null
    ].filter(Boolean),
    sharedModules: screen.sharedModules,
    parityFocus: screen.parityFocus
  })),
  exactParityRules: [
    'Do not copy rendering responsibility back into appscript HTML.',
    'Every legacy filter should become either feature state or shared filter components.',
    'Every DataTable surface should map to a React table shell with explicit column definitions.',
    'Every Swal modal flow should become a React dialog or modal component with matching behavior.',
    'Legacy IDs, labels, statuses, and response shapes must stay compatible until backend parity is complete.',
    'Every legacy screen should have an explicit React route, page owner, feature module set, and parity-focus checklist before it is called migrated.'
  ]
};
