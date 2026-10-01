// Built-frontend fixture, with no database or outbound provider access.
import express from 'express';
import path from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const app = express(); app.use(express.json());
const user = { 'Employee ID': 'FIXTURE', 'Employee Name': 'Test Admin', Role: 'Super Admin' };
app.post('/api/auth/employee/:action', (_req, res) => res.json({ success: true, token: 'fixture', user }));
const requests = [];
app.post('/api/dashboard/data', async (req, res) => {
  requests.push(req.body);
  await new Promise((resolve) => setTimeout(resolve, 450));
  const { viewMode, filterRange, taskPage } = req.body;
  res.json({ success: true, data: { currentUser: user, canViewTeamDashboard: true,
    kpis: { pendingTickets: 23, teamMembers: 2 }, chartData: { lineChart: { labels: [], data: [] }, barChart: { labels: [], data: [] } },
    todaysTasks: [{ ID: `${viewMode}-${filterRange}-${taskPage}`, Type: 'Ticket', Status: 'Open', Description: 'Fixture task' }],
    taskPagination: { page: taskPage, pageCount: 2, pageSize: 20, total: 23 }
  } });
});
app.use('/api', (_req, res) => res.json({ success: true, data: [], notifications: [], count: 0, serverTime: Date.now() }));
const root = path.resolve(import.meta.dirname, '../../client/dist');
app.use(express.static(root)); app.get('*', (_req, res) => res.sendFile(path.join(root, 'index.html')));
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const base = `http://127.0.0.1:${server.address().port}`;
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(base);
  await page.getByLabel('Employee ID', { exact: true }).fill('FIXTURE');
  await page.getByLabel('Password', { exact: true }).fill('fixture');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByText('Loading dashboard…', { exact: true }).waitFor();
  await page.getByText('my-today-1', { exact: true }).waitFor();
  assert.equal(requests.length, 1, 'One initial request, not separate racing requests');
  assert(requests[0].includeSummary && requests[0].includeTasks);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('my-today-2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'My Team Dashboard', exact: true }).click();
  await page.getByText('team-today-1', { exact: true }).waitFor();
  await page.getByLabel('Date Range').selectOption('month');
  await page.getByLabel('Date Range').selectOption('yesterday');
  await page.getByText('team-yesterday-1', { exact: true }).waitFor();
  assert.equal(await page.getByText('Loading tasks...', { exact: true }).count(), 0);
  assert.equal(await page.getByText('team-month-1', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: one dashboard request, loading indicator, task pagination, scope reset and stale-response protection.');
} finally {
  await browser?.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
}
