import {
  LayoutDashboard,
  Clock3,
  Tickets,
  ListChecks,
  BadgeCheck,
  FileText,
  Users,
  Receipt,
  BarChart3,
  ShieldUser,
  Settings as SettingsIcon
} from '@/components/common/icons';
import { AttendancePage } from '@/features/attendance/AttendancePage';
import { AdminPage } from '@/features/admin/AdminPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { ClientsPortalPage } from '@/features/clients-portal/ClientsPortalPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { EmpMasterPage } from '@/features/emp-master/EmpMasterPage';
import { FmsPage } from '@/features/fms/FmsPage';
import { FormsPortalPage } from '@/features/forms-portal/FormsPortalPage';
import { ManagementDashboardPage } from '@/features/management-dashboard/ManagementDashboardPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TicketSystemPage } from '@/features/tickets/TicketSystemPage';
import { TodoPage } from '@/features/todo/TodoPage';
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
    iconColor: '#facc15',
    page: { ...placeholder('Review tickets, attendance, leave, and other approval requests from your queue.'), ...migrationModules.approvals },
    element: <ApprovalsPage />
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
    path: '/settings',
    key: 'settings',
    title: 'Settings',
    icon: SettingsIcon,
    iconColor: '#94a3b8',
    page: { ...placeholder('Manage your profile picture, personal details, and change your password.'), ...migrationModules.admin },
    element: <SettingsPage />
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
    accessCheck: (user) => /manager|admin|hr|super admin/i.test(String(user?.Role || '')),
    page: { ...placeholder('Monitor company-wide execution, user activity, and client workload from a management workspace.'), ...migrationModules.managementDashboard },
    element: <ManagementDashboardPage />
  },
  {
    path: '/dashboard',
    key: 'managementDashboardAlias',
    title: 'Management Dashboard',
    icon: BarChart3,
    iconColor: '#818cf8',
    hiddenInNav: true,
    accessCheck: (user) => /manager|admin|hr|super admin/i.test(String(user?.Role || '')),
    page: { ...placeholder('Monitor company-wide execution, user activity, and client workload from a management workspace.'), ...migrationModules.managementDashboard },
    element: <ManagementDashboardPage />
  },
  {
    path: '/emp-master',
    key: 'empMaster',
    title: 'EMP Master',
    icon: FileText,
    iconColor: '#e879f9',
    accessCheck: (user) => /^(hr|super admin)$/i.test(String(user?.Role || user?.role || '')),
    page: { ...placeholder('Manage employee, intern, freelancer, inactive-user, and employee document records.'), ...migrationModules.admin },
    element: <EmpMasterPage />
  },
  {
    path: '/admin',
    key: 'admin',
    title: 'Admin',
    icon: ShieldUser,
    iconColor: '#fb7185',
    accessCheck: (user) => Boolean(user?.access?.canManageUsers),
    page: { ...placeholder('Manage employee records, user access, and administrative workspace data.'), ...migrationModules.admin },
    element: <AdminPage />
  }
];
