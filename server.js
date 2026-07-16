import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDatabase } from './server/config/database.js';
import authRoutes from './server/routes/auth.routes.js';
import worktrackRoutes from './server/routes/worktrack.routes.js';
import clientRoutes from './server/routes/client.routes.js';
import analyticsRoutes from './server/routes/analytics.routes.js';
import appsScriptRoutes from './server/routes/appsScript.routes.js';

const app = express();
const port = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '25mb' }));

app.use((req, res, next) => {
  const isExactUiPath =
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/uploads/') &&
    req.method === 'GET';
  if (isExactUiPath) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const hasCleanupCookie = /\bworktrack_exact_cache_cleared=1\b/.test(req.headers.cookie || '');
    if (!hasCleanupCookie) {
      res.set('Clear-Site-Data', '"cache", "storage"');
      res.cookie('worktrack_exact_cache_cleared', '1', {
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000
      });
    }
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
      <code>Redirecting to exact Apps Script WorkTrack UI.</code>
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
          status.textContent = 'Cache reset complete. Opening exact WorkTrack UI...';
        } catch (error) {
          status.textContent = 'Reset attempted. Opening exact WorkTrack UI...';
        }
        setTimeout(() => location.replace('/?exact=' + Date.now()), 900);
      })();
    </script>
  </body>
</html>`);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'worktrack-mern', mode: 'mongo' });
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

app.use('/api/auth', authRoutes);
app.use('/api/worktrack', worktrackRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/apps-script', appsScriptRoutes);

const exactPages = {
  worktrack: 'index.html',
  client: 'client-index.html',
  dashboard: 'dashboard-index.html'
};

function renderExactPage(fileName) {
  const filePath = path.join(__dirname, 'appscript', fileName);
  const referenceStamp = process.env.WORKTRACK_REFERENCE_DATE || new Date().toISOString();
  const cacheCleanupTag = `<script id="mern-cache-cleanup">
    (() => {
      if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => registration.unregister())).catch(() => {});
      if ('caches' in window) caches.keys().then(keys => keys.forEach(key => caches.delete(key))).catch(() => {});
    })();
  </script>`;
  const shimTag = '<script src="/googleScriptRunShim.js"></script>';
  const scaleStyle = `<style id="mern-appscript-viewport-scale">
    html { zoom: 0.85; }
    body, #app-container, #sidebar, #main-content { min-height: calc(100vh / 0.85); }
    body { min-width: calc(100vw / 0.85); }
    #app-views { padding-top: 1rem !important; }
  </style>`;
  const referenceDateTag = `<script>window.WORKTRACK_REFERENCE_DATE = window.WORKTRACK_REFERENCE_DATE || '${referenceStamp}';</script>`;
  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/<base\s+target="_top"\s*\/?>/i, '')
    .replaceAll('https://i.ibb.co/mVJGYh3w/Untitled-design-1.png', '/worktrack-logo.png')
    .replaceAll('https://cdn.tailwindcss.com', '/vendor/tailwindcss.js')
    .replaceAll('https://code.jquery.com/jquery-3.7.0.js', '/vendor/jquery/jquery.min.js')
    .replaceAll('https://code.jquery.com/jquery-3.7.0.min.js', '/vendor/jquery/jquery.min.js')
    .replaceAll('https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css', '/vendor/datatables-net-dt/css/dataTables.dataTables.css')
    .replaceAll('https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js', '/vendor/datatables-net-dt/js/dataTables.dataTables.min.js')
    .replaceAll('https://cdn.jsdelivr.net/npm/chart.js', '/vendor/chartjs/chart.umd.min.js')
    .replaceAll('https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css', '/vendor/sweetalert2/sweetalert2.min.css')
    .replaceAll('https://cdn.jsdelivr.net/npm/sweetalert2@11', '/vendor/sweetalert2/sweetalert2.min.js')
    .replaceAll('https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css', '/vendor/select2-dist/css/select2.min.css')
    .replaceAll('https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js', '/vendor/select2-dist/js/select2.min.js')
    .replaceAll('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', '/vendor/fontawesome-free/css/all.min.css')
    .replaceAll('https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js', '/vendor/canvas-confetti/confetti.browser.min.js')
    .replaceAll('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav', '/vendor/silence.wav')
    .replace(/<link[^>]+fonts\.googleapis[^>]*>\s*/gi, '')
    .replace(/@import url\('https:\/\/fonts\.googleapis\.com[^']+'\);\s*/gi, '')
    .replace('</head>', `${scaleStyle}\n${referenceDateTag}\n${cacheCleanupTag}\n${shimTag}\n</head>`);
}

app.get('/exact', (_req, res) => {
  res.redirect('/exact/worktrack');
});

app.get(['/', '/worktrack'], (_req, res) => {
  res.type('html').send(renderExactPage(exactPages.worktrack));
});

app.get('/client', (_req, res) => {
  res.type('html').send(renderExactPage(exactPages.client));
});

app.get('/dashboard', (_req, res) => {
  res.type('html').send(renderExactPage(exactPages.dashboard));
});

app.get('/exact/:portal', (req, res) => {
  const fileName = exactPages[req.params.portal];
  if (!fileName) return res.status(404).send('Exact portal not found.');
  res.type('html').send(renderExactPage(fileName));
});

app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
  const page =
    /^\/client(?:\/|$)/.test(req.path)
      ? exactPages.client
      : /^\/dashboard(?:\/|$)/.test(req.path)
        ? exactPages.dashboard
        : exactPages.worktrack;
  res.type('html').send(renderExactPage(page));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

await connectDatabase();

app.listen(port, () => {
  console.log(`WorkTrack MERN API running on http://localhost:${port}`);
});
