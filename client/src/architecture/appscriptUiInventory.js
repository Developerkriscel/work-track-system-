export const appscriptUiInventory = {
  sharedShell: {
    sources: ['appscript/index.html', 'appscript/client-index.html'],
    surfaces: [
      {
        id: 'sidebar-navigation',
        type: 'layout',
        legacyElements: [
          '#sidebar',
          '#user-nav-links',
          '#sidebar-nav',
          '.sidebar-nav-item',
          '[data-view]'
        ],
        reactTarget: 'components/layout/AppShell.jsx'
      },
      {
        id: 'topbar-actions',
        type: 'layout',
        legacyElements: [
          '#app-header-bar',
          '#notification-bell-btn',
          '#notification-popup-container',
          '#notification-list',
          '#theme-toggle-btn',
          '#logout-button',
          '#refresh-app-btn',
          '#refresh-button'
        ],
        reactTarget: 'components/common/UserProfileMenu.jsx'
      },
      {
        id: 'notifications',
        type: 'overlay',
        legacyElements: [
          '#notification-area',
          '#notification-badge',
          '#notification-panel',
          '#notification-count',
          '#notification-sound'
        ],
        reactTarget: 'components/modals + features/* notification drawers'
      },
      {
        id: 'change-password',
        type: 'modal',
        legacyElements: [
          '#change-password-modal',
          '#change-password-form',
          '#old-pwd',
          '#new-pwd',
          '#confirm-new-pwd'
        ],
        reactTarget: 'features/auth + components/modals'
      }
    ]
  },
  employeePortal: {
    source: 'appscript/index.html',
    screens: [
      {
        key: 'login',
        reactFeature: 'features/auth',
        views: ['#login-view'],
        scripts: ['authenticateUser', 'changeUserPassword']
      },
      {
        key: 'dashboard',
        reactFeature: 'features/dashboard',
        views: ['#home-view'],
        filters: [
          '#dashboard-range-select',
          '#todays-tasks-filters',
          '#upcoming-tasks-date-filters',
          '#upcoming-tasks-type-filters',
          '#upcoming-start-date',
          '#upcoming-end-date'
        ],
        tables: ['#todays-tasks-table', '#upcoming-tasks-table', '#kpi-filtered-table'],
        charts: ['#bandwidth-donut-chart', '#tasks-line-chart', '#tasks-bar-chart'],
        scripts: ['getDashboardData', 'getKpiDetails']
      },
      {
        key: 'attendance',
        reactFeature: 'features/attendance',
        views: ['#attendance-view'],
        tabs: ['#attendance-tabs', '#punch-tab', '#leave-tab', '#intimation-tab'],
        filters: [
          '#attendance-range-select',
          '#attendance-start-date',
          '#attendance-end-date'
        ],
        forms: ['#leave-request-form', '#intimation-form'],
        tables: ['#attendance-history-table'],
        media: ['#camera-video', '#camera-canvas', '#captured-photo-img'],
        scripts: [
          'recordAttendance',
          'getAttendanceForUser',
          'submitLeaveRequest',
          'submitIntimation',
          'getUserRequestStatus'
        ]
      },
      {
        key: 'tickets',
        reactFeature: 'features/tickets',
        views: ['#ticket-system-view'],
        tabs: ['#tab-ticket-my', '#tab-ticket-team'],
        filters: [
          '#filter-ticket-client-select',
          '#filter-ticket-status-select',
          '#filter-ticket-period',
          '#filter-ticket-date-start',
          '#filter-ticket-date-end'
        ],
        forms: ['#ticket-form', '#bulk-tickets-container'],
        templates: ['#todo-row-template', '#ticket-row-template'],
        tables: ['#ticket-table'],
        modals: [
          'ticket close/update Swal',
          'assign/reassign Swal',
          'schedule update Swal',
          'client response Swal',
          'ticket chat Swal'
        ],
        scripts: [
          'getTicketSystemData',
          'createTicketInSheet',
          'createBulkTicketsInSheet',
          'updateTicketInSheet',
          'reassignTicket',
          'updateTicketSchedule',
          'processClientResponse',
          'getMessagesForTask',
          'postMessage'
        ]
      },
      {
        key: 'fms',
        reactFeature: 'features/fms',
        views: ['#fms-view'],
        tabs: ['#fms-tabs'],
        filters: ['#fms-filter-emp', '#fms-filter-name', '#fms-filter-date'],
        tables: ['#table-fms-main'],
        modals: ['#fms-form-modal', 'FMS completion Swal'],
        scripts: ['getFmsTasksForApp', 'markFmsTaskDoneInApp']
      },
      {
        key: 'approvals',
        reactFeature: 'features/approvals',
        views: ['#approvals-view'],
        filters: [
          '#filter-ticket-approval-status',
          '#filter-ticket-approval-client',
          '#filter-ticket-approval-employee',
          '#filter-leave-employee',
          '#filter-int-employee',
          '#filter-att-employee'
        ],
        tables: [
          '#table-approve-tickets',
          '#table-approve-leaves',
          '#table-approve-intimations',
          '#table-approve-attendance'
        ],
        modals: ['approval remarks Swal', 'attendance correction Swal', 'transfer approval Swal'],
        scripts: ['getPendingApprovals', 'processAdminAction', 'transferTicketApproval']
      },
      {
        key: 'myRequests',
        reactFeature: 'features/attendance',
        views: ['#my-requests-view'],
        tables: ['#my-requests-table'],
        scripts: ['getUserRequestStatus']
      },
      {
        key: 'formsPortal',
        reactFeature: 'features/forms-portal',
        views: ['#forms-view'],
        filters: ['#filter-form-dept', '#filter-form-category', '#filter-form-search'],
        tables: ['#table-forms-portal'],
        modals: ['forms editor/access Swal'],
        scripts: ['getFormsData', 'saveFormsPortalData', 'deleteFormsPortalData']
      },
      {
        key: 'clientsPortalAdmin',
        reactFeature: 'features/clients-portal',
        views: ['#clients-view'],
        filters: ['#filter-client-search', '#filter-client-status', '#filter-client-services'],
        tables: ['#table-clients-portal'],
        modals: ['client details Swal', 'client editor Swal'],
        scripts: ['getClientsPortalData', 'saveClientPortalData', 'deleteClientPortalData']
      },
      {
        key: 'todo',
        reactFeature: 'features/todo',
        views: ['#todo-view'],
        tables: ['todo DataTable inside portal'],
        scripts: ['getTodos', 'addTodo', 'toggleTodoStatus', 'editTodoItem', 'deleteTodoItem', 'addBulkTodos']
      },
      {
        key: 'expenses',
        reactFeature: 'features/expenses',
        views: ['#expense-view'],
        forms: ['expense submit form'],
        tables: ['#expense-history-table'],
        scripts: ['submitExpense', 'getExpensesForUser']
      },
      {
        key: 'reports',
        reactFeature: 'features/reports',
        views: ['#reports-view'],
        tabs: ['tickets report tab', 'fms report tab'],
        filters: [
          '#report-range-select',
          '#report-start-date',
          '#report-end-date',
          '#report-ticket-priority-filter',
          '#report-ticket-category-filter'
        ],
        tables: ['#report-table-tickets', '#report-table-fms'],
        scripts: ['getAdminReports', 'exportReportForWeb']
      },
      {
        key: 'empMaster',
        reactFeature: 'features/admin',
        views: ['#emp-master-view'],
        tables: ['#emp-master-table'],
        forms: ['emp master editor/upload forms'],
        scripts: ['getEmpMasterData', 'saveEmpMasterDataWithFiles']
      },
      {
        key: 'users',
        reactFeature: 'features/admin',
        views: ['#users-view'],
        forms: ['#user-management-form'],
        tables: ['#users-table'],
        scripts: ['getUsers', 'saveOrUpdateUser']
      }
    ]
  },
  clientPortal: {
    source: 'appscript/client-index.html',
    screens: [
      {
        key: 'clientLogin',
        reactFeature: 'features/auth',
        views: ['#login-view'],
        scripts: ['clientAuthenticate']
      },
      {
        key: 'clientDashboard',
        reactFeature: 'features/client-portal',
        views: ['#dashboard-view'],
        tables: ['#kpi-filtered-table'],
        charts: ['#status-donut-chart', '#activity-bar-chart'],
        scripts: ['getClientDashboardData']
      },
      {
        key: 'clientTickets',
        reactFeature: 'features/client-portal',
        views: ['#tickets-view'],
        tabs: [
          '#tab-view-tickets',
          '#tab-new-ticket',
          '#ticket-tabs',
          '#all-tickets-tab-content',
          '#open-tickets-tab-content',
          '#response-tickets-tab-content',
          '#closed-tickets-tab-content'
        ],
        filters: ['#ticket-filters'],
        forms: ['#bulk-ticket-form', '#ticket-rows-container'],
        tables: [
          '#client-ticket-table',
          '#open-tickets-table',
          '#awaiting-response-table',
          '#closed-tickets-table'
        ],
        modals: ['ticket details Swal', 'client response Swal', 'chat modal'],
        scripts: [
          'createBulkTicketsWithDetails',
          'getClientTickets',
          'updateTicketStatusByClient',
          'submitClientResponse'
        ]
      },
      {
        key: 'clientSocial',
        reactFeature: 'features/client-social',
        views: ['#social-view'],
        filters: ['#social-platform-filter', '#social-status-filter'],
        tables: ['#client-social-table'],
        modals: ['social details Swal'],
        scripts: ['getClientSocialTasks', 'updateSocialPostStatusByClient', 'addClientRemarkToHistoryEntry']
      },
      {
        key: 'clientInvoices',
        reactFeature: 'features/client-portal',
        views: ['#invoices-view'],
        tabs: ['#invoice-tabs'],
        tables: ['#client-invoices-table'],
        scripts: ['getClientInvoices']
      },
      {
        key: 'clientReports',
        reactFeature: 'features/client-portal',
        views: ['#reports-view'],
        filters: ['#report-filters'],
        tables: ['#client-report-table'],
        charts: ['#report-distribution-chart', '#report-completion-chart'],
        scripts: ['getClientReportData']
      }
    ]
  },
  managementDashboard: {
    source: 'appscript/dashboard-index.html',
    screens: [
      {
        key: 'overviewDashboard',
        reactFeature: 'features/management-dashboard',
        views: ['#tab-overview'],
        tabs: ['#date-filters'],
        filters: ['#start-date', '#end-date', '#global-search', '#status-list'],
        tables: ['#table-tickets', '#table-fms', '#table-todo', '#table-client-effort', '#table-audit'],
        charts: ['#ovStatusChart', '#ovUserChart', '#ovAgingChart', '#newHoursChart'],
        scripts: ['getDashboardData']
      },
      {
        key: 'userExplorer',
        reactFeature: 'features/management-dashboard',
        views: ['#tab-user-explorer'],
        filters: ['#ux-user-selector'],
        tables: [
          '#ux-table-attendance',
          '#ux-table-tickets',
          '#ux-table-fms',
          '#ux-table-todo',
          '#ux-client-distribution-table'
        ],
        scripts: ['getDashboardData']
      },
      {
        key: 'clientExplorer',
        reactFeature: 'features/management-dashboard',
        views: ['#tab-client-explorer'],
        filters: ['#cx-client-selector'],
        tables: ['#cx-task-table', '#cx-bandwidth-table'],
        scripts: ['getDashboardData']
      },
      {
        key: 'batchAssignmentModal',
        reactFeature: 'features/management-dashboard',
        views: ['#batch-modal'],
        forms: ['#batch-user', '#task-list-container'],
        scripts: ['batch assignment handlers']
      }
    ]
  }
};

export const featureFolderBlueprint = {
  app: {
    owns: ['bootstrap', 'router', 'providers', 'route guards', 'theme/session boundaries']
  },
  architecture: {
    owns: ['legacy UI inventory', 'parity audit', 'coverage matrix', 'screen ownership contracts']
  },
  'components/charts': {
    owns: ['chart card shells', 'line/bar/donut wrappers', 'legends', 'chart-state chrome']
  },
  'components/common': {
    owns: ['badges', 'summary cards', 'notification items', 'empty states', 'icon buttons']
  },
  'components/forms': {
    owns: ['field wrappers', 'date controls', 'searchable selects', 'upload inputs', 'validation blocks']
  },
  'components/layout': {
    owns: ['employee shell', 'client shell', 'management shell', 'sidebar', 'topbar', 'mobile nav']
  },
  'components/modals': {
    owns: ['confirmation dialogs', 'editor dialogs', 'chat dialogs', 'preview/open dialogs']
  },
  'components/tables': {
    owns: ['table shell', 'table state', 'header filters', 'pagination', 'row actions']
  },
  hooks: {
    owns: ['cross-feature hooks', 'API health', 'table state hooks']
  },
  lib: {
    owns: ['HTTP client', 'constants', 'navigation metadata']
  },
  pages: {
    owns: ['route-level composition pages']
  },
  services: {
    owns: ['cross-feature service facades']
  },
  styles: {
    owns: ['tokens', 'base styles', 'page styles', 'component-level styles']
  },
  utils: {
    owns: ['pure helpers', 'formatters', 'small utilities']
  }
};

const sharedModuleTargets = {
  shell: ['components/layout/AppShell.jsx', 'components/layout/ClientShell.jsx'],
  notifications: ['components/common', 'components/modals', 'features/* notification state'],
  tables: ['components/tables/DataTableShell.jsx', 'components/tables/useDataTableState.js'],
  forms: ['components/forms'],
  modals: ['components/modals/AppModal.jsx'],
  charts: ['components/charts']
};

const screenOwnershipMeta = {
  login: {
    route: '/',
    page: 'features/auth/LoginPage.jsx',
    featureModules: ['features/auth/components', 'features/auth/services', 'features/auth/contracts'],
    sharedModules: ['shell', 'forms', 'modals'],
    parityFocus: ['password-change dialog', 'legacy validation/messaging', 'session redirects']
  },
  dashboard: {
    route: '/dashboard',
    page: 'features/dashboard/DashboardPage.jsx',
    featureModules: ['features/dashboard/components', 'features/dashboard/services', 'features/dashboard/contracts'],
    sharedModules: ['shell', 'tables', 'charts', 'forms'],
    parityFocus: ['KPI drilldowns', 'legacy chart micro-layout', 'upcoming/today task table parity']
  },
  attendance: {
    route: '/attendance',
    page: 'features/attendance/AttendancePage.jsx',
    featureModules: ['features/attendance/components', 'features/attendance/services', 'features/attendance/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['camera capture UX', 'leave/intimation dialogs', 'attendance row renderer parity']
  },
  tickets: {
    route: '/tickets',
    page: 'features/tickets/TicketSystemPage.jsx',
    featureModules: ['features/tickets/components', 'features/tickets/services', 'features/tickets/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['all action dialogs', 'chat/message flows', 'row badge/action exact parity']
  },
  fms: {
    route: '/fms',
    page: 'features/fms/FmsPage.jsx',
    featureModules: ['features/fms/components', 'features/fms/services', 'features/fms/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['done flow', 'team tabs', 'external form modal behavior']
  },
  approvals: {
    route: '/approvals',
    page: 'features/approvals/ApprovalsPage.jsx',
    featureModules: ['features/approvals/components', 'features/approvals/services', 'features/approvals/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['remarks dialogs', 'transfer approval', 'attendance correction workflow']
  },
  myRequests: {
    route: '/attendance',
    page: 'features/attendance/AttendancePage.jsx',
    featureModules: ['features/attendance/components', 'features/attendance/services'],
    sharedModules: ['shell', 'tables'],
    parityFocus: ['kept only if business still requires request history surface']
  },
  formsPortal: {
    route: '/forms-portal',
    page: 'features/forms-portal/FormsPortalPage.jsx',
    featureModules: ['features/forms-portal/components', 'features/forms-portal/services', 'features/forms-portal/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['access assignment persistence', 'form editor parity', 'open-form behavior']
  },
  clientsPortalAdmin: {
    route: '/clients-portal',
    page: 'features/clients-portal/ClientsPortalPage.jsx',
    featureModules: ['features/clients-portal/components', 'features/clients-portal/services', 'features/clients-portal/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['client editor', 'detail modal parity', 'admin maintenance workflows']
  },
  todo: {
    route: '/todo',
    page: 'features/todo/TodoPage.jsx',
    featureModules: ['features/todo/components', 'features/todo/services', 'features/todo/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['embedded portal behavior', 'bulk add/edit parity', 'table action parity']
  },
  expenses: {
    route: '/expenses',
    page: 'features/expenses/ExpensesPage.jsx',
    featureModules: ['features/expenses/components', 'features/expenses/services', 'features/expenses/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['receipt preview', 'status feedback', 'submission/edit parity']
  },
  reports: {
    route: '/reports',
    page: 'features/reports/ReportsPage.jsx',
    featureModules: ['features/reports/components', 'features/reports/services', 'features/reports/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'charts'],
    parityFocus: ['export workflows', 'range/category controls', 'ticket/FMS report exact parity']
  },
  empMaster: {
    route: '/admin?tab=emp-master',
    page: 'features/admin/AdminPage.jsx',
    featureModules: ['features/admin/components', 'features/admin/services', 'features/admin/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['upload/edit flows', 'row detail parity']
  },
  users: {
    route: '/admin?tab=users',
    page: 'features/admin/AdminPage.jsx',
    featureModules: ['features/admin/components', 'features/admin/services', 'features/admin/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['role/access editor parity', 'validation/state feedback']
  },
  clientLogin: {
    route: '/client/login',
    page: 'features/auth/ClientLoginPage.jsx',
    featureModules: ['features/auth/components', 'features/auth/services', 'features/auth/contracts'],
    sharedModules: ['shell', 'forms', 'modals'],
    parityFocus: ['exact client login visual parity', 'client session messaging']
  },
  clientDashboard: {
    route: '/client/dashboard',
    page: 'features/client-portal/ClientDashboardPage.jsx',
    featureModules: ['features/client-portal/components', 'features/client-portal/services', 'features/client-portal/contracts'],
    sharedModules: ['shell', 'tables', 'charts', 'forms', 'modals'],
    parityFocus: ['clickable KPI drilldowns', 'legacy activity/status presentation', 'final visual parity']
  },
  clientTickets: {
    route: '/client/tickets',
    page: 'features/client-portal/ClientTicketsPage.jsx',
    featureModules: ['features/client-portal/components', 'features/client-portal/services', 'features/client-portal/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['all action states', 'chat/details/respond dialogs', 'table/action parity']
  },
  clientSocial: {
    route: '/client/social',
    page: 'features/client-social/ClientSocialPage.jsx',
    featureModules: ['features/client-social/components', 'features/client-social/services', 'features/client-social/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['full client shell integration', 'social detail/review parity']
  },
  clientInvoices: {
    route: '/client/invoices',
    page: 'features/client-portal/ClientInvoicesPage.jsx',
    featureModules: ['features/client-portal/components', 'features/client-portal/services', 'features/client-portal/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'modals'],
    parityFocus: ['invoice tab parity', 'payment state presentation', 'exact table layout']
  },
  clientReports: {
    route: '/client/reports',
    page: 'features/client-portal/ClientReportsPage.jsx',
    featureModules: ['features/client-portal/components', 'features/client-portal/services', 'features/client-portal/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'charts'],
    parityFocus: ['report filters', 'charts', 'export parity', 'visual parity']
  },
  overviewDashboard: {
    route: '/management-dashboard?tab=overview',
    page: 'features/management-dashboard/ManagementDashboardPage.jsx',
    featureModules: ['features/management-dashboard/components', 'features/management-dashboard/services', 'features/management-dashboard/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'charts', 'modals'],
    parityFocus: ['overview drilldowns', 'chart/table density parity']
  },
  userExplorer: {
    route: '/management-dashboard?tab=user-explorer',
    page: 'features/management-dashboard/ManagementDashboardPage.jsx',
    featureModules: ['features/management-dashboard/components', 'features/management-dashboard/services', 'features/management-dashboard/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'charts'],
    parityFocus: ['collapse/expand behavior', 'exact explorer drilldowns']
  },
  clientExplorer: {
    route: '/management-dashboard?tab=client-explorer',
    page: 'features/management-dashboard/ManagementDashboardPage.jsx',
    featureModules: ['features/management-dashboard/components', 'features/management-dashboard/services', 'features/management-dashboard/contracts'],
    sharedModules: ['shell', 'tables', 'forms', 'charts'],
    parityFocus: ['client workload drilldowns', 'invoice band parity']
  },
  batchAssignmentModal: {
    route: '/management-dashboard',
    page: 'features/management-dashboard/ManagementDashboardPage.jsx',
    featureModules: ['features/management-dashboard/components', 'features/management-dashboard/services'],
    sharedModules: ['shell', 'forms', 'modals'],
    parityFocus: ['full batch save flow', 'task-list editor parity']
  }
};

function enrichScreen(screen) {
  const meta = screenOwnershipMeta[screen.key] || {};
  return {
    ...screen,
    route: meta.route || null,
    page: meta.page || null,
    featureModules: meta.featureModules || [],
    sharedModules: (meta.sharedModules || []).flatMap((key) => sharedModuleTargets[key] || [key]),
    parityFocus: meta.parityFocus || []
  };
}

export const screenOwnershipMap = {
  employeePortal: appscriptUiInventory.employeePortal.screens.map(enrichScreen),
  clientPortal: appscriptUiInventory.clientPortal.screens.map(enrichScreen),
  managementDashboard: appscriptUiInventory.managementDashboard.screens.map(enrichScreen)
};
