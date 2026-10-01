// Isolated fixture: no database, scheduler, or provider calls.
import express from 'express';
import path from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const app = express();
app.use(express.json());
const user = { 'Employee ID': 'FIXTURE', 'Employee Name': 'Fixture Admin', Role: 'Super Admin' };
app.post('/api/auth/employee/:action', (_req, res) => res.json({ success: true, token: 'fixture', user }));
let failAuto = false;
app.post('/api/tickets/workspace', async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const mode = req.body.viewMode;
  if (mode === 'auto' && failAuto) return res.status(500).json({ message: 'Fixture load failed' });
  const ticket = { 'Ticket ID': `TEST-${mode}`, 'Employee ID': mode === 'my' ? 'FIXTURE' : 'TEAM', 'Task Description': `${mode} fixture`, Status: 'Open', Frequency: 'Daily' };
  const key = mode === 'auto' ? 'autoTickets' : mode === 'client' ? 'clientOriginTickets' : mode === 'buddy' ? 'buddyTickets' : 'tickets';
  res.json({ success: true, clients: [], users: [user], allUsers: [user], categories: [],
    tickets: [], autoTickets: [], clientOriginTickets: [], buddyTickets: [], [key]: [ticket],
    canViewTeamTickets: true, canViewClientTickets: true,
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, start: 1, end: 1, viewMode: mode }
  });
});
app.use('/api', (_req, res) => res.json({ success: true, data: [], notifications: [], count: 0, serverTime: Date.now() }));
const root = path.resolve(import.meta.dirname, '../../client/dist');
app.use(express.static(root));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'index.html')));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const base = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(`${base}/ticket-system`);
  await page.getByLabel('Employee ID', { exact: true }).fill('FIXTURE');
  await page.getByLabel('Password', { exact: true }).fill('fixture');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.locator('.ticket-workspace-loader').waitFor();
  await page.getByText('TEST-my', { exact: true }).waitFor();
  for (const [label, mode] of [['Team Tickets', 'team'], ['Client Tickets', 'client'], ['Auto Ticket', 'auto'], ['Buddy', 'buddy'], ['My Tickets', 'my']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.locator('.ticket-workspace-loader').waitFor();
    assert.equal(await page.locator('.react-data-table').count(), 0, 'Hide stale count and empty table during loading');
    await page.getByText(`${mode} fixture`, { exact: true }).waitFor();
    assert.equal(await page.locator('.ticket-workspace-loader').count(), 0);
  }
  await page.getByRole('button', { name: 'Auto Ticket', exact: true }).click();
  await page.getByRole('button', { name: 'Client Tickets', exact: true }).click();
  await page.getByText('client fixture', { exact: true }).waitFor();
  assert.equal(await page.getByText('auto fixture', { exact: true }).count(), 0);
  failAuto = true;
  await page.getByRole('button', { name: 'Auto Ticket', exact: true }).click();
  await page.getByText('Fixture load failed', { exact: true }).waitFor();
  assert.equal(await page.locator('.ticket-workspace-loader').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: All five tabs show loader, Auto renders, stale responses are ignored, errors release loader.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
