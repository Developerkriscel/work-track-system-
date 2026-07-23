import 'dotenv/config';
import mongoose from 'mongoose';
import { chromium } from 'playwright-core';
import { connectDatabase } from '../config/database.js';
import { clientToken, normalizeClient } from '../services/auth.service.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const routes = ['/client', '/client/tickets', '/client/social', '/client/invoices', '/client/reports'];
const failures = [];

await connectDatabase();
const clients = await listRows('Client');
const client = clients.find((row) => String(row.Status || row.status || 'Active').toLowerCase() === 'active');
if (!client) throw new Error('No active Mongo client is available for client-panel verification.');

const normalized = normalizeClient(client);
const session = { client: normalized, token: clientToken(normalized) };
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});

try {
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

  await page.addInitScript((value) => {
    localStorage.setItem('worktrack.mern.clientSession', JSON.stringify(value));
  }, session);

  for (const route of routes) {
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => ({
        url: window.location.pathname,
        hasReactRoot: Boolean(document.querySelector('#root')),
        body: document.body.innerText
      }));
      if (!state.hasReactRoot || state.url === '/client/login') {
        failures.push(`${route}: client session did not render protected React route (${state.url})`);
      }
      if (/Invalid Date|NaN|undefined undefined/.test(state.body)) failures.push(`${route}: invalid text rendered`);
    } catch (error) {
      failures.push(`${route}: navigation failed ${error.message}`);
    }
  }

  if (errors.length) failures.push(`client: ${[...new Set(errors)].join('\n')}`);
  if (failedResponses.length) failures.push(`client failed API responses\n${[...new Set(failedResponses)].join('\n')}`);
  await page.close();
} finally {
  await browser.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log(`MERN client-panel route verification passed for ${normalized.Client_Id}.`);
