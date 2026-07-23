export const uiSurfaceOwnershipMatrix = {
  tables: [
    {
      feature: 'dashboard',
      legacyScreen: 'dashboard',
      legacyIds: ['#todays-tasks-table', '#upcoming-tasks-table', '#kpi-filtered-table'],
      reactTargets: ['features/dashboard/components/DashboardTasksSection.jsx', 'pending KPI detail table/panel'],
      status: 'partially migrated',
      parityNotes: ['today and upcoming task surfaces exist in React, KPI filtered table is still pending']
    },
    {
      feature: 'attendance',
      legacyScreen: 'attendance',
      legacyIds: ['#attendance-history-table', '#my-requests-table'],
      reactTargets: ['features/attendance/components/AttendanceTables.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['history and request tables exist in React; exact DataTables control layout still needs audit']
    },
    {
      feature: 'tickets',
      legacyScreen: 'tickets',
      legacyIds: ['#ticket-table'],
      reactTargets: ['features/tickets/components/TicketTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['core table exists, but action-cell behavior and linked dialogs are incomplete']
    },
    {
      feature: 'fms',
      legacyScreen: 'fms',
      legacyIds: ['#table-fms-main'],
      reactTargets: ['features/fms/components/FmsTaskTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['table exists in React; form-open and done-flow parity still pending']
    },
    {
      feature: 'approvals',
      legacyScreen: 'approvals',
      legacyIds: ['#table-approve-tickets', '#table-approve-leaves', '#table-approve-intimations', '#table-approve-attendance'],
      reactTargets: [
        'features/approvals/components/TicketApprovalTable.jsx',
        'features/approvals/components/GenericApprovalTables.jsx'
      ],
      status: 'implemented with parity gaps',
      parityNotes: ['React tables exist for all approval queues; dialog-level action parity remains']
    },
    {
      feature: 'forms-portal',
      legacyScreen: 'formsPortal',
      legacyIds: ['#table-forms-portal'],
      reactTargets: ['features/forms-portal/components/FormsPortalTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['listing table exists; access summary and open-form behavior still need final polish']
    },
    {
      feature: 'clients-portal',
      legacyScreen: 'clientsPortalAdmin',
      legacyIds: ['#table-clients-portal'],
      reactTargets: ['features/clients-portal/components/ClientsPortalTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['table exists; ID-link detail behavior still needs parity audit']
    },
    {
      feature: 'todo',
      legacyScreen: 'todo',
      legacyIds: ['todo DataTable inside portal'],
      reactTargets: ['features/todo/components/TodoTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['React table exists; embedded-portal parity still needs final review']
    },
    {
      feature: 'expenses',
      legacyScreen: 'expenses',
      legacyIds: ['#expense-history-table'],
      reactTargets: ['features/expenses/components/ExpensesHistoryTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['history table exists; receipt-preview behavior still pending']
    },
    {
      feature: 'reports',
      legacyScreen: 'reports',
      legacyIds: ['#report-table-tickets', '#report-table-fms'],
      reactTargets: ['features/reports/components/TicketReportSection.jsx', 'features/reports/components/FmsReportSection.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['both report tables exist; exact export/search/print layout still needs parity work']
    },
    {
      feature: 'admin',
      legacyScreen: 'empMaster + users',
      legacyIds: ['#emp-master-table', '#users-table'],
      reactTargets: ['features/admin/components/AdminEmpMasterTable.jsx', 'features/admin/components/AdminUsersTable.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['both admin tables exist; row-level edit/upload/access actions still need final audit']
    },
    {
      feature: 'client-portal',
      legacyScreen: 'clientTickets',
      legacyIds: ['#client-ticket-table', '#open-tickets-table', '#awaiting-response-table', '#closed-tickets-table'],
      reactTargets: ['features/client-portal/components/ClientTicketTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['React ticket workspace exists; checklist/social auxiliary surfaces still need integration audit']
    },
    {
      feature: 'client-portal',
      legacyScreen: 'clientInvoices',
      legacyIds: ['#client-invoices-table'],
      reactTargets: ['features/client-portal/components/ClientInvoiceTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['invoice table exists; wrapper control layout still needs exact parity']
    },
    {
      feature: 'client-portal',
      legacyScreen: 'clientReports',
      legacyIds: ['#client-report-table'],
      reactTargets: ['features/client-portal/components/ClientReportTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['report table exists; dedicated filter/charts/export layer still pending']
    },
    {
      feature: 'client-social',
      legacyScreen: 'clientSocial',
      legacyIds: ['#client-social-table'],
      reactTargets: ['features/client-social/components/ClientSocialTable.jsx', 'components/tables/DataTableShell.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['table exists; exact details/history popup parity still pending']
    },
    {
      feature: 'management-dashboard',
      legacyScreen: 'overview + explorers',
      legacyIds: [
        '#table-tickets',
        '#table-fms',
        '#table-todo',
        '#table-client-effort',
        '#table-audit',
        '#ux-table-attendance',
        '#ux-table-tickets',
        '#ux-table-fms',
        '#ux-table-todo',
        '#ux-client-distribution-table',
        '#cx-task-table',
        '#cx-bandwidth-table'
      ],
      reactTargets: [
        'features/management-dashboard/components/OverviewDashboardSection.jsx',
        'features/management-dashboard/components/UserExplorerSection.jsx',
        'features/management-dashboard/components/ClientExplorerSection.jsx'
      ],
      status: 'implemented with parity gaps',
      parityNotes: ['major sections exist; exact subtable, child-row, and drilldown parity still pending']
    }
  ],
  filters: [
    {
      feature: 'dashboard',
      legacyScreen: 'dashboard',
      legacyIds: ['#dashboard-range-select', '#todays-tasks-filters', '#upcoming-tasks-date-filters', '#upcoming-tasks-type-filters', '#upcoming-start-date', '#upcoming-end-date'],
      reactTargets: ['features/dashboard/components/DashboardHeader.jsx'],
      status: 'partially migrated',
      parityNotes: ['range state exists, but all legacy filter group details are not fully rebuilt']
    },
    {
      feature: 'attendance',
      legacyScreen: 'attendance',
      legacyIds: ['#attendance-range-select', '#attendance-start-date', '#attendance-end-date'],
      reactTargets: ['features/attendance/components/AttendanceRangeToolbar.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['range toolbar exists; final control-placement parity still pending']
    },
    {
      feature: 'tickets',
      legacyScreen: 'tickets',
      legacyIds: ['#filter-ticket-client-select', '#filter-ticket-status-select', '#filter-ticket-period', '#filter-ticket-date-start', '#filter-ticket-date-end'],
      reactTargets: ['features/tickets/components/TicketFilterPanel.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['core filters exist; exact advanced-filter behavior still needs parity work']
    },
    {
      feature: 'fms',
      legacyScreen: 'fms',
      legacyIds: ['#fms-filter-emp', '#fms-filter-name', '#fms-filter-date'],
      reactTargets: ['features/fms/components/FmsFilterPanel.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['React filter panel exists; reset and team-scope nuances still need audit']
    },
    {
      feature: 'approvals',
      legacyScreen: 'approvals',
      legacyIds: ['#filter-ticket-approval-status', '#filter-ticket-approval-client', '#filter-ticket-approval-employee', '#filter-leave-employee', '#filter-int-employee', '#filter-att-employee'],
      reactTargets: ['features/approvals/components/ApprovalsTabsAndFilters.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['filter panel exists; exact per-table search parity still pending']
    },
    {
      feature: 'forms-portal',
      legacyScreen: 'formsPortal',
      legacyIds: ['#filter-form-dept', '#filter-form-category', '#filter-form-search'],
      reactTargets: ['features/forms-portal/components/FormsPortalFilterPanel.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['filter panel exists; exact control spacing and reset behavior still need audit']
    },
    {
      feature: 'clients-portal',
      legacyScreen: 'clientsPortalAdmin',
      legacyIds: ['#filter-client-search', '#filter-client-status', '#filter-client-services'],
      reactTargets: ['features/clients-portal/components/ClientsPortalFilterPanel.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['filter panel exists; exact legacy interactions still need audit']
    },
    {
      feature: 'reports',
      legacyScreen: 'reports',
      legacyIds: ['#report-range-select', '#report-start-date', '#report-end-date', '#report-ticket-priority-filter', '#report-ticket-category-filter'],
      reactTargets: ['features/reports/components/ReportsToolbar.jsx', 'features/reports/components/TicketReportSection.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['range and report filters exist; final exact layout still pending']
    },
    {
      feature: 'admin',
      legacyScreen: 'users + empMaster',
      legacyIds: ['admin tab and filter controls'],
      reactTargets: ['features/admin/components/AdminTabsAndFilters.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['React tab/filter controls exist; exact legacy tab routing still needs audit']
    },
    {
      feature: 'client-portal',
      legacyScreen: 'clientTickets',
      legacyIds: ['#ticket-filters'],
      reactTargets: ['features/client-portal/components/ClientTicketRangeFilter.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['range filter exists; remaining legacy filter block details still need audit']
    },
    {
      feature: 'client-social',
      legacyScreen: 'clientSocial',
      legacyIds: ['#social-platform-filter', '#social-status-filter'],
      reactTargets: ['features/client-social/components/ClientSocialFilterPanel.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['filters exist; final exact parity still pending']
    },
    {
      feature: 'management-dashboard',
      legacyScreen: 'overview + explorers',
      legacyIds: ['#start-date', '#end-date', '#global-search', '#status-list', '#ux-user-selector', '#cx-client-selector'],
      reactTargets: [
        'features/management-dashboard/components/OverviewDashboardSection.jsx',
        'features/management-dashboard/components/UserExplorerSection.jsx',
        'features/management-dashboard/components/ClientExplorerSection.jsx'
      ],
      status: 'implemented with parity gaps',
      parityNotes: ['major filters exist in sections; status multiselect and exact explorer controls still need parity']
    }
  ],
  modals: [
    {
      feature: 'auth',
      legacyScreen: 'login',
      legacyIds: ['#change-password-modal'],
      reactTargets: ['components/modals/AppModal.jsx', 'pending auth password dialog'],
      status: 'not fully migrated',
      parityNotes: ['change-password modal is still missing as a dedicated React-owned surface']
    },
    {
      feature: 'tickets',
      legacyScreen: 'tickets',
      legacyIds: ['ticket close/update Swal', 'assign/reassign Swal', 'schedule update Swal', 'client response Swal', 'ticket chat Swal'],
      reactTargets: ['pending ticket dialog components under features/tickets/components + components/modals'],
      status: 'not fully migrated',
      parityNotes: ['employee ticket dialogs remain one of the biggest React parity gaps']
    },
    {
      feature: 'fms',
      legacyScreen: 'fms',
      legacyIds: ['#fms-form-modal', 'FMS completion Swal'],
      reactTargets: ['pending dedicated FMS modal/dialog layer'],
      status: 'partially migrated',
      parityNotes: ['FMS page exists, but legacy modal workflows are not fully React-owned']
    },
    {
      feature: 'approvals',
      legacyScreen: 'approvals',
      legacyIds: ['approval remarks Swal', 'attendance correction Swal', 'transfer approval Swal'],
      reactTargets: ['pending approval dialogs under features/approvals/components + components/modals'],
      status: 'not fully migrated',
      parityNotes: ['approval tables exist, but critical action dialogs remain to be rebuilt']
    },
    {
      feature: 'forms-portal',
      legacyScreen: 'formsPortal',
      legacyIds: ['forms editor/access Swal'],
      reactTargets: ['features/forms-portal/components/FormsPortalEditor.jsx', 'pending dedicated access dialog'],
      status: 'partially migrated',
      parityNotes: ['editor exists, selected-user access dialog still needs dedicated parity component']
    },
    {
      feature: 'clients-portal',
      legacyScreen: 'clientsPortalAdmin',
      legacyIds: ['client details Swal', 'client editor Swal'],
      reactTargets: ['features/clients-portal/components/ClientDetailsCard.jsx', 'features/clients-portal/components/ClientEditor.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['detail and editor surfaces exist but still need exact popup parity']
    },
    {
      feature: 'client-portal',
      legacyScreen: 'clientTickets',
      legacyIds: ['ticket details Swal', 'client response Swal', 'chat modal'],
      reactTargets: [
        'features/client-portal/components/ClientTicketDetailsDialog.jsx',
        'features/client-portal/components/ClientTicketResponseDialog.jsx',
        'features/client-portal/components/ClientTicketChatDialog.jsx'
      ],
      status: 'implemented with parity gaps',
      parityNotes: ['client ticket dialogs are among the strongest migrated modal surfaces, but still need final parity polish']
    },
    {
      feature: 'client-social',
      legacyScreen: 'clientSocial',
      legacyIds: ['social details Swal'],
      reactTargets: ['features/client-social/components/ClientSocialDetailsPanel.jsx'],
      status: 'implemented with parity gaps',
      parityNotes: ['details surface exists; exact popup/history/action presentation still needs parity']
    },
    {
      feature: 'management-dashboard',
      legacyScreen: 'batchAssignmentModal',
      legacyIds: ['#batch-modal'],
      reactTargets: ['features/management-dashboard/components/BatchAssignmentPlanner.jsx'],
      status: 'partially migrated',
      parityNotes: ['planner shell exists, exact modal/save-flow parity is still incomplete']
    },
    {
      feature: 'shell',
      legacyScreen: 'sharedShell',
      legacyIds: ['#notification-popup-container', '#notification-panel'],
      reactTargets: ['pending notification drawer/popup components'],
      status: 'not fully migrated',
      parityNotes: ['notification popup/panel remains a shared shell-level parity gap']
    }
  ],
  scripts: [
    {
      feature: 'dashboard',
      legacyScreen: 'dashboard',
      legacyFunctions: ['getDashboardData', 'getKpiDetails'],
      reactTargets: ['features/dashboard/api.js', 'features/dashboard/useDashboardData.js', 'pending KPI detail loader path'],
      status: 'partially migrated',
      parityNotes: ['main dashboard data path exists; KPI detail path still needs full React ownership']
    },
    {
      feature: 'attendance',
      legacyScreen: 'attendance',
      legacyFunctions: ['recordAttendance', 'getAttendanceForUser', 'submitLeaveRequest', 'submitIntimation', 'getUserRequestStatus'],
      reactTargets: ['features/attendance/api.js', 'features/attendance/useAttendanceData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['live API integration exists; some UI ownership details still need parity work']
    },
    {
      feature: 'tickets',
      legacyScreen: 'tickets',
      legacyFunctions: ['getTicketSystemData', 'createTicketInSheet', 'createBulkTicketsInSheet', 'updateTicketInSheet', 'reassignTicket', 'updateTicketSchedule', 'processClientResponse', 'getMessagesForTask', 'postMessage'],
      reactTargets: ['features/tickets/api.js', 'features/tickets/useTicketSystemData.js'],
      status: 'partially migrated',
      parityNotes: ['core data path exists; several legacy actions still lack full React-owned dialog flows']
    },
    {
      feature: 'fms',
      legacyScreen: 'fms',
      legacyFunctions: ['getFmsTasksForApp', 'markFmsTaskDoneInApp'],
      reactTargets: ['features/fms/api.js', 'features/fms/useFmsData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['live data path exists; exact modal/open behavior still pending']
    },
    {
      feature: 'approvals',
      legacyScreen: 'approvals',
      legacyFunctions: ['getPendingApprovals', 'processAdminAction', 'transferTicketApproval'],
      reactTargets: ['features/approvals/api.js', 'features/approvals/useApprovalsData.js'],
      status: 'partially migrated',
      parityNotes: ['data path exists; action dialogs and final flow parity still pending']
    },
    {
      feature: 'forms-portal',
      legacyScreen: 'formsPortal',
      legacyFunctions: ['getFormsData', 'saveFormsPortalData', 'deleteFormsPortalData'],
      reactTargets: ['features/forms-portal/api.js', 'features/forms-portal/useFormsPortalData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['live forms data path exists; final admin access-management parity still pending']
    },
    {
      feature: 'clients-portal',
      legacyScreen: 'clientsPortalAdmin',
      legacyFunctions: ['getClientsPortalData', 'saveClientPortalData', 'deleteClientPortalData'],
      reactTargets: ['features/clients-portal/api.js', 'features/clients-portal/useClientsPortalData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['live admin clients data path exists; exact details/edit parity still pending']
    },
    {
      feature: 'todo',
      legacyScreen: 'todo',
      legacyFunctions: ['getTodos', 'addTodo', 'toggleTodoStatus', 'editTodoItem', 'deleteTodoItem', 'addBulkTodos'],
      reactTargets: ['features/todo/api.js', 'features/todo/useTodoData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['live CRUD exists; embedded-portal parity still needs final review']
    },
    {
      feature: 'expenses',
      legacyScreen: 'expenses',
      legacyFunctions: ['submitExpense', 'getExpensesForUser'],
      reactTargets: ['features/expenses/api.js', 'features/expenses/useExpensesData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['live expense data path exists; receipt-preview parity still pending']
    },
    {
      feature: 'reports',
      legacyScreen: 'reports',
      legacyFunctions: ['getAdminReports', 'exportReportForWeb'],
      reactTargets: ['features/reports/api.js', 'features/reports/useReportsData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['reports data and export path exist; exact UI/export parity still pending']
    },
    {
      feature: 'admin',
      legacyScreen: 'empMaster + users',
      legacyFunctions: ['getEmpMasterData', 'saveEmpMasterDataWithFiles', 'getUsers', 'saveOrUpdateUser'],
      reactTargets: ['features/admin/api.js', 'features/admin/useAdminData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['live admin data path exists; exact editor/upload/access parity remains']
    },
    {
      feature: 'auth',
      legacyScreen: 'employee + client login',
      legacyFunctions: ['authenticateUser', 'changeUserPassword', 'clientAuthenticate'],
      reactTargets: ['features/auth/api.js', 'features/auth/AuthProvider.jsx', 'features/auth/ClientAuthProvider.jsx'],
      status: 'partially migrated',
      parityNotes: ['login paths exist; change-password UI parity still pending']
    },
    {
      feature: 'client-portal',
      legacyScreen: 'client dashboard/tickets/invoices/reports',
      legacyFunctions: [
        'getClientDashboardData',
        'createBulkTicketsWithDetails',
        'getClientTickets',
        'updateTicketStatusByClient',
        'submitClientResponse',
        'getClientInvoices',
        'getClientReportData'
      ],
      reactTargets: ['features/client-portal/api.js', 'features/client-portal/useClientDashboardData.js', 'features/client-portal/useClientTicketWorkspace.js', 'features/client-portal/useClientInvoicesData.js', 'features/client-portal/useClientReportsData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['strongest client-side migration area; dashboard drilldowns and report parity still pending']
    },
    {
      feature: 'client-social',
      legacyScreen: 'clientSocial',
      legacyFunctions: ['getClientSocialTasks', 'updateSocialPostStatusByClient', 'addClientRemarkToHistoryEntry'],
      reactTargets: ['features/client-social/api.js', 'features/client-social/useClientSocialData.js'],
      status: 'implemented with parity gaps',
      parityNotes: ['live client social flow exists; full popup/shell parity still pending']
    },
    {
      feature: 'management-dashboard',
      legacyScreen: 'overview + explorers + batch',
      legacyFunctions: ['getDashboardData', 'batch assignment handlers'],
      reactTargets: ['features/management-dashboard/api.js', 'features/management-dashboard/useManagementDashboardData.js', 'features/management-dashboard/components/BatchAssignmentPlanner.jsx'],
      status: 'partially migrated',
      parityNotes: ['major data path exists; batch modal/save flow and final drilldowns still pending']
    }
  ]
};
