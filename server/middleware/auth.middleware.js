import crypto from 'crypto';

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function secret() {
  return process.env.WORKTRACK_AUTH_SECRET || 'worktrack-development-secret-change-me';
}

export function assertAuthConfiguration() {
  if (process.env.NODE_ENV === 'production' && !process.env.WORKTRACK_AUTH_SECRET) {
    throw new Error('WORKTRACK_AUTH_SECRET is required in production.');
  }
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signature(input) {
  return crypto.createHmac('sha256', secret()).update(input).digest('base64url');
}

export function createAccessToken({ kind, id, role = '' }) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'WTK' });
  const payload = encode({ sub: String(id), kind, role: String(role || ''), iat: now, exp: now + TOKEN_TTL_SECONDS });
  return `${header}.${payload}.${signature(`${header}.${payload}`)}`;
}

export function verifyAccessToken(token) {
  const [header, payload, providedSignature] = String(token || '').split('.');
  if (!header || !payload || !providedSignature) return null;

  const expected = signature(`${header}.${payload}`);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }

  try {
    const claims = decode(payload);
    if (!claims?.sub || !claims?.kind || !claims?.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function requireAuth(options = {}) {
  return (req, res, next) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const claims = verifyAccessToken(token);
    if (!claims) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (options.kind && claims.kind !== options.kind) {
      return res.status(403).json({ success: false, message: 'This account type cannot access this resource.' });
    }
    if (options.roles?.length && !options.roles.some((role) => String(role).toLowerCase() === String(claims.role || '').toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Your account does not have permission for this resource.' });
    }
    req.auth = claims;
    return next();
  };
}

export function assertIdentity(req, kind, id) {
  return req.auth?.kind === kind && String(req.auth.sub).toLowerCase() === String(id || '').trim().toLowerCase();
}
