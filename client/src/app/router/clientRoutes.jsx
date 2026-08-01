import {
  BarChart3,
  LayoutDashboard,
  Receipt,
  Tickets,
  Settings as SettingsIcon
} from '@/components/common/icons';
import { ClientDashboardPage } from '@/features/client-portal/ClientDashboardPage';
import { ClientInvoicesPage } from '@/features/client-portal/ClientInvoicesPage';
import { ClientReportsPage } from '@/features/client-portal/ClientReportsPage';
import { ClientTicketsPage } from '@/features/client-portal/ClientTicketsPage';
import { ClientSettingsPage } from '@/features/client-portal/ClientSettingsPage';

export const clientRoutes = [
  {
    path: '/client',
    key: 'clientDashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    element: <ClientDashboardPage />
  },
  {
    path: '/client/tickets',
    key: 'clientTickets',
    title: 'My Tickets',
    icon: Tickets,
    element: <ClientTicketsPage />
  },
  {
    path: '/client/invoices',
    key: 'clientInvoices',
    title: 'Invoices',
    icon: Receipt,
    element: <ClientInvoicesPage />
  },
  {
    path: '/client/reports',
    key: 'clientReports',
    title: 'Reports',
    icon: BarChart3,
    element: <ClientReportsPage />
  },
  {
    path: '/client/settings',
    key: 'clientSettings',
    title: 'Settings',
    icon: SettingsIcon,
    element: <ClientSettingsPage />
  }
];
