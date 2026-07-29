import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { clientRoutes } from '@/app/router/clientRoutes';
import { useThemeMode } from '@/app/providers/ThemeProvider';
import { UserProfileMenu } from '@/components/common/UserProfileMenu';
import { useClientAuth } from '@/features/auth/ClientAuthProvider';
import { NotificationPanel } from '@/components/common/NotificationPanel';
import { useNotificationCenter } from '@/features/notifications/useNotificationCenter';

export function ClientShell() {
  const location = useLocation();
  const { toggleMode } = useThemeMode();
  const { client, signOut } = useClientAuth();
  const activeRoute = clientRoutes.find((route) => route.path === location.pathname) || clientRoutes[0];
  const notifications = useNotificationCenter({
    mode: 'client',
    subjectId: client?.Client_Id || ''
  });

  return (
    <div className="app-shell app-shell--client">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/worktrack-logo.png" alt="WorkTrack Client Portal" className="sidebar__logo" />
          <div>
            <p className="sidebar__brand-title">Client</p>
            <p className="sidebar__brand-title">Portal</p>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label="Client navigation">
          {clientRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <NavLink
                key={route.key}
                to={route.path}
                end={route.path === '/client'}
                className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
              >
                <Icon className="sidebar__link-icon" />
                <span>{route.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="shell-main">
        <div className="shell-main__inner shell-main__inner--client">
          <header className="topbar">
            <div>
              <div className="topbar__title">{activeRoute.title}</div>
            </div>
            <div className="topbar__actions">
              <UserProfileMenu
                notificationCount={notifications.count}
                onRefresh={() => window.location.reload()}
                onBell={notifications.toggleOpen}
                onToggleTheme={toggleMode}
                onLogout={signOut}
                allowPasswordChange={false}
                notificationsOpen={notifications.open}
                onCloseNotifications={notifications.close}
                notificationPanel={
                  <NotificationPanel
                    title="Client Updates"
                    items={notifications.items}
                    loading={notifications.loading}
                    error={notifications.error}
                    onRefresh={notifications.refresh}
                  />
                }
                user={{
                  'Employee Name': client?.['Client Name'] || client?.Name || 'Client',
                  Role: 'Client',
                  Email: client?.['Client Email ID'] || client?.Email || '',
                  Avatar: null
                }}
              />
            </div>
          </header>

          <main className="content-area">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
