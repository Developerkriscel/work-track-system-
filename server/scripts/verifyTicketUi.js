import 'dotenv/config';
import { chromium } from 'playwright-core';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { employeeToken, normalizeEmployee } from '../services/auth.service.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

await connectDatabase();
const users = await listRows('User');
const rawUser = users.find((row) => String(row['Employee ID'] || row.employeeId || '').toUpperCase() === 'NL106')
  || users.find((row) => String(row.Status || row.status || 'Active').toLowerCase() === 'active');
assert(Boolean(rawUser), 'No active employee is available for Ticket UI verification.');

if (rawUser) {
  const user = normalizeEmployee(rawUser);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const viewportWidth = Number(process.env.VERIFY_VIEWPORT_WIDTH || 1500);
  const context = await browser.newContext({ viewport: { width: viewportWidth, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  try {
    await page.addInitScript((session) => {
      localStorage.setItem('worktrack.mern.employeeSession', JSON.stringify(session));
    }, { user, token: employeeToken(user) });
    await page.goto(`${baseUrl}/ticket-system`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.getByRole('heading', { name: 'Ticket System', exact: true }).waitFor({ state: 'visible', timeout: 10000 });

    const clientSelect = page.locator('[data-ticket-filter="clients"]');
    const statusSelect = page.locator('[data-ticket-filter="statuses"]');
    await clientSelect.waitFor({ state: 'visible', timeout: 10000 });
    await clientSelect.click();
    const clientOptions = page.locator('.ticket-filter-dropdown-control').nth(0).locator('.ticket-filter-dropdown__option');
    await page.waitForFunction(() => document.querySelectorAll('.ticket-filter-dropdown-control:first-child .ticket-filter-dropdown__option').length > 1, null, { timeout: 15000 });
    await clientOptions.nth(0).waitFor({ state: 'visible', timeout: 10000 });
    assert((await clientOptions.count()) > 1, 'Client filter has no Mongo-backed options.');
    await clientSelect.click();
    const statuses = await page.locator('.ticket-filter-dropdown-control').nth(1).locator('.ticket-filter-dropdown__option span').allTextContents();
    const statusValues = statuses.filter((status) => status !== 'All Statuses');
    assert(statusValues.slice(0, 6).join('|') === 'In Progress|Open|Paused|Rework / Reassigned|Pending Approval|Closed', `Ticket status order is incorrect: ${statusValues.join('|')}`);
    const teamTab = page.getByRole('button', { name: 'Team Tickets', exact: true });
    if (await teamTab.count()) {
      await teamTab.click();
      assert(await teamTab.evaluate((node) => node.className.includes('view-mode-tab--active')), 'Team Tickets tab did not become active.');
    }
    await statusSelect.click();
    await statusSelect.locator('..').locator('input').nth(5).check();
    await page.getByRole('button', { name: 'Apply Filters', exact: true }).click();
    assert(await page.locator('.ticket-table tbody tr').count() >= 1, 'Ticket table did not render after applying a status filter.');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Create New Ticket', exact: true }).click();
    assert(await page.getByRole('heading', { name: 'Create New Ticket', exact: true }).isVisible(), 'Create ticket form did not open.');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const firstDataRow = page.locator('.ticket-table tbody tr').filter({ has: page.locator('.ticket-id-chip') }).first();
    if (await firstDataRow.count()) {
    const layout = await firstDataRow.evaluate((row) => {
      const cells = Array.from(row.cells);
      const status = row.querySelectorAll('.status-pill')[1];
      const actions = row.querySelector('.ticket-actions');
      const statusCell = cells[9];
      const actionCell = cells[11];
      const inside = (child, parent) => {
        const childRect = child.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        return childRect.left >= parentRect.left - 1
          && childRect.right <= parentRect.right + 1
          && childRect.top >= parentRect.top - 1
          && childRect.bottom <= parentRect.bottom + 1;
      };
      return {
        adjacentCells: cells.slice(0, -1).every((cell, index) => cell.getBoundingClientRect().right <= cells[index + 1].getBoundingClientRect().left + 1),
        statusInside: Boolean(status && statusCell && inside(status, statusCell)),
        actionsInside: Boolean(actions && actionCell && inside(actions, actionCell))
      };
    });
    assert(layout.adjacentCells, 'Ticket table cells overlap horizontally.');
    assert(layout.statusInside, 'Ticket status pill escapes its table cell.');
    assert(layout.actionsInside, 'Ticket actions escape their table cell.');
    }
    await page.screenshot({ path: 'tmp-ticket-ui.png', fullPage: true });
  } finally {
    await browser.close();
  }
  assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
}

if (failures.length) throw new Error(failures.join('\n'));
console.log('Ticket UI workflow verification passed without database mutations.');
if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
