import 'dotenv/config';
import { chromium } from 'playwright-core';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { employeeToken, normalizeEmployee } from '../services/auth.service.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const outputPrefix = process.env.PARITY_SCREEN_PREFIX || 'tmp-mern-parity';
const routes = [
  ['dashboard', '/'],
  ['attendance', '/attendance'],
  ['tickets', '/ticket-system'],
  ['forms', '/forms-portal'],
  ['reports', '/reports']
];

function findEmployee(rows) {
  const requested = String(process.env.PARITY_USER || 'NL106').trim().toUpperCase();
  return rows.find((row) => String(row['Employee ID'] || row.employeeId || '').trim().toUpperCase() === requested) || rows[0];
}

await connectDatabase();
const rows = await listRows('User');
const user = findEmployee(rows);
if (!user) throw new Error('No employee exists in MongoDB for visual verification.');

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
const failures = [];

try {
  for (const [name, route] of routes) {
    const page = await browser.newPage({ viewport: { width: 1500, height: 850 } });
    const pageFailures = [];
    page.on('pageerror', (error) => pageFailures.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) pageFailures.push(`${message.type()}: ${message.text()}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) pageFailures.push(`${response.status()} ${response.url()}`);
    });
    try {
      await page.addInitScript((value) => {
        localStorage.setItem('worktrack.mern.employeeSession', JSON.stringify(value));
      }, { user: normalizeEmployee(user), token: employeeToken(normalizeEmployee(user)) });
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.screenshot({ path: `${outputPrefix}-${name}.png`, fullPage: true });
      const state = await page.evaluate(() => ({
        path: window.location.pathname,
        hasRoot: Boolean(document.querySelector('#root')),
        hasShell: Boolean(document.querySelector('.app-shell')),
        body: document.body.innerText
      }));
      if (!state.hasRoot || !state.hasShell || state.path === '/login') {
        failures.push(`${name}: protected React shell did not render (${state.path})`);
      }
      if (/Invalid Date|NaN|undefined undefined/.test(state.body)) failures.push(`${name}: invalid text rendered`);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    } finally {
      if (pageFailures.length) failures.push(`${name}: ${[...new Set(pageFailures)].join('\n')}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log(`MERN visual smoke capture passed for ${routes.length} routes as ${user['Employee ID'] || user.employeeId}.`);
