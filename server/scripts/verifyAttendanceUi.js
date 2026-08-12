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
assert(Boolean(rawUser), 'No active employee is available for Attendance UI verification.');

if (rawUser) {
  const user = normalizeEmployee(rawUser);
  const role = String(user?.Role || user?.role || '').trim().toLowerCase();
  const canManageTeamAttendance = /^(admin|super admin|hr|manager)$/.test(role);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const context = await browser.newContext({
    viewport: { width: 1500, height: 850 },
    permissions: ['camera', 'geolocation'],
    geolocation: { latitude: 28.6139, longitude: 77.2090 }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });

  try {
    await page.addInitScript((session) => {
      localStorage.setItem('worktrack.mern.employeeSession', JSON.stringify(session));
    }, { user, token: employeeToken(user) });
    await page.goto(`${baseUrl}/attendance`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    assert(await page.getByRole('button', { name: 'Attendance Log', exact: true }).isVisible(), 'Attendance Log tab is missing.');
    if (canManageTeamAttendance) {
      assert(await page.getByRole('button', { name: 'Team Attendance', exact: true }).isVisible(), 'Team Attendance tab is missing for privileged role.');
      if (/^(admin|super admin|hr)$/.test(role)) {
        assert(await page.getByRole('button', { name: 'Location Policy', exact: true }).isVisible(), 'Location Policy button is missing for privileged role.');
        await page.getByRole('button', { name: 'Location Policy', exact: true }).click();
        await page.getByRole('dialog', { name: 'Attendance Location Policy' }).waitFor({ state: 'visible', timeout: 5000 });
        await page.getByRole('dialog', { name: 'Attendance Location Policy' }).getByRole('button', { name: 'Close dialog', exact: true }).click();
      } else {
        assert(await page.getByRole('button', { name: 'Location Policy', exact: true }).count() === 0, 'Location Policy should stay hidden for manager.');
      }
      await page.getByRole('button', { name: 'Team Attendance', exact: true }).click();
      await page.getByRole('heading', { name: 'Team Attendance' }).waitFor({ state: 'visible', timeout: 5000 });
    } else {
      assert(await page.getByRole('button', { name: 'Team Attendance', exact: true }).count() === 0, 'Team Attendance tab should stay hidden for a non-privileged role.');
      assert(await page.getByRole('button', { name: 'Location Policy', exact: true }).count() === 0, 'Location Policy button should stay hidden for a non-privileged role.');
    }

    await page.getByRole('button', { name: 'Punch', exact: true }).click();
    await page.getByRole('heading', { name: 'New Attendance Entry' }).waitFor({ state: 'visible' });

    assert(await page.getByRole('button', { name: 'Attendance Punch' }).isVisible(), 'Attendance Punch tab is missing.');
    assert(await page.getByRole('button', { name: 'Capture', exact: true }).isVisible(), 'Capture button is missing.');
    assert(await page.getByRole('button', { name: 'Retake', exact: true }).count() === 0, 'Retake is visible before photo capture.');
    assert(await page.getByRole('button', { name: 'Punch In', exact: true }).isDisabled() || await page.getByRole('button', { name: 'Punch Out', exact: true }).isDisabled(), 'Both punch buttons are enabled before photo capture.');

    await page.getByRole('button', { name: 'Capture', exact: true }).click();
    await page.locator('img.attendance-captured-photo').waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path: 'tmp-attendance-captured.png', fullPage: true });
    const visibleMediaCount = await page.locator('.attendance-camera-card img, .attendance-camera-card video, .attendance-camera-card canvas').evaluateAll((nodes) => nodes.filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }).length);
    assert(await page.locator('img.attendance-captured-photo').count() === 1, 'Capture rendered more than one captured image.');
    assert(await page.locator('.attendance-camera-card video').count() === 0, 'Live camera video remained visible after capture.');
    assert(await page.locator('.attendance-camera-card canvas').evaluate((element) => getComputedStyle(element).display === 'none'), 'Capture canvas remained visible after capture.');
    assert(visibleMediaCount === 1, `Expected one visible camera image after capture, found ${visibleMediaCount}.`);
    assert(await page.getByRole('button', { name: 'Capture', exact: true }).count() === 0, 'Capture button remained after photo capture.');
    assert(await page.getByRole('button', { name: 'Retake', exact: true }).count() === 1, 'Retake button did not replace Capture after photo capture.');

    await page.getByRole('button', { name: 'Leave Request' }).click();
    assert(await page.getByText('Leave Type', { exact: true }).isVisible(), 'Leave form did not open.');
    await page.getByRole('button', { name: 'Work Intimation' }).click();
    assert(await page.getByText('Intimation Type', { exact: true }).isVisible(), 'Intimation form did not open.');
  } catch (error) {
    failures.push(`Attendance UI navigation failed: ${error.message}`);
  } finally {
    if (errors.length) failures.push([...new Set(errors)].join('\n'));
    await context.close();
    await browser.close();
  }
}

if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}
console.log('Attendance UI workflow verification passed without database mutations.');
