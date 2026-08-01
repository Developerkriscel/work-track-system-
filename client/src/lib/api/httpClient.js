const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function toRequestUrl(path = '') {
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  return `${configuredBaseUrl}${normalizedPath}`;
}

export async function httpClient(path, options = {}) {
  const employeeSession = typeof window !== 'undefined'
    ? window.localStorage.getItem('worktrack.mern.employeeSession')
    : null;
  const clientSession = typeof window !== 'undefined'
    ? window.localStorage.getItem('worktrack.mern.clientSession')
    : null;
  const isClientRequest = /^\/api\/(?:client(?:-portal|-social)?(?:\/|$)|auth\/client(?:\/|$)|notifications\/client(?:\/|$))/.test(path);
  let token = '';
  try {
    const session = JSON.parse((isClientRequest ? clientSession : employeeSession) || 'null');
    token = session?.token || '';
  } catch {
    token = '';
  }

  const response = await fetch(toRequestUrl(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.message ? payload.message : 'Request failed';
    throw new Error(message);
  }

  return payload;
}
