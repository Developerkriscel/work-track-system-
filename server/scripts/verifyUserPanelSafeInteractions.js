import 'dotenv/config';
import { chromium } from 'playwright-core';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { employeeToken, normalizeEmployee } from '../services/auth.service.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const requestedUsers = (process.env.USER_PANEL_VERIFY_USERS || 'VK,KR203,NL106,AS101')
  .split(',')
  .map((id) => id.trim().toUpperCase())
  .filter(Boolean);
const commonRoutes = [
  '/',
  '/attendance',
  '/ticket-system',
  '/fms-tracker',
  '/approvals',
  '/forms-portal',
  '/todo',
  '/expenses'
];
const restrictedRoutes = [
  '/clients-portal',
  '/management-dashboard',
  '/dashboard',
  '/admin'
];
const failures = [];

function findEmployee(users, requestedId) {
  return users.find((row) => {
    const id = row['Employee ID'] || row.employeeId || row['User ID'] || row.EmpID;
    return String(id || '').trim().toUpperCase() === requestedId;
  });
}

async function runForUser(browser, user, requestedId, expectedClientId = '') {
  const normalized = normalizeEmployee(user);
  const role = String(normalized.Role || '').toLowerCase();
  const routes = [
    ...commonRoutes,
    ...( /manager|admin|hr|super admin/.test(role) ? ['/reports'] : []),
    ...( /admin|super admin/.test(role) ? ['/clients-portal'] : []),
    ...( /admin|hr|super admin/.test(role) ? ['/admin'] : []),
    ...( /manager|admin|hr|super admin/.test(role) ? ['/management-dashboard', '/dashboard'] : [])
  ];
  const page = await browser.newPage({ viewport: { width: 1500, height: 850 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  const failedResponses = [];

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  try {
    const session = { user: normalized, token: employeeToken(normalized) };
    await page.addInitScript((value) => {
      localStorage.setItem('worktrack.mern.employeeSession', JSON.stringify(value));
    }, session);

    for (const route of routes) {
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (error) {
        failures.push(`${requestedId}${route}: navigation failed ${error.message}`);
        continue;
      }
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => ({
        url: window.location.pathname,
        title: document.title,
        body: document.body.innerText,
        hasReactRoot: Boolean(document.querySelector('#root'))
      }));
      if (!state.hasReactRoot || state.url === '/login') {
        failures.push(`${requestedId}${route}: session did not render protected React route (${state.url})`);
      }
      if (/Invalid Date|NaN|undefined undefined/.test(state.body)) {
        failures.push(`${requestedId}${route}: invalid text rendered`);
      }

      if (route === '/clients-portal') {
        if (expectedClientId && !state.body.includes(expectedClientId)) {
          failures.push(`${requestedId}: Clients Portal did not render Mongo client ${expectedClientId}.`);
        }
        if (/No clients found for the selected filters/i.test(state.body)) {
          failures.push(`${requestedId}: Clients Portal rendered an empty client list despite Mongo client data.`);
        }
        const addClientButton = page.getByRole('button', { name: /Add Client/i });
        const shouldSeeAddClient = /super admin/.test(role);
        const addClientCount = await addClientButton.count();
        if (Boolean(addClientCount) !== shouldSeeAddClient) {
          failures.push(`${requestedId}: Add Client visibility mismatch in Clients Portal.`);
        }
        if (shouldSeeAddClient && addClientCount) {
          await addClientButton.click();
          if (!await page.getByRole('heading', { name: 'Add Client', exact: true }).isVisible()) {
            failures.push(`${requestedId}: Add Client form did not open.`);
          }
          await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        }
      }
    }

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(700);
    const reportsNavCount = await page.locator('.sidebar__nav a', { hasText: 'Reports' }).count();
    const shouldSeeReports = /manager|admin|hr|super admin/.test(role);
    if (Boolean(reportsNavCount) !== shouldSeeReports) {
      failures.push(`${requestedId}: Reports navigation visibility mismatch.`);
    }

    const clientsPortalNavCount = await page.locator('.sidebar__nav a', { hasText: 'Clients Portal' }).count();
    const shouldSeeClientsPortal = /^(admin|super admin)$/.test(role);
    if (Boolean(clientsPortalNavCount) !== shouldSeeClientsPortal) {
      failures.push(`${requestedId}: Clients Portal navigation visibility mismatch.`);
    }

    if (!shouldSeeClientsPortal) {
      await page.goto(`${baseUrl}/clients-portal`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(500);
      const redirectedPath = await page.evaluate(() => window.location.pathname);
      if (redirectedPath === '/clients-portal') {
        failures.push(`${requestedId}: unauthorized user can still access /clients-portal directly.`);
      }

      const clientsResponse = await fetch(`${baseUrl}/api/clients-portal/list`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${employeeToken(normalized)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (clientsResponse.status !== 403) {
        failures.push(`${requestedId}: unauthorized Clients Portal API returned HTTP ${clientsResponse.status}, expected 403.`);
      }
    }

    if (!shouldSeeReports) {
      await page.goto(`${baseUrl}/reports`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(500);
      const redirectedPath = await page.evaluate(() => window.location.pathname);
      if (redirectedPath === '/reports') {
        failures.push(`${requestedId}: regular user can still access /reports directly.`);
      }

      const reportResponse = await fetch(`${baseUrl}/api/reports/tickets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${employeeToken(normalized)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startDate: null, endDate: null })
      });
      if (reportResponse.status !== 403) {
        failures.push(`${requestedId}: regular user report API returned HTTP ${reportResponse.status}, expected 403.`);
      }
    }

    if (errors.length) failures.push(`${requestedId}: ${[...new Set(errors)].join('\n')}`);
    if (failedResponses.length) failures.push(`${requestedId}: failed API responses\n${[...new Set(failedResponses)].join('\n')}`);
  } catch (error) {
    failures.push(`${requestedId}: ${error.message}`);
  } finally {
    await page.close();
  }
}

await connectDatabase();
const users = await listRows('User');
const clients = await listRows('Client');
const expectedClientId = clients
  .map((row) => row.Client_Id || row['Client ID'] || row.CustomerID || row.clientId)
  .find(Boolean) || '';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});

try {
  for (const requestedId of requestedUsers) {
    const user = findEmployee(users, requestedId);
    if (!user) {
      failures.push(`${requestedId}: employee not found in MongoDB.`);
      continue;
    }
    await runForUser(browser, user, requestedId, expectedClientId);
  }
} finally {
  await browser.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log(`MERN user-panel route verification passed for ${requestedUsers.join(', ')}.`);
