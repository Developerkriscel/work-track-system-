import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { appRoutes } from '@/app/router/routes';
import { useThemeMode } from '@/app/providers/ThemeProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { UserProfileMenu } from '@/components/common/UserProfileMenu';
import { NotificationPanel } from '@/components/common/NotificationPanel';
import { useNotificationCenter } from '@/features/notifications/useNotificationCenter';

export function AppShell() {
  const location = useLocation();
  const { toggleMode } = useThemeMode();
  const { user } = useAuth();
  const activeRoute = appRoutes.find((route) => route.path === location.pathname) || appRoutes[0];
  const visibleRoutes = appRoutes.filter((route) => !route.hiddenInNav && (!route.accessCheck || route.accessCheck(user)));
  const notifications = useNotificationCenter({
    mode: 'employee',
    subjectId: user?.['Employee ID'] || ''
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/worktrack-logo.png" alt="WorkTrack System" className="sidebar__logo" />
          <div>
            <p className="sidebar__brand-title">Work Track</p>
            <p className="sidebar__brand-title">System</p>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label="Primary">
          {visibleRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <NavLink
                key={route.key}
                to={route.path}
                className={({ isActive }) =>
                  `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                }
              >
              <Icon
                  className="sidebar__link-icon"
                  style={{ color: route.iconColor || 'currentColor' }}
                />
                <span>{route.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="shell-main">
        <div className="shell-main__inner">
          <header className="topbar">
            <div>
              <div className="topbar__title">{activeRoute.key === 'dashboard' ? 'Home' : activeRoute.title}</div>
            </div>
            <div className="topbar__actions">
              <UserProfileMenu
                notificationCount={notifications.count}
                onRefresh={() => window.location.reload()}
                onBell={notifications.toggleOpen}
                onToggleTheme={toggleMode}
                notificationsOpen={notifications.open}
                onCloseNotifications={notifications.close}
                allowPasswordChange={!(user?.Role || user?.role) || String(user?.Role || user?.role).trim() !== 'Super Admin'}
                notificationPanel={
                  <NotificationPanel
                    title="Notifications"
                    items={notifications.items}
                    loading={notifications.loading}
                    error={notifications.error}
                    onRefresh={notifications.refresh}
                  />
                }
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
