export const legacySelectorRegistry = {
  sharedShell: [
    {
      legacySelector: '#sidebar',
      legacySource: ['appscript/index.html', 'appscript/client-index.html'],
      surface: 'primary sidebar shell',
      reactTargets: ['components/layout/AppShell.jsx', 'components/layout/ClientShell.jsx'],
      currentStatus: 'implemented in React shell',
      parityNotes: ['badge counters and exact mobile collapse behavior still need final parity audit']
    },
    {
      legacySelector: '#app-header-bar',
      legacySource: ['appscript/index.html'],
      surface: 'employee/admin top header',
      reactTargets: ['components/layout/AppShell.jsx'],
      currentStatus: 'implemented in React shell',
      parityNotes: ['exact icon spacing and right-side interactions still need visual audit']
    },
    {
      legacySelector: '#notification-bell-btn',
      legacySource: ['appscript/index.html', 'appscript/client-index.html'],
      surface: 'notification trigger button',
      reactTargets: ['components/common/UserProfileMenu.jsx', 'pending feature-level notification drawer'],
      currentStatus: 'partially implemented',
      parityNotes: ['bell exists in shell, but legacy popup/drawer behavior is not fully React-owned yet']
    },
    {
      legacySelector: '#notification-popup-container',
      legacySource: ['appscript/index.html'],
      surface: 'employee/admin notification popup',
      reactTargets: ['pending React notification popup/drawer component'],
      currentStatus: 'not fully migrated',
      parityNotes: ['legacy unread list rendering and popup ownership still remain']
    },
    {
      legacySelector: '#notification-panel',
      legacySource: ['appscript/client-index.html'],
      surface: 'client notification panel',
      reactTargets: ['pending client notification drawer/panel'],
      currentStatus: 'not fully migrated',
      parityNotes: ['client bell/panel still needs exact React ownership']
    },
    {
      legacySelector: '#change-password-modal',
      legacySource: ['appscript/index.html'],
      surface: 'change password modal',
      reactTargets: ['components/modals/AppModal.jsx', 'pending auth password dialog'],
      currentStatus: 'not fully migrated',
      parityNotes: ['shell supports password action area, but legacy modal itself is not rebuilt yet']
    }
  ],
  employeeAdmin: [
    {
      legacySelector: '#attendance-view',
      legacySource: ['appscript/index.html'],
      surface: 'attendance screen container',
      reactTargets: ['features/attendance/AttendancePage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['request-history surface and camera workflow still need final parity check']
    },
    {
      legacySelector: '#attendance-history-table',
      legacySource: ['appscript/index.html'],
      surface: 'attendance log DataTable',
      reactTargets: ['features/attendance/components/AttendanceTables.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['exact DataTables control layout and row renderer details still need audit']
    },
    {
      legacySelector: '#ticket-system-view',
      legacySource: ['appscript/index.html'],
      surface: 'ticket system screen container',
      reactTargets: ['features/tickets/TicketSystemPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['team/my tab logic and action dialogs still incomplete']
    },
    {
      legacySelector: '#ticket-table',
      legacySource: ['appscript/index.html'],
      surface: 'employee ticket table',
      reactTargets: ['features/tickets/components/TicketTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['legacy action-cell behaviors and detail/chat/schedule dialogs still pending']
    },
    {
      legacySelector: '#table-fms-main',
      legacySource: ['appscript/index.html'],
      surface: 'main FMS table',
      reactTargets: ['features/fms/components/FmsTaskTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['legacy form-open and done-flow interactions still need full parity']
    },
    {
      legacySelector: '#approvals-view',
      legacySource: ['appscript/index.html'],
      surface: 'approvals screen container',
      reactTargets: ['features/approvals/ApprovalsPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['approval dialog workflows still need final migration']
    },
    {
      legacySelector: '#table-approve-tickets',
      legacySource: ['appscript/index.html'],
      surface: 'ticket approvals table',
      reactTargets: ['features/approvals/components/TicketApprovalTable.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['header filters and rework/transfer flows still need exact parity']
    },
    {
      legacySelector: '#table-approve-leaves',
      legacySource: ['appscript/index.html'],
      surface: 'leave approvals table',
      reactTargets: ['features/approvals/components/GenericApprovalTables.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['legacy DataTables filtering and action-confirm UX still need parity audit']
    },
    {
      legacySelector: '#table-approve-intimations',
      legacySource: ['appscript/index.html'],
      surface: 'intimation approvals table',
      reactTargets: ['features/approvals/components/GenericApprovalTables.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['legacy row action details and filter behavior still need parity audit']
    },
    {
      legacySelector: '#table-approve-attendance',
      legacySource: ['appscript/index.html'],
      surface: 'attendance approvals table',
      reactTargets: ['features/approvals/components/GenericApprovalTables.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['attendance correction dialog parity is still pending']
    },
    {
      legacySelector: '#forms-view',
      legacySource: ['appscript/index.html'],
      surface: 'forms portal screen container',
      reactTargets: ['features/forms-portal/FormsPortalPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['open-form behavior and access-management modal still need hardening']
    },
    {
      legacySelector: '#table-forms-portal',
      legacySource: ['appscript/index.html'],
      surface: 'forms portal table',
      reactTargets: ['features/forms-portal/components/FormsPortalTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['exact DataTables control placement and access summary details still need visual parity']
    },
    {
      legacySelector: '#clients-view',
      legacySource: ['appscript/index.html'],
      surface: 'admin clients portal screen container',
      reactTargets: ['features/clients-portal/ClientsPortalPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['detail modal and edit/deactivate flows still need exact parity']
    },
    {
      legacySelector: '#table-clients-portal',
      legacySource: ['appscript/index.html'],
      surface: 'admin clients portal table',
      reactTargets: ['features/clients-portal/components/ClientsPortalTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['legacy ID-link click detail behavior still needs final audit']
    },
    {
      legacySelector: '#reports-view',
      legacySource: ['appscript/index.html'],
      surface: 'reports screen container',
      reactTargets: ['features/reports/ReportsPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['exact filter and export layout still needs parity work']
    },
    {
      legacySelector: '#report-table-tickets',
      legacySource: ['appscript/index.html'],
      surface: 'ticket report table',
      reactTargets: ['features/reports/components/TicketReportSection.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['search/export/print controls still need exact parity']
    },
    {
      legacySelector: '#report-table-fms',
      legacySource: ['appscript/index.html'],
      surface: 'FMS report table',
      reactTargets: ['features/reports/components/FmsReportSection.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['exact report controls and export layout still need parity']
    },
    {
      legacySelector: '#expense-view',
      legacySource: ['appscript/index.html'],
      surface: 'expenses screen container',
      reactTargets: ['features/expenses/ExpensesPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['receipt preview and exact in-panel form behavior still need parity']
    },
    {
      legacySelector: '#expense-history-table',
      legacySource: ['appscript/index.html'],
      surface: 'expense history table',
      reactTargets: ['features/expenses/components/ExpensesHistoryTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['receipt link/preview and control placement still need final audit']
    },
    {
      legacySelector: '#emp-master-view',
      legacySource: ['appscript/index.html'],
      surface: 'EMP master screen container',
      reactTargets: ['features/admin/AdminPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['exact tab routing and edit/upload workflow parity still pending']
    },
    {
      legacySelector: '#emp-master-table',
      legacySource: ['appscript/index.html'],
      surface: 'EMP master table',
      reactTargets: ['features/admin/components/AdminEmpMasterTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['file/upload-specific row actions still need parity audit']
    },
    {
      legacySelector: '#users-view',
      legacySource: ['appscript/index.html'],
      surface: 'users admin screen container',
      reactTargets: ['features/admin/AdminPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['exact user tab/filter behavior and modal parity still pending']
    },
    {
      legacySelector: '#users-table',
      legacySource: ['appscript/index.html'],
      surface: 'users table',
      reactTargets: ['features/admin/components/AdminUsersTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['role/access action details and control layout still need parity audit']
    },
    {
      legacySelector: '#todo-view',
      legacySource: ['appscript/index.html'],
      surface: 'todo workspace container',
      reactTargets: ['features/todo/TodoPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['embedded portal parity and bulk-entry behavior still need final audit']
    }
  ],
  client: [
    {
      legacySelector: '#dashboard-view',
      legacySource: ['appscript/client-index.html'],
      surface: 'client dashboard screen container',
      reactTargets: ['features/client-portal/ClientDashboardPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['KPI drilldown panel and notification UX still pending']
    },
    {
      legacySelector: '#client-ticket-table',
      legacySource: ['appscript/client-index.html'],
      surface: 'client tickets main table',
      reactTargets: ['features/client-portal/components/ClientTicketTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['legacy checklist/social auxiliary surfaces still need full integration audit']
    },
    {
      legacySelector: '#client-invoices-table',
      legacySource: ['appscript/client-index.html'],
      surface: 'client invoices table',
      reactTargets: ['features/client-portal/components/ClientInvoiceTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['exact wrapper control layout and status-tab polish still need audit']
    },
    {
      legacySelector: '#client-report-table',
      legacySource: ['appscript/client-index.html'],
      surface: 'client report table',
      reactTargets: ['features/client-portal/components/ClientReportTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['dedicated report filter/charts/export layer still pending']
    },
    {
      legacySelector: '#social-view',
      legacySource: ['appscript/client-index.html'],
      surface: 'client social screen container',
      reactTargets: ['features/client-social/ClientSocialPage.jsx'],
      currentStatus: 'implemented in React page',
      parityNotes: ['full client-shell integration and exact popup parity still pending']
    },
    {
      legacySelector: '#client-social-table',
      legacySource: ['appscript/client-index.html'],
      surface: 'client social table',
      reactTargets: ['features/client-social/components/ClientSocialTable.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React component',
      parityNotes: ['history/details dialog parity and exact action states still need audit']
    }
  ],
  management: [
    {
      legacySelector: '#tab-overview',
      legacySource: ['appscript/dashboard-index.html'],
      surface: 'management overview tab panel',
      reactTargets: ['features/management-dashboard/components/OverviewDashboardSection.jsx'],
      currentStatus: 'implemented in React section',
      parityNotes: ['overview drilldowns and exact table density still pending']
    },
    {
      legacySelector: '#table-tickets',
      legacySource: ['appscript/dashboard-index.html'],
      surface: 'management overview tickets table',
      reactTargets: ['features/management-dashboard/components/OverviewDashboardSection.jsx', 'components/tables/DataTableShell.jsx'],
      currentStatus: 'implemented in React section',
      parityNotes: ['child-row/detail parity still needs final migration']
    },
    {
      legacySelector: '#tab-user-explorer',
      legacySource: ['appscript/dashboard-index.html'],
      surface: 'management user explorer panel',
      reactTargets: ['features/management-dashboard/components/UserExplorerSection.jsx'],
      currentStatus: 'implemented in React section',
      parityNotes: ['collapse/child-row parity and exact table density still pending']
    },
    {
      legacySelector: '#tab-client-explorer',
      legacySource: ['appscript/dashboard-index.html'],
      surface: 'management client explorer panel',
      reactTargets: ['features/management-dashboard/components/ClientExplorerSection.jsx'],
      currentStatus: 'implemented in React section',
      parityNotes: ['client drilldown and analytics parity still pending']
    },
    {
      legacySelector: '#batch-modal',
      legacySource: ['appscript/dashboard-index.html'],
      surface: 'batch assignment modal',
      reactTargets: ['features/management-dashboard/components/BatchAssignmentPlanner.jsx'],
      currentStatus: 'partially implemented',
      parityNotes: ['planner shell exists, but exact modal/save-flow parity is still incomplete']
    }
  ]
};
