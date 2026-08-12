import { useState, useEffect } from 'react';
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
    subjectId: client?.['Client Name'] || client?.Name || ''
  });

  const [lastViewed, setLastViewed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wt_lastViewed_client')) || {};
    } catch {
      return {};
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setLastViewed(prev => {
      const updated = { ...prev, [location.pathname]: Date.now() };
      localStorage.setItem('wt_lastViewed_client', JSON.stringify(updated));
      return updated;
    });
  }, [location.pathname]);

  const activeItems = notifications.items.filter(item => !/closed|done|completed|resolved/i.test(String(item.Status || '')));
  const getRouteCount = (path) => {
    const routeLastViewed = lastViewed[path] || 0;
    return activeItems.filter(item => {
      const itemTimestamp = new Date(item.Timestamp || item['Last Update Date'] || 0).getTime();
      if (itemTimestamp <= routeLastViewed) return false;

      const type = item.type || '';
      if (path === '/client/tickets' && type === 'Ticket') return true;
      return false;
    }).length;
  };

  return (
    <div className="app-shell app-shell--client">
      {/* Mobile Backdrop */}
      {mobileNavOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileNavOpen(false)} 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 998 }}
        />
      )}

      <aside className={`sidebar ${mobileNavOpen ? 'sidebar--mobile-open' : ''}`}>
        <div className="sidebar__brand">
          <img src="/worktrack-logo.png" alt="WorkTrack Client Portal" className="sidebar__logo" />
          <div style={{ flex: 1 }}>
            <p className="sidebar__brand-title">Client</p>
            <p className="sidebar__brand-title">Portal</p>
          </div>
          {mobileNavOpen && (
            <button 
              type="button" 
              className="sidebar__close-btn"
              onClick={() => setMobileNavOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        <nav className="sidebar__nav" aria-label="Client navigation">
          {clientRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <NavLink
                key={route.key}
                to={route.path}
                end={route.path === '/client'}
                className={({ isActive }) =>
                  `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className="sidebar__link-icon"
                      style={{ color: route.iconColor || 'currentColor' }}
                    />
                    <span className="sidebar__link-text">{route.title}</span>
                    {!isActive && getRouteCount(route.path) > 0 && (
                      <span className="sidebar__link-badge">
                        {getRouteCount(route.path)}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="shell-main">
        <div className="shell-main__inner shell-main__inner--client">
          <header className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                type="button" 
                className="topbar__mobile-btn" 
                onClick={() => setMobileNavOpen(true)}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              </button>
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
                    isClientPanel={true}
                    userRole="Client"
                  />
                }
                user={{
                  'Employee Name': client?.['Client Name'] || client?.Name || 'Client',
                  Role: 'Client',
                  Email: client?.['Client Email ID'] || client?.Email || '',
                  Avatar: client?.Avatar || client?.Photo || null
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
