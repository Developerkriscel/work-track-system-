import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { connectDatabase } from './server/config/database.js';
import authRoutes from './server/routes/auth.routes.js';
import worktrackRoutes from './server/routes/worktrack.routes.js';
import clientRoutes from './server/routes/client.routes.js';
import clientPortalRoutes from './server/routes/clientPortal.routes.js';
import clientsPortalRoutes from './server/routes/clientsPortal.routes.js';
import clientSocialRoutes from './server/routes/clientSocial.routes.js';
import analyticsRoutes from './server/routes/analytics.routes.js';
import adminRoutes from './server/routes/admin.routes.js';
import empMasterRoutes from './server/routes/empMaster.routes.js';
import attendanceRoutes from './server/routes/attendance.routes.js';
import approvalsRoutes from './server/routes/approvals.routes.js';
import dashboardRoutes from './server/routes/dashboard.routes.js';
import expensesRoutes from './server/routes/expenses.routes.js';
import fmsRoutes from './server/routes/fms.routes.js';
import formsPortalRoutes from './server/routes/formsPortal.routes.js';
import managementDashboardRoutes from './server/routes/managementDashboard.routes.js';
import myApprovalStatusRoutes from './server/routes/myApprovalStatus.routes.js';
import notificationsRoutes from './server/routes/notifications.routes.js';
import reportsRoutes from './server/routes/reports.routes.js';
import settingsRoutes from './server/routes/settings.routes.js';
import filesRoutes from './server/routes/files.routes.js';
import ticketRoutes from './server/routes/ticket.routes.js';
import todoRoutes from './server/routes/todo.routes.js';
import whatsappContactsRoutes from './server/routes/whatsappContacts.routes.js';
import candidateAiRoutes from './server/routes/candidateAi.routes.js';
import { assertAuthConfiguration, requireAuth } from './server/middleware/auth.middleware.js';
import { ensurePerformanceIndexes, listRows } from './server/services/legacyStore.service.js';
import { getManagementDashboardData } from './server/services/managementDashboard.service.js';
import { startAutoTicketScheduler } from './server/services/autoTicketScheduler.service.js';
import { startWhatsAppAlerts } from './server/services/whatsappAlerts.service.js';

const app = express();
const port = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, 'client', 'dist');
const hasClientDist = fs.existsSync(clientDistPath);
assertAuthConfiguration();
const allowedOrigins = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const corsOrigin = allowedOrigins.length === 0 ? true : allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '25mb' }));

app.use((req, res, next) => {
  const acceptsGzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
  if (!acceptsGzip) return next();

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (res.headersSent || res.getHeader('Content-Encoding')) return originalJson(payload);
    const body = Buffer.from(JSON.stringify(payload));
    if (body.length < 1024) {
      res.type('application/json');
      return res.send(body);
    }
    zlib.gzip(body, (error, compressed) => {
      if (error) {
        originalJson(payload);
        return;
      }
      res.vary('Accept-Encoding');
      res.set('Content-Encoding', 'gzip');
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Content-Length', String(compressed.length));
      res.send(compressed);
    });
    return res;
  };
  return next();
});

app.use((req, res, next) => {
  const isExactUiPath =
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/uploads/') &&
    req.method === 'GET';
  if (isExactUiPath) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (hasClientDist) {
  app.use('/mern', express.static(clientDistPath, {
    index: false,
    setHeaders(res) {
      res.set('Cache-Control', 'no-store');
    }
  }));
  app.use(express.static(clientDistPath, {
    index: false,
    setHeaders(res) {
      res.set('Cache-Control', 'no-store');
    }
  }));
}

app.get(['/service-worker.js', '/sw.js'], (_req, res) => {
  res
    .type('application/javascript')
    .send("self.addEventListener('install',event=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.registration.unregister()));");
});

app.get(['/reset-localhost', '/reset-cache', '/clear-cache'], (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.clearCookie('worktrack_exact_cache_cleared');
  res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset WorkTrack Localhost</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #eef8ff; color: #101828; }
      main { width: min(520px, calc(100vw - 32px)); background: #fff; border: 1px solid #d7e4ef; border-radius: 12px; box-shadow: 0 20px 50px rgba(15, 23, 42, .12); padding: 28px; }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 0 0 18px; color: #475467; line-height: 1.5; }
      code { display: block; padding: 12px; background: #f2f6fb; border-radius: 8px; color: #18233f; }
    </style>
  </head>
  <body>
    <main>
      <h1>Resetting WorkTrack local cache</h1>
      <p id="status">Removing old localhost prototype cache and service workers...</p>
      <code>Redirecting to WorkTrack runtime.</code>
    </main>
    <script>
      (async () => {
        const status = document.getElementById('status');
        try {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(registration => registration.unregister()));
          }
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
          }
          localStorage.clear();
          sessionStorage.clear();
          document.cookie.split(';').forEach(cookie => {
            document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
          });
          status.textContent = 'Cache reset complete. Opening WorkTrack runtime...';
        } catch (error) {
          status.textContent = 'Reset attempted. Opening WorkTrack runtime...';
        }
        setTimeout(() => location.replace('/login?reset=' + Date.now()), 900);
      })();
    </script>
  </body>
</html>`);
});

import { LegacyModels } from './server/models/legacyModels.js';

app.get('/check-vikas', async (req, res) => {
  try {
    const allLogs = await LegacyModels.Attendance.find({
      $or: [
        { 'Employee Name': { $regex: /vikas kushwah/i } },
        { 'Name': { $regex: /vikas kushwah/i } },
        { 'Employee ID': { $regex: /vk/i } }
      ]
    }).lean();
    
    const septLogs = allLogs.filter(log => {
      const dateStr = String(log.Date || log._rawDate || log.date || '');
      return (dateStr.includes('-09-') || dateStr.includes('/09/') || dateStr.match(/^0?9\//) || dateStr.includes('Sep')) && (dateStr.includes('2026') || dateStr.includes('26'));
    });
    
    const editedLogs = septLogs.filter(log => {
      const k = Object.keys(log).join(' ');
      return k.toLowerCase().includes('edit') || k.toLowerCase().includes('update') || k.toLowerCase().includes('isedited') || log.updatedAt || log.EditedBy;
    });
    
    const manualEdits = editedLogs.filter(log => {
      // Ignore automated updatedAt
      if (log.updatedAt && log.createdAt && new Date(log.updatedAt).getTime() - new Date(log.createdAt).getTime() < 1000 && !log.EditedBy) {
        return false;
      }
      return true;
    });
    
    res.json({ success: true, totalSept: septLogs.length, manualEdits: manualEdits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'worktrack-mern', mode: 'mongo' });
});

app.get(['/mern', '/mern/*'], (_req, res, next) => {
  if (!hasClientDist) {
    res.status(503).type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorkTrack MERN Frontend Not Built</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, "Segoe UI", Arial, sans-serif; background: #eef8ff; color: #14213d; }
      main { width: min(620px, calc(100vw - 32px)); background: #fff; border: 1px solid #d7e4ef; border-radius: 18px; box-shadow: 0 20px 50px rgba(15, 23, 42, .12); padding: 28px; }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0 0 14px; color: #57627d; line-height: 1.6; }
      code { display: inline-block; padding: 4px 8px; border-radius: 8px; background: #f3f7fd; color: #3f2d95; }
    </style>
  </head>
  <body>
    <main>
      <h1>MERN frontend is not built yet</h1>
      <p>The new React app lives under <code>client/src</code>.</p>
      <p>Build it with <code>npm run build</code>, then reopen <code>/mern</code>.</p>
      <p>The current exact WorkTrack UI remains available on the main routes.</p>
    </main>
  </body>
</html>`);
    return;
  }
  res.redirect('/login');
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);

app.get('/debug-buddy-raw', async (req, res) => {
  try {
    const { listRows } = await import('./server/services/legacyStore.service.js');
    const data = await listRows();
    const { normalizedDate } = await import('./server/services/ticket.service.js').catch(() => ({ normalizedDate: d => String(d) }));
    res.json({
      leaves: data.leaves,
      intimations: data.intimations,
      users: data.users.map(u => ({ id: u['EMP Code'] || u['Employee ID'], buddy: u['Assign Buddy'] || u['Buddy'] }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// All application APIs require a signed MERN session. Login and session refresh
// routes are mounted above this guard and perform their own checks.
app.use('/api', (req, res, next) => {
  return requireAuth()(req, res, next);
});
app.use('/api/admin', requireAuth({ kind: 'employee', roles: ['Admin', 'HR', 'Super Admin'] }), adminRoutes);
app.use('/api/emp-master', requireAuth({ kind: 'employee', roles: ['Admin', 'HR', 'Super Admin'] }), empMasterRoutes);
app.use('/api/worktrack', requireAuth({ kind: 'employee' }), worktrackRoutes);
app.use('/api/client', requireAuth({ kind: 'client' }), clientRoutes);
app.use('/api/client-portal', requireAuth({ kind: 'client' }), clientPortalRoutes);
app.use('/api/clients-portal', requireAuth({ kind: 'employee', roles: ['Admin', 'Super Admin'] }), clientsPortalRoutes);
app.use('/api/client-social', requireAuth({ kind: 'client' }), clientSocialRoutes);
app.use('/api/analytics', requireAuth({ kind: 'employee', roles: ['Admin', 'HR', 'Manager', 'Super Admin'] }), analyticsRoutes);
app.use('/api/candidate-ai', requireAuth({ kind: 'employee', roles: ['Admin', 'HR', 'Super Admin'] }), candidateAiRoutes);
app.use('/api/approvals', requireAuth({ kind: 'employee' }), approvalsRoutes);
app.use('/api/attendance', requireAuth({ kind: 'employee' }), attendanceRoutes);
app.use('/api/dashboard', requireAuth({ kind: 'employee' }), dashboardRoutes);
app.use('/api/expenses', requireAuth({ kind: 'employee' }), expensesRoutes);
app.use('/api/fms', requireAuth({ kind: 'employee' }), fmsRoutes);
// Every employee may read forms assigned to them. The service layer keeps
// create, edit, delete, and access-management actions Super Admin-only.
app.use('/api/forms-portal', requireAuth({ kind: 'employee' }), formsPortalRoutes);
app.use('/api/management-dashboard', requireAuth({ kind: 'employee', roles: ['Manager', 'Admin', 'HR', 'Super Admin'] }), managementDashboardRoutes);
app.use('/api/my-approval-status', requireAuth({ kind: 'employee' }), myApprovalStatusRoutes);
app.use('/api/notifications', requireAuth(), notificationsRoutes);
app.use(
  '/api/reports',
  requireAuth({ kind: 'employee', roles: ['Manager', 'Admin', 'HR', 'Super Admin'] }),
  reportsRoutes
);
app.use('/api/tickets', requireAuth({ kind: 'employee' }), ticketRoutes);
app.use('/api/settings', requireAuth({ kind: 'employee' }), settingsRoutes);
app.use('/api/todo', requireAuth({ kind: 'employee' }), todoRoutes);
app.use(
  '/api/whatsapp',
  requireAuth({ kind: 'employee', roles: ['Admin', 'HR', 'Super Admin'] }),
  whatsappContactsRoutes
);

function renderReactApp() {
  const indexPath = path.join(clientDistPath, 'index.html');
  return fs.readFileSync(indexPath, 'utf8');
}

app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
  if (hasClientDist) {
    res.type('html').send(renderReactApp());
    return;
  }

  res.status(503).type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorkTrack Frontend Not Available</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, "Segoe UI", Arial, sans-serif; background: #eef8ff; color: #14213d; }
      main { width: min(620px, calc(100vw - 32px)); background: #fff; border: 1px solid #d7e4ef; border-radius: 18px; box-shadow: 0 20px 50px rgba(15, 23, 42, .12); padding: 28px; }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0 0 14px; color: #57627d; line-height: 1.6; }
      code { display: inline-block; padding: 4px 8px; border-radius: 8px; background: #f3f7fd; color: #3f2d95; }
    </style>
  </head>
  <body>
    <main>
      <h1>WorkTrack frontend is not built</h1>
      <p>The production runtime now expects the React app from <code>client/src</code>.</p>
      <p>Build it with <code>npm run build</code> and reopen <code>/login</code>.</p>
    </main>
  </body>
</html>`);
});

app.use('/api', (req, res) => {
  console.log('404 API Not Found:', req.method, req.originalUrl);
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

await connectDatabase();
await ensurePerformanceIndexes().catch((error) => {
  console.warn(`Legacy index warmup skipped: ${error.message}`);
});
await Promise.allSettled([
  listRows('User'),
  listRows('EmpMaster'),
  listRows('Client')
]);

function primeManagementDashboardCaches() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monday = new Date(now);
  monday.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const ranges = [
    [today, today],
    [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)],
    [monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)]
  ];
  ranges.forEach(([startDate, endDate]) => {
    void getManagementDashboardData(startDate, endDate, 'overview').catch(() => null);
    void getManagementDashboardData(startDate, endDate, 'full').catch(() => null);
  });
}

await startWhatsAppAlerts();

app.listen(port, () => {
  console.log(`WorkTrack MERN API running on http://localhost:${port}`);
  primeManagementDashboardCaches();
  startAutoTicketScheduler();
});

