/**
 * Utilitaires HTTP, validation et réponses JSON.
 * Aucune dépendance externe : tout repose sur les API Web standard.
 */

/* ------------------------------------------------------------------ */
/*  Réponses                                                           */
/* ------------------------------------------------------------------ */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store'
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...SECURITY_HEADERS,
      ...extraHeaders
    }
  });
}

export function fail(status, code, message, details) {
  return json({ error: code, message, ...(details ? { details } : {}) }, status);
}

export function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, ...SECURITY_HEADERS, ...extraHeaders }
  });
}

/* ------------------------------------------------------------------ */
/*  Lecture de la requête                                              */
/* ------------------------------------------------------------------ */

export async function readJson(request, maxBytes = 2_000_000) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) {
    throw new HttpError(415, 'bad_content_type', 'Le corps de la requête doit être du JSON.');
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    throw new HttpError(413, 'payload_too_large', 'Données trop volumineuses (limite 2 Mo).');
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('objet attendu');
    }
    return parsed;
  } catch {
    throw new HttpError(400, 'bad_json', 'JSON invalide.');
  }
}

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/* ------------------------------------------------------------------ */
/*  Cookies                                                            */
/* ------------------------------------------------------------------ */

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.expires) parts.push(`Expires=${new Date(options.expires).toUTCString()}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join('; ');
}

export function isSecureRequest(request) {
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return true;
  }
}

/* ------------------------------------------------------------------ */
/*  Divers                                                             */
/* ------------------------------------------------------------------ */

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Real-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    'inconnue'
  );
}

export function userAgent(request) {
  return (request.headers.get('User-Agent') || '').slice(0, 250);
}

/** URL publique de l'application (sert aux redirections OAuth et aux liens). */
export function appOrigin(request, env) {
  const fixed = (env.APP_URL || '').trim();
  if (fixed) return fixed.replace(/\/+$/, '');
  return new URL(request.url).origin;
}

/** Empêche les redirections ouvertes : on n'accepte que des chemins internes. */
export function safeNextPath(value, fallback = '/') {
  if (typeof value !== 'string' || !value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) return fallback;
  return value.slice(0, 500);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email || email.length > 190 || !EMAIL_RE.test(email)) {
    throw new HttpError(400, 'invalid_email', 'Adresse e-mail invalide.');
  }
  return email;
}

/**
 * Le mot de passe reçu n'est pas le mot de passe réel : c'est le résultat du
 * pré-hachage PBKDF2 effectué dans le navigateur (voir public/js/vn-auth.js).
 * On valide donc le format, pas la longueur d'origine.
 */
export function validateClientPassword(value, field = 'password') {
  if (typeof value !== 'string' || value.length < 32 || value.length > 200) {
    throw new HttpError(400, 'invalid_password', 'Mot de passe invalide.');
  }
  if (!/^[A-Za-z0-9_\-]+$/.test(value)) {
    throw new HttpError(400, 'invalid_password', 'Mot de passe invalide (encodage inattendu).');
  }
  return value;
}

export function validateName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  return name.slice(0, 80);
}

export function nowMs() {
  return Date.now();
}

/** Attente (utilisée pour lisser les temps de réponse et freiner le bourrage). */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(value, max = 500) {
  if (value === null || value === undefined) return null;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}
