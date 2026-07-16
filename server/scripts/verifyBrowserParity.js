import { chromium } from 'playwright-core';
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { connectDatabase } from '../config/database.js';
import { purgeTestArtifacts } from './testArtifactCleanup.js';

const baseUrl = process.env.PARITY_URL || 'http://localhost:5173';
const employeeId = process.env.PARITY_EMPLOYEE_ID || 'VK';
const fmsEmployeeId = process.env.PARITY_FMS_EMPLOYEE_ID || employeeId;
const clientId = process.env.PARITY_CLIENT_ID || 'CL000';
const password = process.env.PARITY_PASSWORD;
const clientPassword = process.env.PARITY_CLIENT_PASSWORD;
const viewport = { width: 1919, height: 914 };
const referenceDate = new Date(`${process.env.WORKTRACK_REFERENCE_DATE || '2026-07-03'}T12:00:00+05:30`);
const demoDate = referenceDate.toISOString().slice(0, 10);
const failures = [];
const profileDir = fs.mkdtempSync(path.join(process.cwd(), '.worktrack-browser-profile-'));

function requireEnvCredential(value, name) {
  if (!value) {
    throw new Error(`${name} is required. Browser parity must use credentials from MongoDB data, supplied through environment variables.`);
  }
  return value;
}

requireEnvCredential(password, 'PARITY_PASSWORD');
requireEnvCredential(clientPassword, 'PARITY_CLIENT_PASSWORD');

async function waitForEmployeeShell(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const nav = document.querySelector('#user-nav-links');
    return !!nav && !nav.classList.contains('hidden');
  }, null, { timeout });
}

async function ensureEmployeeLoggedIn(page) {
  const state = await page.waitForFunction(() => {
    const nav = document.querySelector('#user-nav-links');
    if (nav && !nav.classList.contains('hidden')) return 'shell';
    const login = document.querySelector('#login-employee-id');
    if (!login) return '';
    const box = login.getBoundingClientRect();
    const style = getComputedStyle(login);
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' ? 'login' : '';
  }, null, { timeout: 30000 }).then((handle) => handle.jsonValue());
  if (state === 'login') {
    const currentState = await page.evaluate(() => {
      const nav = document.querySelector('#user-nav-links');
      if (nav && !nav.classList.contains('hidden')) return 'shell';
      const login = document.querySelector('#login-employee-id');
      if (!login) return '';
      const box = login.getBoundingClientRect();
      const style = getComputedStyle(login);
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' ? 'login' : '';
    });
    if (currentState === 'login') {
      await page.evaluate(({ employeeId, password }) => {
        document.querySelector('#login-employee-id').value = employeeId;
        document.querySelector('#login-password').value = password;
        document.querySelector('#login-button').click();
      }, { employeeId, password });
    }
  }
  await waitForEmployeeShell(page);
}

async function ensureClientLoggedIn(page) {
  const state = await page.waitForFunction(() => {
    const sidebar = document.querySelector('#sidebar');
    const header = document.querySelector('#header-title');
    if (sidebar && header && !sidebar.classList.contains('hidden')) return 'shell';
    const login = document.querySelector('#login-client-id');
    if (!login) return '';
    const box = login.getBoundingClientRect();
    const style = getComputedStyle(login);
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' ? 'login' : '';
  }, null, { timeout: 30000 }).then((handle) => handle.jsonValue());
  if (state === 'login') {
    await page.fill('#login-client-id', clientId);
    await page.fill('#login-password', clientPassword);
    await page.click('#login-button');
  }
  await page.waitForFunction(() => {
    const sidebar = document.querySelector('#sidebar');
    const header = document.querySelector('#header-title');
    return !!sidebar && !!header && !sidebar.classList.contains('hidden');
  }, null, { timeout: 30000 });
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function watchPage(page, label) {
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    const text = message.text();
    if (['error', 'warning'].includes(message.type()) && !text.includes('cdn.tailwindcss.com')) {
      consoleErrors.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  return () => {
    if (consoleErrors.length) failures.push(`${label} browser console errors:\n${consoleErrors.join('\n')}`);
    if (failedResponses.length) failures.push(`${label} failed network responses:\n${[...new Set(failedResponses)].join('\n')}`);
  };
}

async function createParityPage(browser) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript((stamp) => {
    window.WORKTRACK_REFERENCE_DATE = stamp;
  }, referenceDate.toISOString());
  return page;
}

async function verifyWorkTrack(browser) {
  const page = await createParityPage(browser);
  const collectFailures = watchPage(page, 'WorkTrack');

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('currentUser', JSON.stringify({ name: 'Old Generated User', company: 'Acme Retail' })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert(await page.locator('#login-employee-id').count(), 'Invalid stale currentUser did not return to WorkTrack login.');
  const staleUserCleared = await page.evaluate(() => localStorage.getItem('currentUser') === null);
  assert(staleUserCleared, 'Invalid stale currentUser was not cleared.');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  assert(await page.locator('#login-employee-id').count(), 'Employee login field not found on WorkTrack root.');
  await ensureEmployeeLoggedIn(page);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    if (typeof stopNotificationPolling === 'function') stopNotificationPolling();
  });

  const shell = await page.evaluate(() => ({
    title: document.title,
    hasRoot: !!document.querySelector('#root'),
    hasGeneratedRail: !!document.querySelector('.portal-rail'),
    hasGeneratedChat: /Discussion Center|Track tickets|Client Portal\s+Acme Retail/.test(document.body.innerText),
    sidebar: document.querySelector('#sidebar')?.innerText || '',
    scaleStyle: !!document.querySelector('#mern-appscript-viewport-scale'),
    cacheCleanup: !!document.querySelector('#mern-cache-cleanup'),
    zoom: getComputedStyle(document.documentElement).zoom,
    logoLoaded: (() => {
      const logo = document.querySelector('.sidebar-logo-img');
      return !!logo && logo.getAttribute('src') === '/worktrack-logo.png' && logo.naturalWidth > 0;
    })()
  }));

  assert(shell.title === 'Work_Track_System', `Unexpected WorkTrack title: ${shell.title}`);
  assert(!shell.hasRoot, 'React #root exists in rendered WorkTrack page.');
  assert(!shell.hasGeneratedRail, 'Generated portal rail exists in rendered WorkTrack page.');
  assert(!shell.hasGeneratedChat, 'Generated Client Portal/Chat text exists in rendered WorkTrack page.');
  assert(shell.scaleStyle, 'Apps Script viewport scale style missing.');
  assert(shell.cacheCleanup, 'Cache cleanup script missing from WorkTrack page.');
  assert(shell.zoom === '0.85', `Unexpected Apps Script viewport zoom: ${shell.zoom}`);
  assert(shell.logoLoaded, 'WorkTrack sidebar logo did not render from local asset.');
  assert(shell.sidebar.includes('Work Track System'), 'Original WorkTrack sidebar text missing.');
  assert(shell.sidebar.includes('Attendance'), 'Attendance nav missing from original sidebar.');

  await page.evaluate(() => document.querySelector('.nav-link[data-view="home-view"]')?.click());
  await page.waitForTimeout(2200);
  const dashboard = await page.evaluate(() => ({
    header: document.querySelector('#mobile-header-title')?.innerText || '',
    ticketBadge: document.querySelector('#sidebar-count-ticket')?.innerText || '',
    activeFilter: document.querySelector('#dashboard-range-select option:checked')?.innerText || '',
    text: document.querySelector('#home-view')?.innerText || '',
    invalid: /Invalid Date|NaN/.test(document.body.innerText),
    layout: (() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
      };
      return {
        sidebar: rect('#sidebar'),
        home: rect('#home-view'),
        firstCard: rect('#home-view .kpi-card')
      };
    })()
  }));
  assert(dashboard.header === 'Home', `Dashboard header mismatch: ${dashboard.header}`);
  assert(/^\d+$/.test(dashboard.ticketBadge) && Number(dashboard.ticketBadge) >= 1, `Sidebar ticket badge mismatch: ${dashboard.ticketBadge}`);
  assert(dashboard.activeFilter === 'This Month', `Dashboard active filter mismatch: ${dashboard.activeFilter}`);
  assert(dashboard.layout.sidebar?.w >= 216 && dashboard.layout.sidebar?.w <= 220, `Scaled sidebar width mismatch: ${dashboard.layout.sidebar?.w}`);
  assert(dashboard.layout.sidebar?.h === viewport.height, `Scaled sidebar height mismatch: ${dashboard.layout.sidebar?.h}`);
  assert(dashboard.layout.home?.x >= 250 && dashboard.layout.home?.x <= 254, `Scaled content x mismatch: ${dashboard.layout.home?.x}`);
  assert(dashboard.layout.home?.y >= 60 && dashboard.layout.home?.y <= 64, `Scaled content y mismatch: ${dashboard.layout.home?.y}`);
  assert(dashboard.layout.firstCard?.y >= 154 && dashboard.layout.firstCard?.y <= 160, `Scaled dashboard card y mismatch: ${dashboard.layout.firstCard?.y}`);
  assert(dashboard.layout.firstCard?.h >= 108 && dashboard.layout.firstCard?.h <= 112, `Scaled dashboard card height mismatch: ${dashboard.layout.firstCard?.h}`);
  for (const expectedText of ['TICKETS PENDING', 'OVERDUE', 'IDLE GAP TIME', 'PRODUCTIVE TIME', 'Planned', 'Completed']) {
    assert(dashboard.text.includes(expectedText), `Dashboard reference text missing: ${expectedText}`);
  }
  assert(/\d+h \d+m/.test(dashboard.text), 'Dashboard summary durations are missing.');
  assert(dashboard.text.includes('Today Summary'), 'Dashboard summary label does not match reference.');
  assert(!dashboard.text.includes('Month Summary'), 'Dashboard summary label changed away from reference.');
  assert(!dashboard.invalid, 'Dashboard page contains Invalid Date or NaN.');

  let upcomingState = null;
  for (const typeLabel of ['Ticket', 'FMS', '']) {
    const typeSelector = typeLabel
      ? `#upcoming-tasks-type-filters button[data-filter="${typeLabel}"]`
      : '#upcoming-tasks-type-filters button[data-filter=""]';
    await page.evaluate(() => document.querySelector('#upcoming-tasks-date-filters button[data-range="custom"]')?.click());
    await page.locator('#upcoming-custom-range-picker').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(150);
    await page.fill('#upcoming-start-date', demoDate);
    await page.fill('#upcoming-end-date', demoDate);
    await page.click(typeSelector);
    await page.waitForTimeout(150);
    await page.click('#upcoming-fetch-btn');
    await page.waitForTimeout(800);
    upcomingState = await page.evaluate(() => ({
      range: document.querySelector('#upcoming-tasks-date-filters button.active')?.getAttribute('data-range') || '',
      type: document.querySelector('#upcoming-tasks-type-filters button.active')?.getAttribute('data-filter') || '',
      start: document.querySelector('#upcoming-start-date')?.value || '',
      end: document.querySelector('#upcoming-end-date')?.value || '',
      rows: document.querySelectorAll('#upcoming-tasks-table tbody tr').length,
      pickerHidden: document.querySelector('#upcoming-custom-range-picker')?.classList.contains('hidden'),
      invalid: /Invalid Date|NaN/.test(document.body.innerText)
    }));
    if (upcomingState.rows > 0) break;
  }
  assert(upcomingState && upcomingState.range === 'custom', `Upcoming tasks did not keep custom range active: ${upcomingState && upcomingState.range}`);
  assert(upcomingState.start === demoDate && upcomingState.end === demoDate, `Upcoming tasks custom dates mismatch: ${upcomingState.start} to ${upcomingState.end}`);
  assert(!upcomingState.pickerHidden, 'Upcoming custom picker hid itself after apply.');
  assert(!upcomingState.invalid, 'Upcoming tasks contain Invalid Date or NaN before reload.');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForEmployeeShell(page);
  await page.waitForTimeout(2200);
  const upcomingReload = await page.evaluate(() => ({
    range: document.querySelector('#upcoming-tasks-date-filters button.active')?.getAttribute('data-range') || '',
    type: document.querySelector('#upcoming-tasks-type-filters button.active')?.getAttribute('data-filter') || '',
    start: document.querySelector('#upcoming-start-date')?.value || '',
    end: document.querySelector('#upcoming-end-date')?.value || '',
    rows: document.querySelectorAll('#upcoming-tasks-table tbody tr').length,
    pickerHidden: document.querySelector('#upcoming-custom-range-picker')?.classList.contains('hidden'),
    invalid: /Invalid Date|NaN/.test(document.body.innerText)
  }));
  assert(upcomingReload.range === upcomingState.range, `Upcoming tasks range did not restore after reload: ${upcomingReload.range}`);
  assert(upcomingReload.type === upcomingState.type, `Upcoming tasks type did not restore after reload: ${upcomingReload.type}`);
  assert(upcomingReload.start === demoDate && upcomingReload.end === demoDate, `Upcoming tasks dates did not restore after reload: ${upcomingReload.start} to ${upcomingReload.end}`);
  assert(!upcomingReload.pickerHidden, 'Upcoming custom picker hid itself after reload.');
  assert(upcomingReload.rows === upcomingState.rows, `Upcoming tasks row count changed after reload: ${upcomingState.rows} -> ${upcomingReload.rows}`);
  assert(!upcomingReload.invalid, 'Upcoming tasks contain Invalid Date or NaN after reload.');

  await page.screenshot({ path: 'tmp-live-dashboard.png', fullPage: false });

  await page.evaluate(() => document.querySelector('.nav-link[data-view="attendance-view"]')?.click());
  await page.locator('#attendance-view').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const select = document.querySelector('#attendance-range-select');
    if (!select) return;
    select.value = 'last_month';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1800);
  const attendance = await page.evaluate(() => ({
    header: document.querySelector('#mobile-header-title')?.innerText || '',
    activeFilter: document.querySelector('#attendance-range-select option:checked')?.innerText || '',
    liveTimer: document.querySelector('#live-timer')?.innerText || '',
    timerVisible: !document.querySelector('#punch-in-timer-container')?.classList.contains('hidden'),
    rows: document.querySelectorAll('#attendance-history-table tbody tr').length,
    text: document.querySelector('#attendance-view')?.innerText || '',
    invalid: /Invalid Date|NaN/.test(document.body.innerText)
  }));
  assert(attendance.header === 'Attendance', `Attendance header mismatch: ${attendance.header}`);
  assert(attendance.activeFilter === 'Last Month', `Attendance active filter mismatch: ${attendance.activeFilter}`);
  if (attendance.timerVisible) {
    assert(/^\d{2}:\d{2}:\d{2}$/.test(attendance.liveTimer), `Attendance live timer mismatch: ${attendance.liveTimer}`);
  }
  assert(attendance.text.includes('Attendance & Activity Log'), 'Attendance title missing.');
  assert(attendance.rows >= 1, `Expected at least 1 attendance row from Mongo, found ${attendance.rows}.`);
  assert(!attendance.invalid, 'Attendance page contains Invalid Date or NaN.');
  await page.screenshot({ path: 'tmp-live-attendance.png', fullPage: false });

  for (const workflow of [
    { button: '#btn-open-punch', tab: 'Attendance Punch', visiblePane: '#punch-tab', expectedText: 'Capture' },
    { button: '#btn-open-leave', tab: 'Leave Request', visiblePane: '#leave-tab', expectedText: 'Submit Leave Request' },
    { button: '#btn-open-intimation', tab: 'Work Intimation', visiblePane: '#intimation-tab', expectedText: 'Submit Intimation' }
  ]) {
    await page.evaluate((selector) => document.querySelector(selector)?.click(), workflow.button);
    await page.waitForTimeout(400);
    const form = await page.evaluate((workflow) => ({
      hidden: document.querySelector('#attendance-form-container')?.classList.contains('hidden'),
      activeTab: document.querySelector('#attendance-tabs .active')?.innerText || '',
      paneVisible: !document.querySelector(workflow.visiblePane)?.classList.contains('hidden'),
      text: document.querySelector('#attendance-form-container')?.innerText || ''
    }), workflow);
    assert(!form.hidden, `${workflow.tab} form did not open.`);
    assert(form.activeTab === workflow.tab, `${workflow.tab} active tab mismatch: ${form.activeTab}`);
    assert(form.paneVisible, `${workflow.tab} pane is not visible.`);
    assert(form.text.includes(workflow.expectedText), `${workflow.tab} form text missing: ${workflow.expectedText}`);
  }

  await page.evaluate(() => document.querySelector('.nav-link[data-view="ticket-system-view"]')?.click());
  await page.waitForTimeout(2500);
  const tickets = await page.evaluate(() => ({
    header: document.querySelector('#mobile-header-title')?.innerText || '',
    rows: document.querySelectorAll('#ticket-table tbody tr').length,
    text: document.querySelector('#ticket-system-view')?.innerText || '',
    invalid: /Invalid Date|NaN/.test(document.body.innerText)
  }));
  assert(tickets.header === 'Ticket System', `Ticket header mismatch: ${tickets.header}`);
  assert(tickets.rows >= 6, `Expected at least 6 ticket rows, found ${tickets.rows}.`);
  assert(tickets.text.includes('ADVANCED FILTERS'), 'Ticket advanced filters missing.');
  assert(tickets.text.includes('Kriscel Tech Private Limited'), 'Kriscel client ticket rows missing.');
  assert(tickets.text.includes('PENDING APPROVAL'), 'Pending approval ticket status missing.');
  assert(tickets.text.includes('2h 51m') && tickets.text.includes('Running (+171m)'), 'Reference in-progress ticket duration missing.');
  assert(!tickets.invalid, 'Ticket page contains Invalid Date or NaN.');
  await page.screenshot({ path: 'tmp-live-tickets.png', fullPage: false });

  await page.evaluate(() => document.querySelector('#show-ticket-form-btn')?.click());
  await page.waitForTimeout(700);
  const ticketCreate = await page.evaluate(() => ({
    hidden: document.querySelector('#ticket-creation-form-container')?.classList.contains('hidden'),
    title: document.querySelector('#ticket-creation-form-container h3')?.innerText || '',
    rows: document.querySelectorAll('#bulk-tickets-container .ticket-row').length,
    clientOptions: document.querySelectorAll('#bulk-tickets-container .input-client option').length,
    categoryText: [...document.querySelectorAll('#bulk-tickets-container .input-category option')].map((option) => option.textContent.trim()).join('|'),
    text: document.querySelector('#ticket-creation-form-container')?.innerText || ''
  }));
  assert(!ticketCreate.hidden, 'Ticket creation form did not open.');
  assert(ticketCreate.title === 'Create New Ticket(s)', `Ticket creation title mismatch: ${ticketCreate.title}`);
  assert(ticketCreate.rows === 1, `Ticket creation row count mismatch: ${ticketCreate.rows}`);
  assert(ticketCreate.clientOptions >= 2, 'Ticket creation client dropdown did not populate.');
  assert(ticketCreate.categoryText.includes('Documentation'), 'Ticket creation category dropdown missing Documentation.');
  assert(!ticketCreate.categoryText.includes('[object Object]'), 'Ticket creation category dropdown rendered object labels.');
  assert(ticketCreate.text.includes('Submit All Tickets') && ticketCreate.text.includes('Add Another Ticket'), 'Ticket creation buttons missing.');
  await page.evaluate(() => document.querySelector('#cancel-ticket-form-btn')?.click());
  await page.waitForTimeout(300);

  for (const action of [
    { selector: '.action-end-task', title: 'Complete Task?', expected: 'Mark as Completed' },
    { selector: '.action-update-schedule', title: 'Update Schedule', expected: 'Reason for Update' },
    { selector: '.action-reassign-user', title: 'Assign / Transfer Ticket', expected: 'Transfer Ticket' },
    { selector: '.action-reassign-client', title: 'Send to Client', expected: 'OK' }
  ]) {
    await page.evaluate((selector) => document.querySelector(selector)?.click(), `#ticket-table tbody tr:first-child ${action.selector}`);
    await page.waitForTimeout(500);
    const modal = await page.evaluate((action) => ({
      open: !!document.querySelector('.swal2-popup'),
      title: document.querySelector('.swal2-title')?.innerText || '',
      text: document.querySelector('.swal2-popup')?.innerText || '',
      transferOptions: [...document.querySelectorAll('#swal-ticket-assign-select option')].map((option) => option.textContent.trim()).join('|'),
      hasTextarea: !!document.querySelector('.swal2-textarea, textarea')
    }), action);
    assert(modal.open, `${action.title} modal did not open.`);
    assert(modal.title.includes(action.title), `${action.title} modal title mismatch: ${modal.title}`);
    assert(modal.text.includes(action.expected), `${action.title} modal text missing: ${action.expected}`);
    if (action.selector === '.action-reassign-user') {
      assert(modal.transferOptions.includes('Kriscel Rao (KR203)'), 'Transfer Ticket options did not populate.');
    }
    if (action.selector === '.action-reassign-client') {
      assert(modal.hasTextarea, 'Send to Client reason textarea missing.');
    }
    await page.evaluate(() => {
      if (window.Swal && typeof window.Swal.close === 'function') window.Swal.close();
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    if (window.Swal && typeof window.Swal.close === 'function') window.Swal.close();
  });
  await page.waitForTimeout(250);

  await page.evaluate(() => document.querySelector('.nav-link[data-view="my-requests-view"]')?.click());
  await page.waitForTimeout(2500);
  const requests = await page.evaluate(() => ({
    header: document.querySelector('#mobile-header-title')?.innerText || '',
    rows: document.querySelectorAll('#my-requests-table tbody tr').length,
    text: document.querySelector('#my-requests-view')?.innerText || '',
    invalid: /Invalid Date|NaN/.test(document.body.innerText)
  }));
  assert(requests.header === 'My Requests', `My Requests header mismatch: ${requests.header}`);
  assert(requests.rows >= 1, `Expected at least 1 request row from Mongo, found ${requests.rows}.`);
  assert(/Punch In|Punch Out|Leave|Intimation/i.test(requests.text), 'My Requests did not render request activity text.');
  assert(requests.text.includes('Showing 1 to') && requests.text.includes('entries'), 'My Requests DataTable entry count missing.');
  assert(requests.text.includes('Previous') && requests.text.includes('Next'), 'My Requests pagination controls missing.');
  assert(!requests.invalid, 'My Requests page contains Invalid Date or NaN.');
  await page.screenshot({ path: 'tmp-live-requests.png', fullPage: false });

  await page.screenshot({ path: 'tmp-browser-parity-worktrack.png', fullPage: false });
  collectFailures();
  await page.close();
}

async function verifyAdditionalEmployeeModules(browser) {
  const page = await createParityPage(browser);
  const collectFailures = watchPage(page, 'Additional Employee Modules');

  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await ensureEmployeeLoggedIn(page);
  await page.waitForTimeout(1200);

  for (const module of [
    { view: 'fms-view', header: 'FMS Tracker', text: ['FMS Tracker', 'My Pending Future Tasks', 'Refresh Data'] },
    { view: 'forms-view', header: 'Forms Portal', text: ['Forms Portal', 'FILTER & SEARCH FORMS', 'Reset Filters'] },
    { view: 'expense-view', header: 'Expenses', text: ['My Expenses', 'Record New Expense', 'My Recent Expenses'] }
  ]) {
    await page.evaluate((selector) => document.querySelector(selector)?.click(), `.nav-link[data-view="${module.view}"]`);
    await page.waitForFunction(
      ({ view, expectedText }) => (document.querySelector(`#${view}`)?.innerText || '').includes(expectedText),
      { view: module.view, expectedText: module.text[0] },
      { timeout: 10000 }
    ).catch(() => {});
    await page.waitForTimeout(500);
    const state = await page.evaluate((module) => ({
      header: document.querySelector('#mobile-header-title')?.innerText || '',
      active: document.querySelector('.nav-link-active span')?.innerText || '',
      hidden: document.querySelector(`#${module.view}`)?.classList.contains('hidden'),
      text: (document.querySelector(`#${module.view}`)?.innerText || '').replace(/\s+/g, ' '),
      hasRoot: !!document.querySelector('#root'),
      generated: /Discussion Center|Track tickets|Client Portal\s+Acme Retail/.test(document.body.innerText),
      invalid: /Invalid Date|NaN/.test(document.body.innerText)
    }), module);
    assert(state.header === module.header, `${module.header} header mismatch: ${state.header}`);
    assert(!state.hidden, `${module.header} view is hidden after navigation.`);
    assert(!state.hasRoot, `${module.header} rendered React #root.`);
    assert(!state.generated, `${module.header} rendered generated UI text.`);
    assert(!state.invalid, `${module.header} contains Invalid Date or NaN.`);
    for (const expectedText of module.text) {
      assert(state.text.includes(expectedText.replace(/\s+/g, ' ')), `${module.header} text missing: ${expectedText}`);
    }
  }

  await page.evaluate(() => document.querySelector('.nav-link[data-view="forms-view"]')?.click());
  await page.waitForTimeout(1200);
  const formsState = await page.evaluate(async () => {
    const response = await fetch('/api/apps-script/getFormsData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: ['VK'] })
    });
    const payload = await response.json();
    return {
      payload,
      rows: document.querySelectorAll('#table-forms-portal tbody tr').length,
      text: (document.querySelector('#forms-view')?.innerText || '').replace(/\s+/g, ' '),
      invalid: /Invalid Date|NaN/.test(document.body.innerText)
    };
  });
  assert(formsState.payload.success && formsState.payload.data.length >= 4, `Forms Portal API expected Mongo rows, found ${formsState.payload.data?.length}.`);
  assert(
    formsState.payload.data[0].Department &&
    formsState.payload.data[0]['Sheet name'] &&
    Object.prototype.hasOwnProperty.call(formsState.payload.data[0], 'Form link'),
    'Forms Portal rows missing Department/Sheet name/Form link fields.'
  );
  assert(formsState.rows >= 4, `Forms Portal table expected rows, found ${formsState.rows}.`);
  assert(formsState.text.includes('Attendance Regularization') && formsState.text.includes('Expense Claim'), 'Forms Portal Mongo form rows missing from table.');
  assert(!formsState.invalid, 'Forms Portal table contains Invalid Date or NaN.');

  await page.evaluate(() => {
    if (typeof setView === 'function') setView('clients-view');
  });
  await page.waitForTimeout(1400);
  const clientsState = await page.evaluate(async () => {
    const response = await fetch('/api/apps-script/getClientsPortalData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [] })
    });
    const payload = await response.json();
    return {
      payload,
      hidden: document.querySelector('#clients-view')?.classList.contains('hidden'),
      viewExists: !!document.querySelector('#clients-view'),
      navVisible: !!document.querySelector('.nav-link[data-view="clients-view"]:not(.hidden)'),
      invalid: /Invalid Date|NaN/.test(document.body.innerText)
    };
  });
  assert(clientsState.payload.success && clientsState.payload.data.length >= 4, `Clients Portal API expected Mongo rows, found ${clientsState.payload.data?.length}.`);
  assert(clientsState.payload.data[0].Client_Id && clientsState.payload.data[0]['Mobile Number'] && clientsState.payload.data[0]['Client Email ID'], 'Clients Portal rows missing Client_Id/Mobile/Email fields.');
  assert(clientsState.viewExists, 'Clients Portal DOM view missing from original Apps Script page.');
  assert(clientsState.hidden, 'Clients Portal should remain hidden for the reference VK user.');
  assert(!clientsState.navVisible, 'Clients Portal nav should not be visible for the reference VK user.');
  assert(!clientsState.invalid, 'Clients Portal table contains Invalid Date or NaN.');

  const todoNav = await page.evaluate(() => ({
    exists: !!document.querySelector('#nav-todo-link'),
    hidden: document.querySelector('#nav-todo-link')?.classList.contains('hidden'),
    sidebarText: document.querySelector('#sidebar')?.innerText || ''
  }));
  assert(todoNav.exists, 'To-Do nav node missing from original Apps Script DOM.');
  assert(todoNav.hidden, 'To-Do nav should remain hidden for the reference VK user.');
  assert(!todoNav.sidebarText.includes('My To-Do'), 'Hidden To-Do nav leaked into the reference sidebar.');

  await page.evaluate(() => document.querySelector('.nav-link[data-view="expense-view"]')?.click());
  await page.waitForSelector('#expense-view:not(.hidden)', { timeout: 10000 });
  await page.evaluate(() => document.querySelector('#show-expense-form-btn')?.click());
  await page.waitForSelector('#expense-form-container:not(.hidden)', { timeout: 10000 });
  const expenseForm = await page.evaluate(() => ({
    title: document.querySelector('#expense-form-container h3')?.innerText || '',
    hasDate: !!document.querySelector('#expense-date'),
    typeOptions: [...document.querySelectorAll('#expense-type option')].map((option) => option.textContent?.trim()),
    hasAmount: !!document.querySelector('#expense-amount'),
    hasReceipt: !!document.querySelector('#expense-receipt'),
    submit: document.querySelector('#submit-expense-btn')?.innerText || ''
  }));
  assert(expenseForm.title === 'Record an Expense', `Expense form title mismatch: ${expenseForm.title}`);
  assert(expenseForm.hasDate && expenseForm.hasAmount && expenseForm.hasReceipt, 'Expense form fields are missing.');
  assert(expenseForm.typeOptions.includes('Travel') && expenseForm.typeOptions.includes('Miscellaneous'), 'Expense type dropdown did not preserve Apps Script options.');
  assert(expenseForm.submit.includes('Submit Expense'), 'Expense submit button text missing.');
  await page.screenshot({ path: 'tmp-workflow-expense-form.png', fullPage: false });

  const fmsApi = await page.evaluate(async (employeeId) => {
    const response = await fetch('/api/apps-script/getFmsTasksForApp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [employeeId] })
    });
    return response.json();
  }, fmsEmployeeId);
  assert(fmsApi.success && Array.isArray(fmsApi.data), 'FMS API did not return Apps Script-compatible data array.');
  assert(fmsApi.data.length >= 1, `FMS API expected Mongo rows for ${fmsEmployeeId}, found ${fmsApi.data?.length}.`);

  collectFailures();
  await page.close();
}

async function verifyClientPortal(browser) {
  const page = await createParityPage(browser);
  const collectFailures = watchPage(page, 'Client Portal');

  await page.goto(`${baseUrl}/client`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => sessionStorage.setItem('currentClient', JSON.stringify({ name: 'Acme Retail', chat: true })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert(await page.locator('#login-client-id').count(), 'Invalid stale currentClient did not return to client login.');
  const staleClientCleared = await page.evaluate(() => sessionStorage.getItem('currentClient') === null);
  assert(staleClientCleared, 'Invalid stale currentClient was not cleared.');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  assert(await page.locator('#login-client-id').count(), 'Client login field not found on /client.');
  await ensureClientLoggedIn(page);
  await page.waitForTimeout(4000);

  const client = await page.evaluate(() => ({
    title: document.title,
    hasRoot: !!document.querySelector('#root'),
    hasGeneratedRail: !!document.querySelector('.portal-rail'),
    hasGeneratedChat: /Discussion Center|Track tickets|Client Portal\s+Acme Retail/.test(document.body.innerText),
    sidebar: document.querySelector('#sidebar')?.innerText || '',
    header: document.querySelector('#header-title')?.innerText || '',
    body: document.body.innerText,
    dashboard: document.querySelector('#dashboard-view')?.innerText || '',
    invalid: /Invalid Date|NaN/.test(document.body.innerText)
  }));

  assert(client.title === 'Client Portal', `Unexpected client portal title: ${client.title}`);
  assert(!client.hasRoot, 'React #root exists in rendered client portal.');
  assert(!client.hasGeneratedRail, 'Generated portal rail exists in rendered client portal.');
  assert(!client.hasGeneratedChat, 'Generated Client Portal/Chat text exists in rendered client portal.');
  assert(client.sidebar.includes('Dashboard') && client.sidebar.includes('My Tickets'), 'Original client sidebar nav missing.');
  assert(client.sidebar.includes('Social Tasks') && client.sidebar.includes('Invoices'), 'Original client portal modules missing.');
  assert(client.header === 'Dashboard', `Client dashboard header mismatch: ${client.header}`);
  assert(/Kriscel Tech Private Limited/.test(client.body), 'Client dashboard client name missing.');
  assert(!client.invalid, 'Client portal contains Invalid Date or NaN.');

  await page.evaluate(() => document.querySelector('.nav-link[data-view="social-view"]')?.click());
  await page.waitForTimeout(2500);
  const clientSocial = await page.evaluate(async (clientId) => {
    const response = await fetch('/api/apps-script/getClientSocialTasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [clientId, null, null] })
    });
    const payload = await response.json();
    return {
      payload,
      header: document.querySelector('#header-title')?.innerText || '',
      visible: !document.querySelector('#social-view')?.classList.contains('hidden'),
      rows: document.querySelectorAll('#client-social-table tbody tr').length,
      text: document.querySelector('#social-view')?.innerText || '',
      invalid: /Invalid Date|NaN/.test(document.body.innerText)
    };
  }, clientId);
  assert(clientSocial.visible, 'Client social view did not open.');
  assert(clientSocial.header === 'Social Tasks', `Client social header mismatch: ${clientSocial.header}`);
  assert(clientSocial.payload.success && Array.isArray(clientSocial.payload.data), 'Client social API did not return data array.');
  assert(clientSocial.payload.data.length >= 1, `Client social API expected Mongo rows, found ${clientSocial.payload.data?.length}.`);
  assert(clientSocial.payload.data[0].ID && clientSocial.payload.data[0].Date && clientSocial.payload.data[0].Description, 'Client social rows missing ID/Date/Description aliases.');
  assert(clientSocial.rows >= 1, `Client social table expected rows, found ${clientSocial.rows}.`);
  assert(clientSocial.text.includes('My Social Media Tasks') && clientSocial.text.includes('LinkedIn'), 'Client social screen missing original table content.');
  assert(!clientSocial.invalid, 'Client social view contains Invalid Date or NaN.');

  await page.evaluate(() => document.querySelector('.nav-link[data-view="invoices-view"]')?.click());
  await page.waitForTimeout(2200);
  const clientInvoices = await page.evaluate(async (clientId) => {
    const response = await fetch('/api/apps-script/getClientInvoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [clientId] })
    });
    const payload = await response.json();
    return {
      payload,
      header: document.querySelector('#header-title')?.innerText || '',
      visible: !document.querySelector('#invoices-view')?.classList.contains('hidden'),
      rows: document.querySelectorAll('#client-invoices-table tbody tr').length,
      text: document.querySelector('#invoices-view')?.innerText || '',
      invalid: /Invalid Date|NaN/.test(document.body.innerText)
    };
  }, clientId);
  assert(clientInvoices.visible, 'Client invoices view did not open.');
  assert(clientInvoices.header === 'Invoices', `Client invoices header mismatch: ${clientInvoices.header}`);
  assert(clientInvoices.payload.success && Array.isArray(clientInvoices.payload.data), 'Client invoices API did not return data array.');
  assert(clientInvoices.payload.data.length >= 1, `Client invoices API expected Mongo rows, found ${clientInvoices.payload.data?.length}.`);
  assert(clientInvoices.payload.data[0].InvoiceID && clientInvoices.payload.data[0].Outstanding !== undefined, 'Client invoice rows missing InvoiceID/Outstanding fields.');
  assert(clientInvoices.rows >= 1, `Client invoices table expected rows, found ${clientInvoices.rows}.`);
  assert(clientInvoices.text.includes('My Invoices') && clientInvoices.text.includes('INV_KRIS_001'), 'Client invoices screen missing Mongo invoice content.');
  assert(!clientInvoices.invalid, 'Client invoices view contains Invalid Date or NaN.');

  await page.evaluate(() => document.querySelector('.nav-link[data-view="reports-view"]')?.click());
  await page.waitForTimeout(2500);
  const clientReports = await page.evaluate(async (clientId) => {
    const response = await fetch('/api/apps-script/getClientReportData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [clientId, null, null] })
    });
    const payload = await response.json();
    return {
      payload,
      header: document.querySelector('#header-title')?.innerText || '',
      visible: !document.querySelector('#reports-view')?.classList.contains('hidden'),
      text: document.querySelector('#reports-view')?.innerText || '',
      invalid: /Invalid Date|NaN/.test(document.body.innerText)
    };
  }, clientId);
  assert(clientReports.visible, 'Client reports view did not open.');
  assert(clientReports.header === 'Reports', `Client reports header mismatch: ${clientReports.header}`);
  assert(clientReports.payload.success, 'Client report API did not return success.');
  assert(clientReports.payload.data?.summary, 'Client report API missing data.summary shape.');
  assert(Array.isArray(clientReports.payload.data?.details), 'Client report API missing data.details array.');
  assert(clientReports.payload.data.summary.tickets >= 1, 'Client report summary missing ticket count.');
  assert(clientReports.payload.data.details.some((item) => item.TaskType === 'Ticket'), 'Client report details missing Ticket rows.');
  assert(clientReports.text.includes('Performance Reports') && clientReports.text.includes('Detailed Task Log'), 'Client report screen missing original report sections.');
  assert(clientReports.text.includes('Total Activities') && clientReports.text.includes('Open Tickets') && clientReports.text.includes('Social Posts'), 'Client report KPI cards did not render.');
  assert(!clientReports.invalid, 'Client reports view contains Invalid Date or NaN.');

  await page.screenshot({ path: 'tmp-browser-parity-client.png', fullPage: false });
  collectFailures();
  await page.close();
}

async function verifyMasterDashboard(browser) {
  const page = await createParityPage(browser);
  const collectFailures = watchPage(page, 'Master Dashboard');

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(6500);
  const dashboard = await page.evaluate(() => ({
    title: document.title,
    hasRoot: !!document.querySelector('#root'),
    hasGeneratedRail: !!document.querySelector('.portal-rail'),
    text: document.body.innerText,
    overviewVisible: !!document.querySelector('#tab-overview') && getComputedStyle(document.querySelector('#tab-overview')).display !== 'none',
    batchUsers: document.querySelectorAll('#batch-user option').length,
    invalid: /Invalid Date|NaN/.test(document.body.innerText)
  }));

  assert(dashboard.title === 'Master Analytics Workspace', `Unexpected dashboard title: ${dashboard.title}`);
  assert(!dashboard.hasRoot, 'React #root exists in rendered master dashboard.');
  assert(!dashboard.hasGeneratedRail, 'Generated portal rail exists in rendered master dashboard.');
  assert(dashboard.text.includes('Workspace Master'), 'Workspace Master label missing.');
  assert(dashboard.text.includes('Overview Dashboard'), 'Overview Dashboard tab missing.');
  assert(dashboard.text.includes('User Explorer') && dashboard.text.includes('Client Explorer'), 'Dashboard explorer tabs missing.');
  assert(dashboard.overviewVisible, 'Dashboard overview tab is not visible.');
  assert(dashboard.batchUsers > 1, 'Dashboard batch user dropdown did not populate.');
  assert(!dashboard.invalid, 'Master dashboard contains Invalid Date or NaN.');

  await page.screenshot({ path: 'tmp-browser-parity-dashboard.png', fullPage: false });
  collectFailures();
  await page.close();
}

async function verifyAppsScriptApiWorkflows(browser) {
  const page = await createParityPage(browser);
  const collectFailures = watchPage(page, 'Apps Script API workflows');
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const activeUserSetup = await page.evaluate(async () => {
    const liveDate = new Date().toISOString().slice(0, 10);
    const response = await fetch('/api/apps-script/recordAttendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [{
          AttendanceID: `ATTENDANCE_GATE_ACTIVE_VK_${Date.now()}`,
          'Employee ID': 'VK',
          'Employee Name': 'Vikas Kushwah',
          Action: 'Punch In',
          Time: '23:59',
          'Punch In': '23:59',
          Status: 'Present',
          Remarks: 'Attendance gate smoke active setup'
        }]
      })
    });
    return response.json();
  });
  assert(activeUserSetup.success, 'Active user punch-in setup failed for API workflow verification.');

  const ticketResult = await page.evaluate(async () => {
    const liveDate = new Date().toISOString().slice(0, 10);
    const response = await fetch('/api/apps-script/createBulkTicketsInSheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [[{
          Client_Id: 'CL000',
          'Task Category': 'Documentation',
          Priority: 'Normal',
          Description: 'Attachment parity smoke test',
          'Plan Date': liveDate,
          'Employee ID': 'VK',
          'Creator ID': 'VK',
          'Creator Name': 'Vikas Kushwah',
          Source: 'App',
          TAT: 15,
          Attachment: [{
            base64: 'dGlja2V0IGF0dGFjaG1lbnQgc21va2U=',
            mimeType: 'text/plain',
            fileName: 'ticket-smoke.txt'
          }]
        }]]
      })
    });
    const payload = await response.json();
    const attachment = payload.data?.[0]?.Attachment || '';
    const fileText = attachment ? await (await fetch(attachment)).text() : '';
    return { payload, attachment, fileText };
  });

  assert(ticketResult.payload.success, 'Ticket bulk create API did not return success.');
  assert(typeof ticketResult.attachment === 'string', 'Ticket attachment was not normalized to a string URL.');
  assert(ticketResult.attachment.startsWith('/uploads/tickets/'), `Ticket attachment URL mismatch: ${ticketResult.attachment}`);
  assert(ticketResult.fileText === 'ticket attachment smoke', 'Ticket attachment file was not served correctly.');

  const ticketLifecycleResult = await page.evaluate(async () => {
    const liveDate = new Date().toISOString().slice(0, 10);
    const post = async (fn, args) => {
      const response = await fetch(`/api/apps-script/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });
      return response.json();
    };
    const firstId = `TICKET_LIFECYCLE_A_${Date.now()}`;
    const secondId = `TICKET_LIFECYCLE_B_${Date.now()}`;
    await post('recordAttendance', [{
      'Employee ID': 'EMP141',
      'Employee Name': 'Aman Verma',
      Action: 'Punch In',
      Time: '23:59',
      'Punch In': '23:59',
      Status: 'Present'
    }]);
    const baseTicket = {
      Client_Id: 'CL000',
      'Client Name': 'Kriscel Tech Private Limited',
      'Employee ID': 'EMP141',
      'Employee Name': 'Aman Verma',
      'Task Category': 'Documentation',
      Priority: 'Normal',
      Status: 'Open',
      'Plan Date': liveDate,
      TAT: 30
    };
    const firstCreated = await post('createTicketInSheet', [{ ...baseTicket, 'Ticket ID': firstId, 'Task Description': 'Lifecycle first ticket' }]);
    const secondCreated = await post('createTicketInSheet', [{ ...baseTicket, 'Ticket ID': secondId, 'Task Description': 'Lifecycle second ticket' }]);
    const firstStarted = await post('updateTicketInSheet', [firstId, { newStatus: 'In Progress', updatedBy: 'EMP141' }]);
    const secondStartBlocked = await post('updateTicketInSheet', [secondId, { newStatus: 'In Progress', updatedBy: 'EMP141' }]);
    const firstPaused = await post('updateTicketInSheet', [firstId, { newStatus: 'Paused', updatedBy: 'EMP141', newRemarks: 'Pause smoke' }]);
    const secondStarted = await post('updateTicketInSheet', [secondId, { newStatus: 'In Progress', updatedBy: 'EMP141' }]);
    const secondCompleted = await post('updateTicketInSheet', [secondId, { newStatus: 'Completed', updatedBy: 'EMP141', newRemarks: 'Complete smoke' }]);
    return { firstCreated, secondCreated, firstStarted, secondStartBlocked, firstPaused, secondStarted, secondCompleted };
  });

  assert(ticketLifecycleResult.firstCreated.success && ticketLifecycleResult.secondCreated.success, 'Ticket lifecycle smoke ticket creation failed.');
  assert(ticketLifecycleResult.firstStarted.success && ticketLifecycleResult.firstStarted.finalStatus === 'In Progress', `Ticket lifecycle start mismatch: ${ticketLifecycleResult.firstStarted.finalStatus}`);
  assert(ticketLifecycleResult.secondStartBlocked.success === false && /already chal raha hai|already/i.test(ticketLifecycleResult.secondStartBlocked.message || ''), 'Ticket lifecycle did not block a second running ticket.');
  assert(ticketLifecycleResult.firstPaused.success && ticketLifecycleResult.firstPaused.finalStatus === 'Paused', `Ticket lifecycle pause mismatch: ${ticketLifecycleResult.firstPaused.finalStatus}`);
  assert(/\d+h \d+m/.test(ticketLifecycleResult.firstPaused.item?.['Total Duration'] || ''), 'Ticket lifecycle pause did not calculate Total Duration.');
  assert(ticketLifecycleResult.secondStarted.success && ticketLifecycleResult.secondStarted.finalStatus === 'In Progress', 'Ticket lifecycle did not allow start after pause.');
  assert(ticketLifecycleResult.secondCompleted.success && ticketLifecycleResult.secondCompleted.finalStatus === 'Pending Approval', `Ticket lifecycle completion approval mismatch: ${ticketLifecycleResult.secondCompleted.finalStatus}`);

  const expenseResult = await page.evaluate(async () => {
    const liveDate = new Date().toISOString().slice(0, 10);
    const response = await fetch('/api/apps-script/recordExpense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [{
          'Employee ID': 'VK',
          'Employee Name': 'Vikas Kushwah',
          Date: liveDate,
          Type: 'Travel',
          Amount: '123.45',
          Description: 'Expense receipt parity smoke test',
          Receipt: {
            base64: 'ZXhwZW5zZSByZWNlaXB0IHNtb2tl',
            mimeType: 'text/plain',
            fileName: 'expense-smoke.txt'
          }
        }]
      })
    });
    const payload = await response.json();
    const receiptUrl = payload.item?.['Receipt URL'] || '';
    const fileText = receiptUrl ? await (await fetch(receiptUrl)).text() : '';
    return { payload, receiptUrl, fileText };
  });

  assert(expenseResult.payload.success, 'Expense record API did not return success.');
  assert(expenseResult.receiptUrl.startsWith('/uploads/expenses/'), `Expense receipt URL mismatch: ${expenseResult.receiptUrl}`);
  assert(expenseResult.fileText === 'expense receipt smoke', 'Expense receipt file was not served correctly.');

  const attendanceGateResult = await page.evaluate(async () => {
    const liveDate = new Date().toISOString().slice(0, 10);
    const post = async (fn, args) => {
      const response = await fetch(`/api/apps-script/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });
      return response.json();
    };
    const inactiveId = `NOATT_${Date.now()}`;
    const savedUser = await post('saveOrUpdateUser', [{
      'Employee ID': inactiveId,
      'Employee Name': 'No Attendance Smoke',
      Password: '',
      Role: 'User',
      Status: 'Active'
    }]);
    const punchOut = await post('recordAttendance', [{
      AttendanceID: `ATT_${inactiveId}`,
      'Employee ID': inactiveId,
      'Employee Name': 'No Attendance Smoke',
      Date: liveDate,
      Action: 'Punch Out',
      Time: '18:00',
      Status: 'Present'
    }]);
    const active = await post('checkUserAttendanceActive', [inactiveId]);
    const blockedTodo = await post('addTodo', [inactiveId, 'Should be blocked', 'Low', liveDate, '15']);
    const activeTodo = await post('addTodo', ['VK', 'Attendance gate active user smoke', 'Low', liveDate, '15']);
    return { savedUser, punchOut, active, blockedTodo, activeTodo };
  });

  assert(attendanceGateResult.savedUser.success, 'Attendance gate smoke user was not saved.');
  assert(attendanceGateResult.punchOut.success, 'Attendance gate smoke punch out was not recorded.');
  assert(attendanceGateResult.active.success && attendanceGateResult.active.active === false, 'Attendance gate active check did not detect punched-out user.');
  assert(attendanceGateResult.blockedTodo.success === false && /Attendance Required/i.test(attendanceGateResult.blockedTodo.message || ''), 'Attendance gate did not block To-Do action for punched-out user.');
  assert(attendanceGateResult.activeTodo.success, 'Attendance gate blocked an active Mongo user unexpectedly.');

  const todoResult = await page.evaluate(async () => {
    const liveDate = new Date().toISOString().slice(0, 10);
    const post = async (fn, args) => {
      const response = await fetch(`/api/apps-script/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });
      return response.json();
    };
    const created = await post('addBulkTodos', ['VK', [{
      task: 'To-Do parity smoke task',
      priority: 'High',
      dueDate: liveDate,
      tat: '45'
    }]]);
    const id = created.data?.[0]?.['Task ID'];
    const toggled = id ? await post('toggleTodoStatus', [id, 'Pending']) : null;
    const edited = id ? await post('editTodoItem', [id, 'To-Do parity smoke task edited', 'Low', liveDate, '60']) : null;
    const deleted = id ? await post('deleteTodoItem', [id]) : null;
    return { created, id, toggled, edited, deleted };
  });

  assert(todoResult.created.success, 'To-Do bulk add API did not return success.');
  assert(todoResult.id, 'To-Do bulk add did not return a Task ID.');
  assert(todoResult.created.data?.[0]?.TAT === '45', `To-Do bulk add did not preserve TAT: ${todoResult.created.data?.[0]?.TAT}`);
  assert(todoResult.created.data?.[0]?.Description === 'To-Do parity smoke task', 'To-Do bulk add did not preserve Description alias.');
  assert(todoResult.toggled?.item?.Status === 'Completed', `To-Do toggle status mismatch: ${todoResult.toggled?.item?.Status}`);
  assert(todoResult.edited?.item?.Task === 'To-Do parity smoke task edited', 'To-Do edit did not update task text.');
  assert(todoResult.edited?.item?.Priority === 'Low' && todoResult.edited?.item?.TAT === '60', 'To-Do edit did not update priority/TAT.');
  assert(todoResult.deleted?.item?.Status === 'Deleted', `To-Do delete status mismatch: ${todoResult.deleted?.item?.Status}`);

  const approvalResult = await page.evaluate(async () => {
    const liveDate = new Date().toISOString().slice(0, 10);
    const post = async (fn, args) => {
      const response = await fetch(`/api/apps-script/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });
      return response.json();
    };
    const managerPunchIn = await post('recordAttendance', [{
      AttendanceID: `ATT_KR203_${Date.now()}`,
      'Employee ID': 'KR203',
      'Employee Name': 'Kriscel Rao',
      Action: 'Punch In',
      Time: '23:59',
      'Punch In': '23:59',
      Status: 'Present'
    }]);
    const pending = await post('getPendingApprovals', ['KR203']);
    const createdForApprove = await post('createTicketInSheet', [{
      'Ticket ID': 'TICKET_APPROVAL_SMOKE_APPROVE',
      Client_Id: 'CL000',
      'Client Name': 'Kriscel Tech Private Limited',
      'Employee ID': 'VK',
      'Employee Name': 'Vikas Kushwah',
      'Task Category': 'Documentation',
      Priority: 'Normal',
      'Task Description': 'Approval parity approve smoke',
      Status: 'Pending Approval',
      'Plan Date': liveDate,
      TAT: 30
    }]);
    const approved = await post('adminTicketAction', ['TICKET_APPROVAL_SMOKE_APPROVE', 'KR203', 'Approve', 'Approval parity smoke approved']);
    const createdForRework = await post('createTicketInSheet', [{
      'Ticket ID': 'TICKET_APPROVAL_SMOKE_REWORK',
      Client_Id: 'CL000',
      'Client Name': 'Kriscel Tech Private Limited',
      'Employee ID': 'VK',
      'Employee Name': 'Vikas Kushwah',
      'Task Category': 'Documentation',
      Priority: 'Normal',
      'Task Description': 'Approval parity rework smoke',
      Status: 'Pending Approval',
      'Plan Date': liveDate,
      TAT: 30
    }]);
    const reworked = await post('adminTicketAction', ['TICKET_APPROVAL_SMOKE_REWORK', 'KR203', 'Rework', 'Approval parity smoke rework']);
    const leave = await post('submitLeaveRequest', [{
      LeaveID: 'LEAVE_APPROVAL_SMOKE',
      'Employee ID': 'VK',
      'Employee Name': 'Vikas Kushwah',
      'Start Date': liveDate,
      'End Date': liveDate,
      Reason: 'Approval parity leave smoke'
    }]);
    const leaveAction = await post('processAdminAction', [{ adminId: 'KR203', type: 'Leave', id: 'LEAVE_APPROVAL_SMOKE', status: 'Approved', remarks: 'Approved smoke' }]);
    const blockedAdminId = `ADMIN_NOATT_${Date.now()}`;
    const blockedAdmin = await post('saveOrUpdateUser', [{
      'Employee ID': blockedAdminId,
      'Employee Name': 'Blocked Admin Smoke',
      Password: '',
      Role: 'Manager',
      Status: 'Active'
    }]);
    const blockedPunchOut = await post('recordAttendance', [{
      AttendanceID: `ATT_${blockedAdminId}`,
      'Employee ID': blockedAdminId,
      'Employee Name': 'Blocked Admin Smoke',
      Date: liveDate,
      Action: 'Punch Out',
      Time: '18:30',
      Status: 'Present'
    }]);
    const blockedApproval = await post('adminTicketAction', ['TICKET_APPROVAL_SMOKE_REWORK', blockedAdminId, 'Approve', 'Should be blocked']);
    return { managerPunchIn, pending, createdForApprove, approved, createdForRework, reworked, leave, leaveAction, blockedAdmin, blockedPunchOut, blockedApproval };
  });

  assert(approvalResult.managerPunchIn.success, 'Manager punch-in for approval smoke failed.');
  assert(approvalResult.pending.success, 'Pending approvals API did not return success.');
  assert(Array.isArray(approvalResult.pending.tickets), 'Pending approvals tickets array missing.');
  assert(approvalResult.pending.tickets.some((ticket) => ticket.Status === 'Pending Approval'), 'Pending approvals missing Mongo pending tickets.');
  assert(approvalResult.createdForApprove.success, 'Approval smoke ticket creation failed.');
  assert(approvalResult.approved.success && approvalResult.approved.item?.Status === 'Closed', `Admin Approve did not close ticket: ${approvalResult.approved.item?.Status}`);
  assert(/Approval parity smoke approved/.test(approvalResult.approved.item?.Remarks || ''), 'Admin Approve remarks were not preserved.');
  assert(approvalResult.createdForRework.success, 'Rework smoke ticket creation failed.');
  assert(approvalResult.reworked.success && approvalResult.reworked.item?.Status === 'Rework', `Admin Rework did not set Rework status: ${approvalResult.reworked.item?.Status}`);
  assert(approvalResult.leave.success, 'Leave approval smoke creation failed.');
  assert(approvalResult.leaveAction.success && approvalResult.leaveAction.item?.Status === 'Approved', `processAdminAction did not approve leave: ${approvalResult.leaveAction.item?.Status}`);
  assert(approvalResult.blockedAdmin.success && approvalResult.blockedPunchOut.success, 'Blocked admin setup failed.');
  assert(approvalResult.blockedApproval.success === false && /Attendance Required/i.test(approvalResult.blockedApproval.message || ''), 'Admin ticket action did not enforce attendance gate.');

  const notificationResult = await page.evaluate(async () => {
    const post = async (fn, args) => {
      const response = await fetch(`/api/apps-script/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });
      return response.json();
    };
    const employee = await post('checkForNewNotifications', ['VK', 0]);
    const client = await post('checkForNewUpdates', ['CL000', new Date(0).toISOString()]);
    const firstClientUpdate = client.updates?.[0];
    const marked = firstClientUpdate ? await post('markAsNotified', [firstClientUpdate.type === 'Social Media' ? 'SocialMedia' : 'Tickets', firstClientUpdate.type === 'Social Media' ? 'Post ID' : 'Ticket ID', firstClientUpdate.id, { IsNotified: true }]) : null;
    return { employee, client, firstClientUpdate, marked };
  });

  assert(notificationResult.employee.success, 'Employee notifications API did not return success.');
  assert(Array.isArray(notificationResult.employee.notifications), 'Employee notifications missing notifications array.');
  assert(notificationResult.employee.notifications.some((item) => item['Ticket ID']), 'Employee notifications missing Ticket ID rows.');
  assert(notificationResult.employee.serverTime, 'Employee notifications missing serverTime.');
  assert(notificationResult.client.success, 'Client updates API did not return success.');
  assert(Array.isArray(notificationResult.client.updates), 'Client updates missing updates array.');
  assert(notificationResult.client.updates.some((item) => item.id && item.type && item.message), 'Client updates missing id/type/message payload.');
  assert(!notificationResult.marked || notificationResult.marked.success, 'markAsNotified did not return success.');

  const chatResult = await page.evaluate(async () => {
    const liveDate = new Date().toISOString().slice(0, 10);
    const post = async (fn, args) => {
      const response = await fetch(`/api/apps-script/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });
      return response.json();
    };
    const ticketId = `TICKET_CHAT_SMOKE_${Date.now()}`;
    const created = await post('createTicketInSheet', [{
      'Ticket ID': ticketId,
      Client_Id: 'CL000',
      'Client Name': 'Kriscel Tech Private Limited',
      'Employee ID': 'VK',
      'Employee Name': 'Vikas Kushwah',
      'Task Category': 'Documentation',
      Priority: 'Normal',
      'Task Description': 'Chat unread flag parity smoke',
      Status: 'In Progress',
      'Plan Date': liveDate,
      TAT: 30
    }]);
    const employeeMessage = await post('postTaskMessage', [ticketId, 'Employee chat smoke', 'VK']);
    const afterEmployee = await post('getTicketDetails', [ticketId]);
    const clientMessage = await post('postMessage', [ticketId, 'Client chat smoke', { 'Client Name': 'Kriscel Tech Private Limited', Client_Id: 'CL000' }]);
    const afterClient = await post('getTicketDetails', [ticketId]);
    const messages = await post('getMessagesForTask', [ticketId]);
    const clientRead = await post('markTicketMessagesAsRead', [ticketId, 'CL000']);
    const employeeRead = await post('markTicketMessagesAsRead', [ticketId]);
    return { created, employeeMessage, afterEmployee, clientMessage, afterClient, messages, clientRead, employeeRead };
  });

  assert(chatResult.created.success, 'Chat smoke ticket creation failed.');
  assert(chatResult.employeeMessage.success, 'Employee chat post did not return success.');
  assert(chatResult.afterEmployee.data?.HasUnreadMessages === true, 'Employee chat post did not set HasUnreadMessages.');
  assert(chatResult.clientMessage.success, 'Client chat post did not return success.');
  assert(chatResult.afterClient.data?.HasUnreadAdminMessages === true, 'Client chat post did not set HasUnreadAdminMessages.');
  assert(Array.isArray(chatResult.messages.messages) && chatResult.messages.messages.length >= 2, 'Chat messages were not returned in Apps Script shape.');
  assert(chatResult.clientRead.success && chatResult.clientRead.item?.HasUnreadMessages === false, 'Client markTicketMessagesAsRead did not clear HasUnreadMessages.');
  assert(chatResult.employeeRead.success && chatResult.employeeRead.item?.HasUnreadAdminMessages === false, 'Employee markTicketMessagesAsRead did not clear HasUnreadAdminMessages.');

  const exportResult = await page.evaluate(async () => {
    const post = async (fn, args) => {
      const response = await fetch(`/api/apps-script/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });
      return response.json();
    };
    const excel = await post('exportReportForWeb', ['xlsx', 'Tickets']);
    const pdf = await post('exportReportForWeb', ['pdf', 'Tickets']);
    const csv = await post('exportReportForWeb', ['csv', 'Tickets']);
    const decodePrefix = (base64Data, length = 8) => {
      const binary = atob(base64Data || '');
      return Array.from(binary.slice(0, length)).map((char) => char.charCodeAt(0));
    };
    return {
      excel,
      pdf,
      csv,
      excelPrefix: decodePrefix(excel.base64Data, 4),
      pdfText: atob(pdf.base64Data || '').slice(0, 8),
      csvText: atob(csv.base64Data || '').slice(0, 2000)
    };
  });

  assert(exportResult.excel.success, 'Excel export did not return success.');
  assert(exportResult.excel.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `Excel export MIME mismatch: ${exportResult.excel.mimeType}`);
  assert(/\.xlsx$/i.test(exportResult.excel.fileName), `Excel export filename mismatch: ${exportResult.excel.fileName}`);
  assert(exportResult.excelPrefix[0] === 80 && exportResult.excelPrefix[1] === 75, 'Excel export is not an XLSX/ZIP payload.');
  assert(exportResult.pdf.success, 'PDF export did not return success.');
  assert(exportResult.pdf.mimeType === 'application/pdf', `PDF export MIME mismatch: ${exportResult.pdf.mimeType}`);
  assert(/\.pdf$/i.test(exportResult.pdf.fileName), `PDF export filename mismatch: ${exportResult.pdf.fileName}`);
  assert(exportResult.pdfText === '%PDF-1.4', 'PDF export is not a PDF payload.');
  assert(exportResult.csv.success, 'CSV export did not return success.');
  assert(exportResult.csv.mimeType === 'text/csv', `CSV export MIME mismatch: ${exportResult.csv.mimeType}`);
  assert(/Ticket ID|Task Description/i.test(exportResult.csvText), 'CSV export did not include ticket headers.');
  collectFailures();
  await page.close();
}

async function verifyStaleLinkFallbacks(browser) {
  const cases = [
    { path: '/chat', title: 'Work_Track_System', login: '#login-employee-id' },
    { path: '/worktrack/chat', title: 'Work_Track_System', login: '#login-employee-id' },
    { path: '/client/chat', title: 'Client Portal', login: '#login-client-id' },
    { path: '/dashboard/reports', title: 'Master Analytics Workspace', login: null }
  ];

  for (const fallback of cases) {
    const page = await createParityPage(browser);
    const collectFailures = watchPage(page, `Stale link ${fallback.path}`);
    await page.goto(`${baseUrl}${fallback.path}`, { waitUntil: 'commit', timeout: 20000 });
    await page.waitForTimeout(700);
    const shell = await page.evaluate(() => ({
      title: document.title,
      hasRoot: !!document.querySelector('#root'),
      hasGeneratedRail: !!document.querySelector('.portal-rail'),
      hasShim: !!document.querySelector('script[src="/googleScriptRunShim.js"]'),
      hasCacheCleanup: !!document.querySelector('#mern-cache-cleanup'),
      hasGeneratedChat: /Discussion Center|Track tickets|Client Portal\s+Acme Retail/.test(document.body?.innerText || '')
    }));

    assert(shell.title === fallback.title, `${fallback.path} fallback title mismatch: ${shell.title}`);
    assert(shell.hasShim, `${fallback.path} fallback did not include google.script.run shim.`);
    assert(shell.hasCacheCleanup, `${fallback.path} fallback did not include cache cleanup script.`);
    assert(!shell.hasRoot, `${fallback.path} fallback rendered React #root.`);
    assert(!shell.hasGeneratedRail, `${fallback.path} fallback rendered generated portal rail.`);
    assert(!shell.hasGeneratedChat, `${fallback.path} fallback rendered generated Client Portal/Chat text.`);
    if (fallback.login) {
      assert(await page.locator(fallback.login).count(), `${fallback.path} fallback login field missing.`);
    }

    collectFailures();
    await page.close();
  }
}

async function verifyPrototypeCacheCannotRevive(browser) {
  const page = await createParityPage(browser);
  const collectFailures = watchPage(page, 'Prototype cache cleanup');

  const swResponse = await page.goto(`${baseUrl}/service-worker.js`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const swText = await page.textContent('body');
  assert(swResponse?.status() === 200, `service-worker.js returned ${swResponse?.status()}`);
  assert(/registration\.unregister/.test(swText || ''), 'service-worker.js does not unregister itself.');

  await page.goto(`${baseUrl}/chat`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(700);
  const chatFallback = await page.evaluate(() => ({
    title: document.title,
    hasLogin: !!document.querySelector('#login-employee-id'),
    hasCacheCleanup: !!document.querySelector('#mern-cache-cleanup'),
    generated: /Discussion Center|Track tickets|Client Portal\s+Acme Retail/.test(document.body.innerText)
  }));
  assert(chatFallback.title === 'Work_Track_System', `/chat did not render WorkTrack exact page: ${chatFallback.title}`);
  assert(chatFallback.hasLogin, '/chat fallback is missing the employee login field.');
  assert(chatFallback.hasCacheCleanup, '/chat fallback is missing cache cleanup.');
  assert(!chatFallback.generated, '/chat still renders generated prototype text.');

  collectFailures();
  await page.close();
}

fs.mkdirSync(profileDir, { recursive: true });
const browser = await chromium.launchPersistentContext(profileDir, { channel: 'chrome', headless: true, viewport });
await browser.addCookies([
  { name: 'worktrack_exact_cache_cleared', value: '1', domain: 'localhost', path: '/' }
]);
try {
  await verifyStaleLinkFallbacks(browser);
  await verifyPrototypeCacheCannotRevive(browser);
  await verifyWorkTrack(browser);
  await verifyAdditionalEmployeeModules(browser);
  await verifyClientPortal(browser);
  await verifyMasterDashboard(browser);
  await verifyAppsScriptApiWorkflows(browser);
} finally {
  await browser.close();
  try {
    await connectDatabase();
    const removed = await purgeTestArtifacts();
    const totalRemoved = Object.values(removed).reduce((sum, count) => sum + count, 0);
    if (totalRemoved) {
      console.log(`Purged ${totalRemoved} browser parity test artifact(s).`);
    }
  } catch (error) {
    failures.push(`Browser parity cleanup failed: ${error.message}`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}

console.log('Browser parity verification passed.');
process.exit(0);

