import { chromium } from 'playwright-core';

const baseUrl = process.env.PARITY_URL || 'http://localhost:5173/';
const password = process.env.PARITY_PASSWORD || '123456';
const users = (process.env.USER_PANEL_VERIFY_USERS || 'VK,KR203,NL106,AS101')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const skipMutatingOrExternal = /delete|edit|submit|approve|reject|rework|done|start|stop|pause|complete|transfer|client|record new expense|create new ticket|add new form|refresh users|print|excel|pdf|open form|view/i;

const failures = [];

async function login(page, employeeId) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-employee-id', { state: 'visible', timeout: 10000 });
  await page.fill('#login-employee-id', employeeId);
  await page.fill('#login-password', password);
  await page.click('#login-button');
  await page.waitForFunction(() => {
    const nav = document.querySelector('#user-nav-links');
    return nav && !nav.classList.contains('hidden');
  }, null, { timeout: 20000 });
  await page.evaluate(() => {
    if (typeof stopNotificationPolling === 'function') stopNotificationPolling();
  });
}

async function visibleViews(page) {
  return page.evaluate(() => [...document.querySelectorAll('.nav-link')]
    .filter((link) => {
      const style = getComputedStyle(link);
      return !link.classList.contains('hidden') && style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map((link) => link.getAttribute('data-view'))
    .filter(Boolean));
}

async function visibleControls(page, view) {
  return page.evaluate((viewId) => {
    const root = document.querySelector(`#${viewId}`) || document.body;
    return [...root.querySelectorAll('button,a')]
      .map((element, index) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          index,
          text: (element.innerText || element.title || element.getAttribute('aria-label') || element.value || '')
            .replace(/\s+/g, ' ')
            .trim(),
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
          disabled: element.disabled
        };
      })
      .filter((item) => item.visible && !item.disabled);
  }, view);
}

async function clickVisibleControlByIndex(page, view, index) {
  await page.evaluate(({ viewId, controlIndex }) => {
    const root = document.querySelector(`#${viewId}`) || document.body;
    const elements = [...root.querySelectorAll('button,a')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !element.disabled;
      });
    elements[controlIndex]?.click();
  }, { viewId: view, controlIndex: index });
}

async function runForUser(browser, employeeId) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 850 } });
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (['error', 'warning'].includes(message.type()) && !text.includes('cdn.tailwindcss')) {
      consoleErrors.push(`${message.type()}: ${text}`);
    }
  });

  try {
    await login(page, employeeId);
    for (const view of await visibleViews(page)) {
      await page.evaluate((viewId) => document.querySelector(`.nav-link[data-view="${viewId}"]`)?.click(), view);
      await page.waitForTimeout(900);

      for (const control of await visibleControls(page, view)) {
        const label = control.text || `index-${control.index}`;
        if (skipMutatingOrExternal.test(label)) continue;
        try {
          await clickVisibleControlByIndex(page, view, control.index);
          await page.waitForTimeout(200);
          await page.evaluate(() => {
            if (window.Swal?.isVisible?.()) window.Swal.close();
          });
        } catch (error) {
          failures.push(`${employeeId}/${view}/${label}: click failed ${error.message}`);
        }
      }

      const invalidText = await page.evaluate(() => /Invalid Date|NaN|undefined undefined/.test(document.body.innerText));
      if (invalidText) failures.push(`${employeeId}/${view}: invalid text after safe controls`);
    }

    if (consoleErrors.length) failures.push(`${employeeId}: console errors\n${[...new Set(consoleErrors)].join('\n')}`);
  } catch (error) {
    failures.push(`${employeeId}: ${error.message}`);
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});

for (const employeeId of users) {
  await runForUser(browser, employeeId);
}

await browser.close();

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log('User panel safe interaction verification passed.');
