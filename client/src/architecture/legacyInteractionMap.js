import { screenOwnershipMap } from './appscriptUiInventory';

const interactionDetails = {
  employeePortal: {
    login: {
      uiState: ['currentUser session', 'login error state', 'password modal visibility'],
      legacyFunctions: ['handleLogin', 'setupUI', 'handleLogout', 'openChangePasswordModal', 'closeChangePasswordModal'],
      reactTargets: ['features/auth', 'components/layout', 'components/modals'],
      mustOwnInReact: ['employee login form', 'session restore', 'logout action', 'change-password modal']
    },
    dashboard: {
      uiState: ['currentDashboardRange', 'upcoming task filter state', 'KPI detail table state'],
      legacyFunctions: ['loadDashboard', 'updateDashboardUI', 'handleKpiCardClick', 'renderUpcomingTasksTable', 'filterAndRenderUpcomingTasks'],
      reactTargets: ['features/dashboard', 'components/charts', 'components/tables', 'components/forms'],
      mustOwnInReact: ['range chips/dropdown', 'KPI drilldowns', 'today tasks table', 'upcoming tasks table', 'charts']
    },
    attendance: {
      uiState: ['attendance tab state', 'attendance range state', 'punch timer', 'camera/photo capture state'],
      legacyFunctions: [
        'handlePunch',
        'checkAttendanceStatus',
        'startPunchInTimer',
        'loadAttendanceHistory',
        'handleLeaveRequestSubmit',
        'handleIntimationSubmit',
        'loadUserRequestHistory',
        'startCamera',
        'capturePhoto',
        'retakePhoto',
        'openSecureCameraPopup'
      ],
      reactTargets: ['features/attendance', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['punch workflow', 'camera workflow', 'leave form', 'intimation form', 'attendance history table']
    },
    tickets: {
      uiState: ['ticket filters', 'active ticket tab', 'bulk ticket rows', 'chat modal state'],
      legacyFunctions: [
        'loadTicketSystemData',
        'restoreTicketFilterUI',
        'syncTicketFilterStateFromUI',
        'switchTicketTab',
        'renderTicketTable',
        'populateTicketDropdowns',
        'addTicketRow',
        'startTicketSubmission',
        'showTicketDetails',
        'handleTaskStart',
        'handleTaskEnd',
        'handleReassignToUser',
        'handleReassignToClient',
        'handleClientResponse',
        'openChatModal',
        'handleUpdateSchedule'
      ],
      reactTargets: ['features/tickets', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['ticket tabs', 'advanced filters', 'create/bulk create flow', 'action buttons', 'details modal', 'chat modal']
    },
    fms: {
      uiState: ['FMS tab state', 'FMS filters', 'active form modal state'],
      legacyFunctions: [
        'setFmsTeamTabsVisibility',
        'activateFmsTab',
        'loadFmsViewApp',
        'populateFmsDropdowns',
        'renderFmsTableApp',
        'openInternalFormFallback',
        'buildFormsPortalOpenButton',
        'openFmsModalApp',
        'clearFmsFilters',
        'submitFmsTaskApp',
        'closeFmsModalApp'
      ],
      reactTargets: ['features/fms', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['my/team tabs', 'FMS filters', 'task action column', 'form modal/open-in-new-tab fallback', 'done flow']
    },
    approvals: {
      uiState: ['approval ticket filters', 'approval panel filters', 'approval tab state'],
      legacyFunctions: [
        'loadPendingApprovals',
        'setupFilters',
        'addHeaderFilters',
        'setupDateRangeFilter',
        'renderActionButtons',
        'cleanRemarksForDisplay'
      ],
      reactTargets: ['features/approvals', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['tickets/leaves/intimations/attendance tables', 'remarks modal', 'rework modal', 'transfer approval modal', 'table filters']
    },
    formsPortal: {
      uiState: ['department/category/search filters', 'editor modal state', 'selected visible users', 'assignable users cache'],
      legacyFunctions: [
        'loadFormsPortal',
        'populateFormsFilters',
        'renderFormsTable',
        'isFormsPortalAdmin',
        'parseFormsPortalVisibleUsers',
        'fetchFormsPortalAssignableUsers',
        'buildFormsPortalUserOptions',
        'buildFormsPortalUserChecklist',
        'toggleFormsPortalAssignedUsersField',
        'initializeFormsPortalUserSelect',
        'getSelectedFormsPortalUsers',
        'openFormsPortalEditorModal',
        'checkFormsPortalPermissions'
      ],
      reactTargets: ['features/forms-portal', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['forms table', 'filters', 'open form action', 'add/edit form modal', 'selected-user access control']
    },
    clientsPortalAdmin: {
      uiState: ['client filters', 'editor/detail modal state'],
      legacyFunctions: ['loadClientsPortal', 'renderClientsTable', 'populateClientsDropdownFilters', 'showClientDetailsPopup'],
      reactTargets: ['features/clients-portal', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['client list table', 'client filters', 'client details modal', 'client edit/deactivate actions']
    },
    todo: {
      uiState: ['single/bulk todo entry state', 'todo table filters'],
      legacyFunctions: ['addTodoRow', 'getTodos', 'editTodoItem', 'deleteTodoItem', 'toggleTodoStatus', 'addBulkTodos'],
      reactTargets: ['features/todo', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['bulk todo builder', 'todo action buttons', 'edit/delete confirmations', 'status toggle']
    },
    expenses: {
      uiState: ['expense form state', 'expense history table state'],
      legacyFunctions: ['loadExpenseHistory', 'handleExpenseSubmit'],
      reactTargets: ['features/expenses', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['expense submit form', 'history table', 'receipt link/preview', 'success/error feedback']
    },
    reports: {
      uiState: ['report tab state', 'report range state', 'priority/category filters'],
      legacyFunctions: ['loadReportForTab', 'handleReportDownload'],
      reactTargets: ['features/reports', 'components/forms', 'components/tables', 'components/charts'],
      mustOwnInReact: ['ticket/FMS report tabs', 'range controls', 'export actions', 'report tables']
    },
    empMaster: {
      uiState: ['selected emp category', 'upload/edit form state'],
      legacyFunctions: ['loadEmpData', 'renderEmpTable'],
      reactTargets: ['features/admin', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['EMP master table', 'edit form', 'file upload flows']
    },
    users: {
      uiState: ['user form state', 'users table state'],
      legacyFunctions: ['loadUsersData'],
      reactTargets: ['features/admin', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['users table', 'user editor', 'role/access controls']
    }
  },
  clientPortal: {
    clientLogin: {
      uiState: ['client session', 'login error state'],
      legacyFunctions: ['handleLogin', 'handleLogout', 'setupUI'],
      reactTargets: ['features/auth', 'components/layout'],
      mustOwnInReact: ['client login form', 'client session restore', 'client logout']
    },
    clientDashboard: {
      uiState: ['dashboard KPI state', 'notification state'],
      legacyFunctions: ['loadDashboardData', 'renderStatusDonutChart', 'renderActivityBarChart', 'renderPendingActions', 'renderRecentActivity', 'updateNotificationUI', 'pollForUpdates'],
      reactTargets: ['features/client-portal', 'components/charts', 'components/common', 'components/modals'],
      mustOwnInReact: ['KPI cards', 'status/activity charts', 'pending/recent lists', 'notification drawer']
    },
    clientTickets: {
      uiState: ['ticket mode state', 'ticket tab state', 'table search state', 'response/chat dialog state'],
      legacyFunctions: [
        'restoreTicketModeState',
        'restoreTicketTabState',
        'loadClientTickets',
        'renderAllTicketTables',
        'renderTicketTable',
        'renderAwaitingResponseTable',
        'handleTicketAction',
        'handleClientResponse',
        'handleViewTicketDetails',
        'openChatModal'
      ],
      reactTargets: ['features/client-portal', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['mode tabs', 'status tabs', 'ticket tables', 'details/respond/chat dialogs', 'bulk ticket composer']
    },
    clientSocial: {
      uiState: ['social filters', 'social detail state'],
      legacyFunctions: ['loadClientSocialTasks', 'renderSocialTable', 'handleClientAddRemark', 'handleSocialPostApprove', 'handleViewSocialDetails'],
      reactTargets: ['features/client-social', 'components/forms', 'components/tables', 'components/modals'],
      mustOwnInReact: ['social table', 'approve/request-changes actions', 'history/details dialog']
    },
    clientInvoices: {
      uiState: ['invoice tab state'],
      legacyFunctions: ['restoreInvoiceTabState', 'loadClientInvoices', 'renderInvoicesTable'],
      reactTargets: ['features/client-portal', 'components/tables'],
      mustOwnInReact: ['invoice status tabs', 'invoice table', 'outstanding/paid segregation']
    },
    clientReports: {
      uiState: ['report filters', 'report charts state', 'table search state'],
      legacyFunctions: ['loadClientReports', 'renderReportCharts'],
      reactTargets: ['features/client-portal', 'components/forms', 'components/tables', 'components/charts'],
      mustOwnInReact: ['report filters', 'report table', 'distribution/completion charts']
    }
  },
  managementDashboard: {
    overviewDashboard: {
      uiState: ['active management tab', 'status filter state', 'global date/search state'],
      legacyFunctions: [
        'switchTab',
        'refreshData',
        'populateTableDropdowns',
        'generateStatusFilters',
        'loadStoredDashboardStatuses',
        'applyLocalFilters',
        'renderNewAnalyticsCards',
        'processData',
        'renderOverviewMetrics',
        'renderOverviewCharts',
        'renderTable',
        'filterOverviewTables',
        'exportEffortCSV'
      ],
      reactTargets: ['features/management-dashboard', 'components/forms', 'components/tables', 'components/charts'],
      mustOwnInReact: ['overview tabs', 'status filter multiselect', 'overview tables', 'overview charts', 'export actions']
    },
    userExplorer: {
      uiState: ['selected user explorer profile'],
      legacyFunctions: ['loadUserExplorerProfile', 'calculateSubTableStats', 'formatChildRow'],
      reactTargets: ['features/management-dashboard', 'components/tables', 'components/charts'],
      mustOwnInReact: ['user selector', 'attendance/ticket/fms/todo explorer tables', 'child rows', 'stats cards']
    },
    clientExplorer: {
      uiState: ['selected client explorer profile'],
      legacyFunctions: ['loadClientExplorerProfile', 'renderClientEffort', 'renderInstantClosures'],
      reactTargets: ['features/management-dashboard', 'components/tables', 'components/charts'],
      mustOwnInReact: ['client selector', 'task/bandwidth tables', 'effort analytics', 'closure analytics']
    },
    batchAssignmentModal: {
      uiState: ['batch modal open state', 'assignment type', 'dynamic task rows'],
      legacyFunctions: ['openBatchModal', 'addTaskRow', 'submitBatch'],
      reactTargets: ['features/management-dashboard', 'components/forms', 'components/modals'],
      mustOwnInReact: ['batch modal', 'row builder', 'submit/save flow']
    }
  }
};

function buildPortalMap(portalKey, screens) {
  return screens.map((screen) => ({
    key: screen.key,
    route: screen.route,
    page: screen.page,
    reactFeature: screen.reactFeature,
    featureModules: screen.featureModules,
    sharedModules: screen.sharedModules,
    parityFocus: screen.parityFocus,
    ...(interactionDetails[portalKey]?.[screen.key] || {})
  }));
}

export const legacyInteractionMap = {
  employeePortal: buildPortalMap('employeePortal', screenOwnershipMap.employeePortal),
  clientPortal: buildPortalMap('clientPortal', screenOwnershipMap.clientPortal),
  managementDashboard: buildPortalMap('managementDashboard', screenOwnershipMap.managementDashboard)
};
