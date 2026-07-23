import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ClientShell } from '@/components/layout/ClientShell';
import { AppShellPage } from '@/pages/AppShellPage';
import { appRoutes } from '@/app/router/routes';
import { clientRoutes } from '@/app/router/clientRoutes';
import { ClientLoginPage } from '@/features/auth/ClientLoginPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireClientAuth } from '@/features/auth/RequireClientAuth';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RouteAccessGate } from '@/features/auth/RouteAccessGate';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/client/login" element={<ClientLoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          {appRoutes.map((route) => (
            <Route
              key={route.key}
              path={route.path}
              element={
                <RouteAccessGate route={route}>
                  {route.element || <AppShellPage title={route.title} {...route.page} />}
                </RouteAccessGate>
              }
            />
          ))}
        </Route>
      </Route>
      <Route element={<RequireClientAuth />}>
        <Route element={<ClientShell />}>
          {clientRoutes.map((route) => (
            <Route key={route.key} path={route.path} element={route.element || <AppShellPage title={route.title} />} />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
