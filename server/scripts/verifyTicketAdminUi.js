import 'dotenv/config';
import { chromium } from 'playwright-core';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { employeeToken, normalizeEmployee } from '../services/auth.service.js';
import { listRows } from '../services/legacyStore.service.js';

await connectDatabase();
const users = await listRows('User');
const rawUser = users.find((row) => ['Super Admin', 'Admin', 'Manager', 'HR'].includes(String(row.Role || '').trim()) && String(row.Status || 'Active').toLowerCase() === 'active');
if (!rawUser) throw new Error('No active elevated employee is available for admin ticket verification.');
const user = normalizeEmployee(rawUser);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.addInitScript((session) => localStorage.setItem('worktrack.mern.employeeSession', JSON.stringify(session)), { user, token: employeeToken(user) });
  await page.goto('http://localhost:5000/ticket-system', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.getByRole('heading', { name: 'Ticket System', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  const teamTab = page.getByRole('button', { name: 'Team Tickets', exact: true });
  if (!(await teamTab.count())) throw new Error(`Team Tickets is missing for ${user.Role}.`);
  await teamTab.click();
  if (!(await teamTab.evaluate((node) => node.className.includes('view-mode-tab--active')))) throw new Error('Team Tickets did not activate.');
  await page.goto('http://localhost:5000/approvals', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.getByRole('heading', { name: 'Pending Approvals', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  const ticketTable = page.locator('.approval-table').first();
  if (!(await ticketTable.count())) throw new Error('Pending ticket approval table is missing.');
  const rows = ticketTable.locator('tbody tr').filter({ has: page.locator('.ticket-id-chip') });
  if (await rows.count()) {
    const hasActionOrViewState = await rows.first().locator('.ticket-actions, .ticket-action-state').count();
    if (!hasActionOrViewState) throw new Error('Approval row has neither actions nor view-only state.');
  }
} finally {
  await browser.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
console.log(`Elevated ticket UI verification passed for ${user.Role} ${user['Employee ID']}.`);
