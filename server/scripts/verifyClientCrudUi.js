import 'dotenv/config';
import mongoose from 'mongoose';
import { chromium } from 'playwright-core';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { employeeToken, normalizeEmployee } from '../services/auth.service.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const prefix = `UI_CLIENT_VERIFY_${Date.now()}`;
const fail = (message) => { throw new Error(message); };

await connectDatabase();
let browser;
try {
  const users = await listRows('User');
  const source = users.find((row) => /^super admin$/i.test(String(row.Role || row.role || '')) && !/^inactive$/i.test(String(row.Status || 'Active')));
  if (!source) fail('No active Super Admin exists for client CRUD UI verification.');
  const user = normalizeEmployee(source);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  page.setDefaultTimeout(10000);
  await page.addInitScript((session) => {
    localStorage.setItem('worktrack.mern.employeeSession', JSON.stringify(session));
  }, { user, token: employeeToken(user) });
  await page.goto(`${baseUrl}/clients-portal`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Clients Portal/i }).waitFor();
  const addClientButton = page.getByRole('button', { name: /Add Client/i });
  await addClientButton.waitFor({ state: 'visible', timeout: 15000 });
  await addClientButton.click();
  await page.getByLabel('Client Name').fill(`${prefix} name`);
  await page.getByLabel('Password').fill('UiVerifyPass123');
  await page.getByRole('button', { name: 'Save Details', exact: true }).click();
  const createdRow = page.locator('tr').filter({ hasText: `${prefix} name` }).first();
  await createdRow.waitFor();

  await createdRow.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Client Name').fill(`${prefix} edited`);
  await page.getByRole('button', { name: 'Save Details', exact: true }).click();
  const editedRow = page.locator('tr').filter({ hasText: `${prefix} edited` }).first();
  await editedRow.waitFor();

  await editedRow.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Client', exact: true }).click();
  const finalRow = page.locator('tr').filter({ hasText: `${prefix} edited` }).first();
  await finalRow.waitFor({ state: 'detached' });
  console.log('Client CRUD UI verification passed.');
} finally {
  await LegacyModels.Client.deleteMany({ 'data.Client Name': { $regex: `^${prefix}` } });
  if (browser) await browser.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
