import { appRoutes } from '@/app/router/routes';
import { clientRoutes } from '@/app/router/clientRoutes';

export const routeMigrationMatrix = {
  employeeAdmin: {
    shell: 'components/layout/AppShell.jsx',
    guard: 'features/auth/RequireAuth.jsx',
    loginRoute: '/login',
    defaultProtectedRoute: '/',
    routes: [
      ...appRoutes.map((route) => ({
        routeKey: route.key,
        routePath: route.path,
        title: route.title,
        shell: 'AppShell',
        access: route.accessCheck ? 'role/access gated' : 'authenticated user',
        pageElement:
          route.element?.type?.name ||
          'inline route element',
        notes: []
      })),
      {
        routeKey: 'employeeLogin',
        routePath: '/login',
        title: 'Employee Login',
        shell: 'standalone login shell',
        access: 'public',
        pageElement: 'LoginPage',
        notes: ['Legacy login is now separated from the protected app shell route tree.']
      }
    ]
  },
  client: {
    shell: 'components/layout/ClientShell.jsx',
    guard: 'features/auth/RequireClientAuth.jsx',
    loginRoute: '/client/login',
    defaultProtectedRoute: '/client',
    routes: [
      ...clientRoutes.map((route) => ({
        routeKey: route.key,
        routePath: route.path,
        title: route.title,
        shell: 'ClientShell',
        access: 'authenticated client',
        pageElement:
          route.element?.type?.name ||
          'inline route element',
        notes: []
      })),
      {
        routeKey: 'clientLogin',
        routePath: '/client/login',
        title: 'Client Login',
        shell: 'standalone login shell',
        access: 'public',
        pageElement: 'ClientLoginPage',
        notes: ['Client login is isolated from employee/admin routes and uses a dedicated auth provider.']
      }
    ]
  },
  globalFallbacks: [
    {
      path: '*',
      behavior: 'Navigate to /login',
      purpose: 'send unknown routes to employee login until route families are finalized'
    }
  ],
  migrationObservations: [
    'Employee/admin React login route lives at /login, while the protected dashboard currently occupies /.',
    'Client workspace is already separated into its own guarded shell and route family under /client/*.',
    'Management dashboard is not a separate app entry yet; it is currently a protected route within the employee/admin shell.',
    'Exact Apps Script parity may eventually require revisiting whether / should resolve to login, dashboard, or a role-aware redirect.'
  ]
};
