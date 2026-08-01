const R2_HOST_PATTERN = /(^|\.)r2\.cloudflarestorage\.com$/i;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function safe(value = '') {
  return String(value ?? '').trim();
}

function escapeHtml(value = '') {
  return safe(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isR2Url(value = '') {
  const raw = safe(value);
  if (!raw || !/^https?:\/\//i.test(raw)) return false;

  try {
    const parsed = new URL(raw);
    return R2_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

function isProtectedPreviewUrl(value = '') {
  const raw = safe(value);
  return /^\/?api\/files\/preview\?/i.test(raw) || /^https?:\/\/[^/]+\/api\/files\/preview\?/i.test(raw);
}

function parseSession(raw) {
  try {
    return JSON.parse(raw || 'null');
  } catch {
    return null;
  }
}

function getAuthToken(preferClient = false) {
  if (typeof window === 'undefined') return '';
  const employeeSession = parseSession(window.localStorage.getItem('worktrack.mern.employeeSession'));
  const clientSession = parseSession(window.localStorage.getItem('worktrack.mern.clientSession'));
  const preferred = preferClient
    ? [clientSession?.token, employeeSession?.token]
    : [employeeSession?.token, clientSession?.token];
  return preferred.find((token) => safe(token)) || '';
}

function toApiUrl(value = '') {
  const raw = safe(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function toPreviewUrl(value = '') {
  const raw = safe(value);
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return raw;
  if (!isR2Url(raw)) return raw;
  return `/api/files/preview?url=${encodeURIComponent(raw)}`;
}

export function toPreviewUrls(value = '') {
  return safe(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => toPreviewUrl(item));
}

function writePopupState(popup, title, body) {
  if (!popup || popup.closed) return;
  try {
    popup.document.open();
    popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #eef6ff;
        color: #18233f;
        font-family: Inter, "Segoe UI", Arial, sans-serif;
      }
      main {
        width: min(520px, calc(100vw - 32px));
        background: #fff;
        border: 1px solid #d8e4f2;
        border-radius: 18px;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
        padding: 28px;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 24px;
        line-height: 1.2;
      }
      p {
        margin: 0;
        color: #57627d;
        line-height: 1.6;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${body}</p>
    </main>
  </body>
</html>`);
    popup.document.close();
  } catch {
    // Ignore popup rendering failures and let the fetch fallback handle it.
  }
}

function renderBlobInPopup(popup, blobUrl, fileName = 'File preview', contentType = 'application/octet-stream') {
  if (!popup || popup.closed) return false;

  const safeTitle = escapeHtml(fileName || 'File preview');
  const safeBlobUrl = escapeHtml(blobUrl);
  const kind = safe(contentType).toLowerCase();

  let content = `
    <section class="fallback">
      <h2>Preview unavailable</h2>
      <p>This file type cannot be previewed directly in the browser.</p>
      <a href="${safeBlobUrl}" target="_self" download="${safeTitle}">Download file</a>
    </section>
  `;

  if (kind.startsWith('image/')) {
    content = `
      <figure class="image-viewer">
        <img src="${safeBlobUrl}" alt="${safeTitle}" />
      </figure>
    `;
  } else if (kind === 'application/pdf') {
    content = `<iframe class="document-frame" src="${safeBlobUrl}" title="${safeTitle}"></iframe>`;
  } else if (
    kind.startsWith('text/')
    || kind.includes('json')
    || kind.includes('xml')
  ) {
    content = `<iframe class="document-frame" src="${safeBlobUrl}" title="${safeTitle}"></iframe>`;
  }

  try {
    popup.document.open();
    popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: #0f172a;
        color: #e2e8f0;
        font-family: Inter, "Segoe UI", Arial, sans-serif;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.92);
        position: sticky;
        top: 0;
      }
      h1 {
        margin: 0;
        font-size: 16px;
        line-height: 1.4;
        font-weight: 700;
        max-width: calc(100vw - 220px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .actions a {
        color: #bfdbfe;
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
      }
      .viewer {
        width: 100vw;
        height: calc(100vh - 62px);
        display: grid;
        place-items: center;
        padding: 12px;
      }
      .document-frame {
        width: 100%;
        height: 100%;
        border: 0;
        background: #fff;
        border-radius: 14px;
      }
      .image-viewer {
        margin: 0;
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
      }
      .image-viewer img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);
      }
      .fallback {
        width: min(460px, calc(100vw - 32px));
        padding: 28px;
        border-radius: 20px;
        background: #fff;
        color: #18233f;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
      }
      .fallback h2 {
        margin: 0 0 10px;
        font-size: 24px;
      }
      .fallback p {
        margin: 0 0 16px;
        color: #5b6785;
        line-height: 1.6;
      }
      .fallback a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        background: linear-gradient(135deg, #356bf3, #7c3aed);
        color: #fff;
        text-decoration: none;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${safeTitle}</h1>
      <div class="actions">
        <a href="${safeBlobUrl}" target="_self" download="${safeTitle}">Download</a>
      </div>
    </header>
    <main class="viewer">${content}</main>
  </body>
</html>`);
    popup.document.close();
    return true;
  } catch {
    return false;
  }
}

export async function openProtectedFile(value = '', options = {}) {
  const raw = safe(value);
  if (!raw) return;

  const preferClient = Boolean(options.preferClient);
  const previewUrl = toPreviewUrl(raw);
  const shouldUseProtectedFetch = isProtectedPreviewUrl(previewUrl) || isR2Url(raw);

  if (!shouldUseProtectedFetch) {
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const token = getAuthToken(preferClient);
  const popup = window.open('', '_blank');
  writePopupState(popup, 'Opening file', 'Please wait while the file is being loaded.');

  try {
    const response = await fetch(toApiUrl(previewUrl), {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      let message = 'File could not be opened.';
      try {
        const payload = await response.json();
        message = payload?.message || message;
      } catch {
        message = response.statusText || message;
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const fileName = raw.split('/').pop()?.split('?')[0] || 'File preview';

    if (popup && !popup.closed) {
      const rendered = renderBlobInPopup(popup, blobUrl, fileName, blob.type || response.headers.get('content-type') || '');
      if (!rendered) {
        popup.location.replace(blobUrl);
      }
    } else {
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    }

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    if (popup && !popup.closed) {
      writePopupState(
        popup,
        'File could not be opened',
        error?.message || 'The file could not be loaded right now.'
      );
    }
    throw error;
  }
}
