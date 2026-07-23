export const reactModuleOwnershipMatrix = {
  employeePortal: [
    {
      legacyScreen: 'login',
      route: '/',
      pageFile: 'features/auth/LoginPage.jsx',
      stateOwner: ['features/auth/AuthProvider.jsx'],
      dataOwner: ['features/auth/api.js', 'features/auth/services/sessionPersistence.js'],
      componentFiles: [
        'features/auth/components/LoginShell.jsx',
        'features/auth/components/EmployeeLoginForm.jsx',
        'features/auth/components/AuthErrorBanner.jsx',
        'features/auth/components/SessionStatusScreen.jsx'
      ],
      surfaceOwnership: {
        layout: ['components/layout/AppShell.jsx'],
        forms: ['features/auth/components/EmployeeLoginForm.jsx'],
        modals: ['components/modals/AppModal.jsx', 'pending feature-level password dialog']
      },
      remainingParity: ['legacy password-change modal', 'exact login visual parity', 'legacy validation copy/timing']
    },
    {
      legacyScreen: 'dashboard',
      route: '/dashboard',
      pageFile: 'features/dashboard/DashboardPage.jsx',
      stateOwner: ['features/dashboard/useDashboardData.js'],
      dataOwner: ['features/dashboard/api.js', 'features/dashboard/services/dashboardPresentation.js'],
      componentFiles: [
        'features/dashboard/components/DashboardHeader.jsx',
        'features/dashboard/components/DashboardKpiGrid.jsx',
        'features/dashboard/components/DashboardMiniStats.jsx',
        'features/dashboard/components/DashboardChartsSection.jsx',
        'features/dashboard/components/DashboardTasksSection.jsx'
      ],
      surfaceOwnership: {
        tabs: ['features/dashboard/components/DashboardHeader.jsx'],
        filters: ['features/dashboard/components/DashboardHeader.jsx'],
        tables: ['features/dashboard/components/DashboardTasksSection.jsx', 'components/tables/DataTableShell.jsx'],
        charts: ['features/dashboard/components/DashboardChartsSection.jsx'],
        modals: ['pending KPI detail dialog/panel']
      },
      remainingParity: ['KPI drilldown table', 'legacy task grid spacing', 'exact chart/table interactions']
    },
    {
      legacyScreen: 'attendance',
      route: '/attendance',
      pageFile: 'features/attendance/AttendancePage.jsx',
      stateOwner: ['features/attendance/useAttendanceData.js'],
      dataOwner: ['features/attendance/api.js', 'features/attendance/services/attendancePresentation.js'],
      componentFiles: [
        'features/attendance/components/AttendanceHeader.jsx',
        'features/attendance/components/AttendanceActionRow.jsx',
        'features/attendance/components/AttendanceEntryPanel.jsx',
        'features/attendance/components/AttendanceRangeToolbar.jsx',
        'features/attendance/components/AttendanceTables.jsx',
        'features/attendance/components/AttendanceSummaryStats.jsx'
      ],
      surfaceOwnership: {
        tabs: ['features/attendance/components/AttendanceEntryPanel.jsx'],
        filters: ['features/attendance/components/AttendanceRangeToolbar.jsx'],
        forms: ['features/attendance/components/AttendanceEntryPanel.jsx'],
        tables: ['features/attendance/components/AttendanceTables.jsx'],
        media: ['features/attendance/components/AttendanceEntryPanel.jsx'],
        modals: ['pending React-native secure camera/passwordless capture flow if popup is removed']
      },
      remainingParity: ['exact camera capture workflow', 'leave/intimation modal parity', 'attendance request-history handling']
    },
    {
      legacyScreen: 'tickets',
      route: '/tickets',
      pageFile: 'features/tickets/TicketSystemPage.jsx',
      stateOwner: ['features/tickets/useTicketSystemData.js'],
      dataOwner: ['features/tickets/api.js', 'features/tickets/services/ticketPresentation.js'],
      componentFiles: [
        'features/tickets/components/TicketHeader.jsx',
        'features/tickets/components/TicketFilterPanel.jsx',
        'features/tickets/components/TicketCreateForm.jsx',
        'features/tickets/components/TicketTable.jsx'
      ],
      surfaceOwnership: {
        tabs: ['pending dedicated TicketTabs component'],
        filters: ['features/tickets/components/TicketFilterPanel.jsx'],
        forms: ['features/tickets/components/TicketCreateForm.jsx'],
        tables: ['features/tickets/components/TicketTable.jsx', 'components/tables/DataTableShell.jsx'],
        modals: ['pending ticket detail/status/assignment/schedule/chat dialogs']
      },
      remainingParity: ['all Swal-owned dialogs', 'exact action cell parity', 'team/my tab parity', 'chat/message workflow ownership']
    },
    {
      legacyScreen: 'fms',
      route: '/fms',
      pageFile: 'features/fms/FmsPage.jsx',
      stateOwner: ['features/fms/useFmsData.js'],
      dataOwner: ['features/fms/api.js', 'features/fms/services/fmsPresentation.js'],
      componentFiles: [
        'features/fms/components/FmsHeader.jsx',
        'features/fms/components/FmsTabsPanel.jsx',
        'features/fms/components/FmsFilterPanel.jsx',
        'features/fms/components/FmsTaskTable.jsx'
      ],
      surfaceOwnership: {
        tabs: ['features/fms/components/FmsTabsPanel.jsx'],
        filters: ['features/fms/components/FmsFilterPanel.jsx'],
        tables: ['features/fms/components/FmsTaskTable.jsx', 'components/tables/DataTableShell.jsx'],
        modals: ['pending FMS form/open dialog parity']
      },
      remainingParity: ['external form modal behavior', 'done confirmation flow', 'my/team visibility logic audit']
    },
    {
      legacyScreen: 'approvals',
      route: '/approvals',
      pageFile: 'features/approvals/ApprovalsPage.jsx',
      stateOwner: ['features/approvals/useApprovalsData.js'],
      dataOwner: ['features/approvals/api.js', 'features/approvals/services/approvalsPresentation.js'],
      componentFiles: [
        'features/approvals/components/ApprovalsHeader.jsx',
        'features/approvals/components/ApprovalsTabsAndFilters.jsx',
        'features/approvals/components/TicketApprovalTable.jsx',
        'features/approvals/components/GenericApprovalTables.jsx'
      ],
      surfaceOwnership: {
        tabs: ['features/approvals/components/ApprovalsTabsAndFilters.jsx'],
        filters: ['features/approvals/components/ApprovalsTabsAndFilters.jsx'],
        tables: ['features/approvals/components/TicketApprovalTable.jsx', 'features/approvals/components/GenericApprovalTables.jsx'],
        modals: ['pending remarks/rework/attendance-correction/transfer dialogs']
      },
      remainingParity: ['approval action dialogs', 'header filter behavior', 'exact multi-table DataTables parity']
    },
    {
      legacyScreen: 'formsPortal',
      route: '/forms-portal',
      pageFile: 'features/forms-portal/FormsPortalPage.jsx',
      stateOwner: ['features/forms-portal/useFormsPortalData.js'],
      dataOwner: ['features/forms-portal/api.js', 'features/forms-portal/services/formsPresentation.js'],
      componentFiles: [
        'features/forms-portal/components/FormsPortalHeader.jsx',
        'features/forms-portal/components/FormsPortalFilterPanel.jsx',
        'features/forms-portal/components/FormsPortalTable.jsx',
        'features/forms-portal/components/FormsPortalEditor.jsx'
      ],
      surfaceOwnership: {
        filters: ['features/forms-portal/components/FormsPortalFilterPanel.jsx'],
        tables: ['features/forms-portal/components/FormsPortalTable.jsx', 'components/tables/DataTableShell.jsx'],
        forms: ['features/forms-portal/components/FormsPortalEditor.jsx'],
        modals: ['features/forms-portal/components/FormsPortalEditor.jsx', 'pending dedicated access dialog component']
      },
      remainingParity: ['exact admin access-assignment dialog', 'open form iframe/new-tab logic hardening', 'selected-user summary polish']
    },
    {
      legacyScreen: 'clientsPortalAdmin',
      route: '/clients-portal',
      pageFile: 'features/clients-portal/ClientsPortalPage.jsx',
      stateOwner: ['features/clients-portal/useClientsPortalData.js'],
      dataOwner: ['features/clients-portal/api.js', 'features/clients-portal/services/clientsPresentation.js'],
      componentFiles: [
        'features/clients-portal/components/ClientsPortalHeader.jsx',
        'features/clients-portal/components/ClientsPortalSummaryCards.jsx',
        'features/clients-portal/components/ClientsPortalFilterPanel.jsx',
        'features/clients-portal/components/ClientsPortalTable.jsx',
        'features/clients-portal/components/ClientDetailsCard.jsx',
        'features/clients-portal/components/ClientEditor.jsx'
      ],
      surfaceOwnership: {
        filters: ['features/clients-portal/components/ClientsPortalFilterPanel.jsx'],
        tables: ['features/clients-portal/components/ClientsPortalTable.jsx', 'components/tables/DataTableShell.jsx'],
        modals: ['features/clients-portal/components/ClientEditor.jsx', 'pending detail popup parity']
      },
      remainingParity: ['client detail popup parity', 'exact edit/deactivate flow parity']
    },
    {
      legacyScreen: 'todo',
      route: '/todo',
      pageFile: 'features/todo/TodoPage.jsx',
      stateOwner: ['features/todo/useTodoData.js'],
      dataOwner: ['features/todo/api.js', 'features/todo/services/todoPresentation.js'],
      componentFiles: [
        'features/todo/components/TodoHeader.jsx',
        'features/todo/components/TodoSummaryCards.jsx',
        'features/todo/components/TodoToolbar.jsx',
        'features/todo/components/TodoFormPanel.jsx',
        'features/todo/components/TodoTable.jsx'
      ],
      surfaceOwnership: {
        filters: ['features/todo/components/TodoToolbar.jsx'],
        forms: ['features/todo/components/TodoFormPanel.jsx'],
        tables: ['features/todo/components/TodoTable.jsx', 'components/tables/DataTableShell.jsx'],
        modals: ['pending edit/delete confirmation parity']
      },
      remainingParity: ['legacy embedded behavior audit', 'bulk row-builder parity']
    },
    {
      legacyScreen: 'expenses',
      route: '/expenses',
      pageFile: 'features/expenses/ExpensesPage.jsx',
      stateOwner: ['features/expenses/useExpensesData.js'],
      dataOwner: ['features/expenses/api.js', 'features/expenses/services/expensesPresentation.js'],
      componentFiles: [
        'features/expenses/components/ExpensesHeader.jsx',
        'features/expenses/components/ExpensesSummaryCards.jsx',
        'features/expenses/components/ExpenseFormPanel.jsx',
        'features/expenses/components/ExpensesHistoryTable.jsx'
      ],
      surfaceOwnership: {
        forms: ['features/expenses/components/ExpenseFormPanel.jsx'],
        tables: ['features/expenses/components/ExpensesHistoryTable.jsx', 'components/tables/DataTableShell.jsx'],
        modals: ['pending receipt preview dialog']
      },
      remainingParity: ['receipt preview UX', 'exact feedback/toast parity']
    },
    {
      legacyScreen: 'reports',
      route: '/reports',
      pageFile: 'features/reports/ReportsPage.jsx',
      stateOwner: ['features/reports/useReportsData.js'],
      dataOwner: ['features/reports/api.js', 'features/reports/services/reportsPresentation.js'],
      componentFiles: [
        'features/reports/components/ReportsHeader.jsx',
        'features/reports/components/ReportsToolbar.jsx',
        'features/reports/components/ReportsSummaryCards.jsx',
        'features/reports/components/TicketReportSection.jsx',
        'features/reports/components/FmsReportSection.jsx'
      ],
      surfaceOwnership: {
        tabs: ['features/reports/components/ReportsHeader.jsx'],
        filters: ['features/reports/components/ReportsToolbar.jsx'],
        tables: ['features/reports/components/TicketReportSection.jsx', 'features/reports/components/FmsReportSection.jsx', 'components/tables/DataTableShell.jsx'],
        charts: ['pending shared chart wrappers if needed'],
        actions: ['features/reports/components/ReportsToolbar.jsx']
      },
      remainingParity: ['range-dropdown parity', 'export/print behavior parity', 'exact table controls']
    },
    {
      legacyScreen: 'empMaster',
      route: '/admin?tab=emp-master',
      pageFile: 'features/admin/AdminPage.jsx',
      stateOwner: ['features/admin/useAdminData.js'],
      dataOwner: ['features/admin/api.js', 'features/admin/services/adminPresentation.js'],
      componentFiles: [
        'features/admin/components/AdminHeader.jsx',
        'features/admin/components/AdminTabsAndFilters.jsx',
        'features/admin/components/AdminSummaryCards.jsx',
        'features/admin/components/AdminEmpMasterTable.jsx',
        'features/admin/components/AdminEditor.jsx'
      ],
      surfaceOwnership: {
        filters: ['features/admin/components/AdminTabsAndFilters.jsx'],
        tables: ['features/admin/components/AdminEmpMasterTable.jsx', 'components/tables/DataTableShell.jsx'],
        forms: ['features/admin/components/AdminEditor.jsx']
      },
      remainingParity: ['upload/edit flow parity', 'category/workflow details']
    },
    {
      legacyScreen: 'users',
      route: '/admin?tab=users',
      pageFile: 'features/admin/AdminPage.jsx',
      stateOwner: ['features/admin/useAdminData.js'],
      dataOwner: ['features/admin/api.js', 'features/admin/services/adminPresentation.js'],
      componentFiles: [
        'features/admin/components/AdminHeader.jsx',
        'features/admin/components/AdminTabsAndFilters.jsx',
        'features/admin/components/AdminUsersTable.jsx',
        'features/admin/components/AdminEditor.jsx'
      ],
      surfaceOwnership: {
        filters: ['features/admin/components/AdminTabsAndFilters.jsx'],
        tables: ['features/admin/components/AdminUsersTable.jsx', 'components/tables/DataTableShell.jsx'],
        forms: ['features/admin/components/AdminEditor.jsx']
      },
      remainingParity: ['exact role/access editor parity', 'table action details']
    }
  ],
  clientPortal: [
    {
      legacyScreen: 'clientLogin',
      route: '/client/login',
      pageFile: 'features/auth/ClientLoginPage.jsx',
      stateOwner: ['features/auth/ClientAuthProvider.jsx'],
      dataOwner: ['features/auth/api.js', 'features/auth/services/clientSessionPersistence.js'],
      componentFiles: [
        'features/auth/components/LoginShell.jsx',
        'features/auth/components/ClientLoginForm.jsx',
        'features/auth/components/AuthErrorBanner.jsx'
      ],
      surfaceOwnership: {
        forms: ['features/auth/components/ClientLoginForm.jsx'],
        layout: ['components/layout/ClientShell.jsx']
      },
      remainingParity: ['exact legacy login screen styling and messaging']
    },
    {
      legacyScreen: 'clientDashboard',
      route: '/client/dashboard',
      pageFile: 'features/client-portal/ClientDashboardPage.jsx',
      stateOwner: ['features/client-portal/useClientDashboardData.js'],
      dataOwner: ['features/client-portal/api.js', 'features/client-portal/services/clientPortalPresentation.js'],
      componentFiles: [
        'features/client-portal/components/ClientPortalHeader.jsx',
        'features/client-portal/components/ClientDashboardKpiGrid.jsx',
        'features/client-portal/components/ClientDashboardStatusPanel.jsx',
        'features/client-portal/components/ClientDashboardActivityChart.jsx',
        'features/client-portal/components/ClientDashboardActionList.jsx',
        'features/client-portal/components/ClientDashboardRecentActivity.jsx'
      ],
      surfaceOwnership: {
        charts: ['features/client-portal/components/ClientDashboardStatusPanel.jsx', 'features/client-portal/components/ClientDashboardActivityChart.jsx'],
        tables: ['pending KPI filtered table panel'],
        notifications: ['pending upgraded client notification drawer/panel']
      },
      remainingParity: ['KPI drilldown table/panel', 'legacy notification UX', 'micro-layout parity']
    },
    {
      legacyScreen: 'clientTickets',
      route: '/client/tickets',
      pageFile: 'features/client-portal/ClientTicketsPage.jsx',
      stateOwner: ['features/client-portal/useClientTicketWorkspace.js', 'features/client-portal/useClientTicketsData.js'],
      dataOwner: ['features/client-portal/api.js', 'features/client-portal/services/clientTicketWorkspace.js'],
      componentFiles: [
        'features/client-portal/components/ClientTicketModeTabs.jsx',
        'features/client-portal/components/ClientTicketStatusTabs.jsx',
        'features/client-portal/components/ClientTicketRangeFilter.jsx',
        'features/client-portal/components/ClientTicketTable.jsx',
        'features/client-portal/components/ClientTicketComposer.jsx',
        'features/client-portal/components/ClientTicketDetailsDialog.jsx',
        'features/client-portal/components/ClientTicketResponseDialog.jsx',
        'features/client-portal/components/ClientTicketChatDialog.jsx'
      ],
      surfaceOwnership: {
        tabs: ['features/client-portal/components/ClientTicketModeTabs.jsx', 'features/client-portal/components/ClientTicketStatusTabs.jsx'],
        filters: ['features/client-portal/components/ClientTicketRangeFilter.jsx'],
        tables: ['features/client-portal/components/ClientTicketTable.jsx', 'components/tables/DataTableShell.jsx'],
        forms: ['features/client-portal/components/ClientTicketComposer.jsx'],
        modals: [
          'features/client-portal/components/ClientTicketDetailsDialog.jsx',
          'features/client-portal/components/ClientTicketResponseDialog.jsx',
          'features/client-portal/components/ClientTicketChatDialog.jsx'
        ]
      },
      remainingParity: ['checklist/social sub-surfaces integration', 'final action parity', 'exact legacy visuals']
    },
    {
      legacyScreen: 'clientInvoices',
      route: '/client/invoices',
      pageFile: 'features/client-portal/ClientInvoicesPage.jsx',
      stateOwner: ['features/client-portal/useClientInvoicesData.js'],
      dataOwner: ['features/client-portal/api.js', 'features/client-portal/services/clientPortalPresentation.js'],
      componentFiles: [
        'features/client-portal/components/ClientInvoiceStatusTabs.jsx',
        'features/client-portal/components/ClientInvoiceTable.jsx'
      ],
      surfaceOwnership: {
        tabs: ['features/client-portal/components/ClientInvoiceStatusTabs.jsx'],
        tables: ['features/client-portal/components/ClientInvoiceTable.jsx', 'components/tables/DataTableShell.jsx']
      },
      remainingParity: ['exact tab/table styling parity', 'final invoice actions if any']
    },
    {
      legacyScreen: 'clientReports',
      route: '/client/reports',
      pageFile: 'features/client-portal/ClientReportsPage.jsx',
      stateOwner: ['features/client-portal/useClientReportsData.js'],
      dataOwner: ['features/client-portal/api.js', 'features/client-portal/services/clientPortalPresentation.js'],
      componentFiles: ['features/client-portal/components/ClientReportTable.jsx'],
      surfaceOwnership: {
        filters: ['pending dedicated client report filters component'],
        tables: ['features/client-portal/components/ClientReportTable.jsx', 'components/tables/DataTableShell.jsx'],
        charts: ['pending client report chart components']
      },
      remainingParity: ['report filter block', 'distribution/completion charts', 'export behavior']
    },
    {
      legacyScreen: 'clientSocial',
      route: '/client/social',
      pageFile: 'features/client-social/ClientSocialPage.jsx',
      stateOwner: ['features/client-social/useClientSocialData.js'],
      dataOwner: ['features/client-social/api.js', 'features/client-social/services/clientSocialPresentation.js'],
      componentFiles: [
        'features/client-social/components/ClientSocialHeader.jsx',
        'features/client-social/components/ClientSocialSummaryCards.jsx',
        'features/client-social/components/ClientSocialFilterPanel.jsx',
        'features/client-social/components/ClientSocialTable.jsx',
        'features/client-social/components/ClientSocialDetailsPanel.jsx'
      ],
      surfaceOwnership: {
        filters: ['features/client-social/components/ClientSocialFilterPanel.jsx'],
        tables: ['features/client-social/components/ClientSocialTable.jsx', 'components/tables/DataTableShell.jsx'],
        modals: ['features/client-social/components/ClientSocialDetailsPanel.jsx']
      },
      remainingParity: ['full client shell/nav integration', 'legacy detail popup parity']
    }
  ],
  managementDashboard: [
    {
      legacyScreen: 'overviewDashboard',
      route: '/management-dashboard?tab=overview',
      pageFile: 'features/management-dashboard/ManagementDashboardPage.jsx',
      stateOwner: ['features/management-dashboard/useManagementDashboardData.js'],
      dataOwner: ['features/management-dashboard/api.js', 'features/management-dashboard/services/managementDashboardPresentation.js'],
      componentFiles: [
        'features/management-dashboard/components/ManagementDashboardHeader.jsx',
        'features/management-dashboard/components/ManagementDashboardTabs.jsx',
        'features/management-dashboard/components/OverviewDashboardSection.jsx'
      ],
      surfaceOwnership: {
        tabs: ['features/management-dashboard/components/ManagementDashboardTabs.jsx'],
        filters: ['features/management-dashboard/components/OverviewDashboardSection.jsx'],
        tables: ['features/management-dashboard/components/OverviewDashboardSection.jsx', 'components/tables/DataTableShell.jsx'],
        charts: ['features/management-dashboard/components/OverviewDashboardSection.jsx']
      },
      remainingParity: ['overview drilldowns', 'status multiselect parity', 'exact table/chart density']
    },
    {
      legacyScreen: 'userExplorer',
      route: '/management-dashboard?tab=user-explorer',
      pageFile: 'features/management-dashboard/ManagementDashboardPage.jsx',
      stateOwner: ['features/management-dashboard/useManagementDashboardData.js'],
      dataOwner: ['features/management-dashboard/api.js', 'features/management-dashboard/services/managementDashboardPresentation.js'],
      componentFiles: ['features/management-dashboard/components/UserExplorerSection.jsx'],
      surfaceOwnership: {
        filters: ['features/management-dashboard/components/UserExplorerSection.jsx'],
        tables: ['features/management-dashboard/components/UserExplorerSection.jsx', 'components/tables/DataTableShell.jsx']
      },
      remainingParity: ['child-row behavior', 'exact explorer drilldowns']
    },
    {
      legacyScreen: 'clientExplorer',
      route: '/management-dashboard?tab=client-explorer',
      pageFile: 'features/management-dashboard/ManagementDashboardPage.jsx',
      stateOwner: ['features/management-dashboard/useManagementDashboardData.js'],
      dataOwner: ['features/management-dashboard/api.js', 'features/management-dashboard/services/managementDashboardPresentation.js'],
      componentFiles: ['features/management-dashboard/components/ClientExplorerSection.jsx'],
      surfaceOwnership: {
        filters: ['features/management-dashboard/components/ClientExplorerSection.jsx'],
        tables: ['features/management-dashboard/components/ClientExplorerSection.jsx', 'components/tables/DataTableShell.jsx'],
        charts: ['features/management-dashboard/components/ClientExplorerSection.jsx']
      },
      remainingParity: ['task/bandwidth subtable parity', 'effort analytics parity']
    },
    {
      legacyScreen: 'batchAssignmentModal',
      route: '/management-dashboard',
      pageFile: 'features/management-dashboard/ManagementDashboardPage.jsx',
      stateOwner: ['features/management-dashboard/useManagementDashboardData.js'],
      dataOwner: ['features/management-dashboard/api.js'],
      componentFiles: ['features/management-dashboard/components/BatchAssignmentPlanner.jsx'],
      surfaceOwnership: {
        forms: ['features/management-dashboard/components/BatchAssignmentPlanner.jsx'],
        modals: ['features/management-dashboard/components/BatchAssignmentPlanner.jsx']
      },
      remainingParity: ['real modal ownership', 'submit/save flow parity']
    }
  ]
};
