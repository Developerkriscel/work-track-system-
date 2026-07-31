import {
  LayoutDashboard,
  Clock3,
  Tickets,
  ListChecks,
  FileText,
  Users,
  Receipt,
  BarChart3,
  BadgeCheck,
  Settings as SettingsIcon
} from '@/components/common/icons';
import { AttendancePage } from '@/features/attendance/AttendancePage';
import { ClientsPortalPage } from '@/features/clients-portal/ClientsPortalPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { FmsPage } from '@/features/fms/FmsPage';
import { FormsPortalPage } from '@/features/forms-portal/FormsPortalPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { MyApprovalStatusPage } from '@/features/my-approval-status/MyApprovalStatusPage';
import { ManagementDashboardPage } from '@/features/management-dashboard/ManagementDashboardPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TicketSystemPage } from '@/features/tickets/TicketSystemPage';
import { TodoPage } from '@/features/todo/TodoPage';
import { PeopleMasterPage } from '@/features/people-master/PeopleMasterPage';
import { migrationModules } from '@/lib/constants/migrationModules';

const placeholder = (copy) => ({
  eyebrow: 'WorkTrack Workspace',
  description: copy
});

export const appRoutes = [
  {
    path: '/worktrack',
    key: 'dashboardAlias',
    title: 'Dashboard',
    icon: LayoutDashboard,
    iconColor: '#60a5fa',
    hiddenInNav: true,
    page: { ...placeholder('Track performance, workload, attendance, and daily execution from one place.'), ...migrationModules.dashboard },
    element: <DashboardPage />
  },
  {
    path: '/',
    key: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    iconColor: '#60a5fa',
    page: { ...placeholder('Track performance, workload, attendance, and daily execution from one place.'), ...migrationModules.dashboard },
    element: <DashboardPage />
  },
  {
    path: '/attendance',
    key: 'attendance',
    title: 'Attendance',
    icon: Clock3,
    iconColor: '#34d399',
    page: { ...placeholder('Manage punch activity, attendance history, leave requests, and work intimations.'), ...migrationModules.attendance },
    element: <AttendancePage />
  },
  {
    path: '/ticket-system',
    key: 'tickets',
    title: 'Ticket System',
    icon: Tickets,
    iconColor: '#f472b6',
    page: { ...placeholder('Create, track, update, and schedule operational tickets with the current workflow.'), ...migrationModules.tickets },
    element: <TicketSystemPage />
  },
  {
    path: '/fms-tracker',
    key: 'fms',
    title: 'FMS Tracker',
    icon: ListChecks,
    iconColor: '#fb923c',
    page: { ...placeholder('Review FMS tasks, track team workload, and complete assigned work.'), ...migrationModules.fms },
    element: <FmsPage />
  },
  {
    path: '/approvals',
    key: 'approvals',
    title: 'Approvals',
    icon: BadgeCheck,
    iconColor: '#818cf8',
    accessCheck: (user) => /manager|admin|hr|super admin/i.test(String(user?.Role || user?.role || '')),
    page: { ...placeholder('Review and action pending ticket, leave, intimation, and attendance approvals.'), ...migrationModules.approvals },
    element: <ApprovalsPage />
  },
  {
    path: '/my-approval-status',
    key: 'myApprovalStatus',
    title: 'My Approval Status',
    icon: Receipt,
    iconColor: '#fb923c',
    page: { ...placeholder('Track the status of your tickets, leave requests, intimations, and approval-linked attendance records.'), ...migrationModules.myApprovalStatus },
    element: <MyApprovalStatusPage />
  },
  {
    path: '/forms-portal',
    key: 'formsPortal',
    title: 'Forms Portal',
    icon: FileText,
    iconColor: '#a78bfa',
    page: { ...placeholder('Open assigned forms, search by department or category, and manage access where permitted.'), ...migrationModules.formsPortal },
    element: <FormsPortalPage />
  },
  {
    path: '/todo',
    key: 'todo',
    title: 'To-Do',
    icon: ListChecks,
    iconColor: '#2dd4bf',
    page: { ...placeholder('Create, filter, and update your personal to-do tasks with bulk add support.'), ...migrationModules.todo },
    element: <TodoPage />
  },
  {
    path: '/clients-portal',
    key: 'clientsPortal',
    title: 'Clients Portal',
    icon: Users,
    iconColor: '#38bdf8',
    accessCheck: (user) => /^(admin|super admin)$/i.test(String(user?.Role || user?.role || '').trim()),
    page: { ...placeholder('Browse client records, inspect details, and manage portal data where access allows.'), ...migrationModules.clientsPortal },
    element: <ClientsPortalPage />
  },
  {
    path: '/expenses',
    key: 'expenses',
    title: 'Expenses',
    icon: Receipt,
    iconColor: '#f87171',
    page: { ...placeholder('Submit expenses, attach receipts, and review approval status from one screen.'), ...migrationModules.expenses },
    element: <ExpensesPage />
  },
  {
    path: '/reports',
    key: 'reports',
    title: 'Reports',
    icon: BarChart3,
    iconColor: '#4ade80',
    accessCheck: (user) => /manager|admin|hr|super admin/i.test(String(user?.Role || user?.role || '')),
    page: { ...placeholder('Analyze tickets and FMS activity with filters, summaries, and exports.'), ...migrationModules.reports },
    element: <ReportsPage />
  },
  {
    path: '/management-dashboard',
    key: 'managementDashboard',
    title: 'Management Dashboard',
    icon: BarChart3,
    iconColor: '#818cf8',
    hiddenInNav: true,
    accessCheck: (user) => /manager|admin|hr|super admin/i.test(String(user?.Role || user?.role || '')),
    page: { ...placeholder('Review overview analytics, user explorer, client explorer, and planning tools.'), ...migrationModules.managementDashboard },
    element: <ManagementDashboardPage />
  },
  {
    path: '/emp-master',
    key: 'peopleMaster',
    title: 'EMP Master',
    icon: Users,
    iconColor: '#a855f7',
    accessCheck: (user) => /^(hr|admin|super admin)$/i.test(String(user?.Role || user?.role || '')),
    page: { ...placeholder('Manage user access and employee records from one place.'), ...migrationModules.admin },
    element: <PeopleMasterPage initialTab="emp-master" />
  },
  {
    path: '/users',
    key: 'usersAdmin',
    title: 'EMP Master',
    icon: Users,
    iconColor: '#facc15',
    hiddenInNav: true,
    accessCheck: (user) => Boolean(user?.access?.canManageUsers),
    page: { ...placeholder('Manage user accounts, roles, reporting lines, approvers, and user access settings.'), ...migrationModules.admin },
    element: <PeopleMasterPage initialTab="users" />
  },
  {
    path: '/admin',
    key: 'adminAlias',
    title: 'EMP Master',
    icon: Users,
    iconColor: '#facc15',
    hiddenInNav: true,
    accessCheck: (user) => Boolean(user?.access?.canManageUsers),
    page: { ...placeholder('Manage user accounts, roles, reporting lines, approvers, and user access settings.'), ...migrationModules.admin },
    element: <PeopleMasterPage initialTab="users" />
  },
  {
    path: '/settings',
    key: 'settings',
    title: 'Settings',
    icon: SettingsIcon,
    iconColor: '#94a3b8',
    page: { ...placeholder('Manage your profile picture, personal details, and change your password.'), ...migrationModules.admin },
    element: <SettingsPage />
  }
];
