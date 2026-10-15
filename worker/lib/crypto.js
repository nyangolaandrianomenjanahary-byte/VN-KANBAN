/**
 * Cryptographie : encodage base64url, PBKDF2, HMAC, jetons aléatoires,
 * comparaison à temps constant et vérification des jetons Google (JWT RS256).
 *
 * Tout passe par l'API Web Crypto (crypto.subtle) : aucune bibliothèque.
 */

const encoder = new TextEncoder();

/* ------------------------------------------------------------------ */
/*  Encodage                                                           */
/* ------------------------------------------------------------------ */

export function bytesToB64url(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode.apply(null, view.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToBytes(str) {
  const normalized = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function b64urlToString(str) {
  return new TextDecoder().decode(b64urlToBytes(str));
}

export function stringToB64url(str) {
  return bytesToB64url(encoder.encode(str));
}

/* ------------------------------------------------------------------ */
/*  Aléa et empreintes                                                 */
/* ------------------------------------------------------------------ */

export function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Jeton opaque, sûr pour une URL ou un cookie. */
export function randomToken(bytes = 32) {
  return bytesToB64url(randomBytes(bytes));
}

export function uuid() {
  return crypto.randomUUID();
}

export async function sha256Hex(input) {
  const data = typeof input === 'string' ? encoder.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256B64url(input) {
  const data = typeof input === 'string' ? encoder.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToB64url(new Uint8Array(digest));
}

export async function hmacSha256(keyBytes, messageBytes) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes instanceof Uint8Array ? keyBytes : new Uint8Array(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageBytes);
  return new Uint8Array(signature);
}

/* ------------------------------------------------------------------ */
/*  Comparaison à temps constant                                       */
/* ------------------------------------------------------------------ */

export function timingSafeEqual(a, b) {
  const left = a instanceof Uint8Array ? a : encoder.encode(String(a));
  const right = b instanceof Uint8Array ? b : encoder.encode(String(b));
  if (left.length !== right.length) return false;
  if (crypto.subtle.timingSafeEqual) {
    try {
      return crypto.subtle.timingSafeEqual(left, right);
    } catch {
      /* repli ci-dessous */
    }
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/*  Mots de passe                                                      */
/* ------------------------------------------------------------------ */

/**
 * PBKDF2-HMAC-SHA256.
 * ⚠️ Cloudflare Workers (WebCrypto) refuse plus de 100 000 itérations.
 */
export async function pbkdf2(passwordBytes, saltBytes, iterations, bits = 256) {
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBytes instanceof Uint8Array ? passwordBytes : encoder.encode(String(passwordBytes)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    bits
  );
  return new Uint8Array(derived);
}

export const VERIFIER_PREFIX = 'pbkdf2-sha256';
export const VERIFIER_VERSION = 'v1';
export const CLIENT_KDF_VERSION = 'v1';
export const MAX_PBKDF2_ITERATIONS = 100_000; // plafond de WebCrypto sous Workers

function pepperBytes(pepper) {
  return encoder.encode(`vn-kanban-pepper:${pepper || 'sans-poivre'}`);
}

/**
 * Construit l'empreinte stockée en base.
 *  - le navigateur a déjà étiré le mot de passe (pré-hachage PBKDF2 côté client)
 *  - on ajoute ici un HMAC avec un secret serveur (poivre) : une fuite de la
 *    base seule ne suffit donc pas à lancer une attaque hors ligne
 *  - puis PBKDF2 avec sel aléatoire par utilisateur
 */
export async function hashPassword(clientPrehash, { iterations, pepper }) {
  const safeIterations = Math.min(Math.max(10_000, Number(iterations) || 25_000), MAX_PBKDF2_ITERATIONS);
  const material = await hmacSha256(pepperBytes(pepper), encoder.encode(clientPrehash));
  const salt = randomBytes(16);
  const hash = await pbkdf2(material, salt, safeIterations, 256);
  return `${VERIFIER_PREFIX}$${VERIFIER_VERSION}$${safeIterations}$${bytesToB64url(salt)}$${bytesToB64url(hash)}`;
}

export function parseVerifier(stored) {
  if (typeof stored !== 'string') return null;
  const parts = stored.split('$');
  if (parts.length !== 5) return null;
  const [prefix, version, iterations, salt, hash] = parts;
  if (prefix !== VERIFIER_PREFIX || version !== VERIFIER_VERSION) return null;
  const rounds = Number(iterations);
  if (!Number.isInteger(rounds) || rounds < 1000 || rounds > MAX_PBKDF2_ITERATIONS) return null;
  if (!salt || !hash) return null;
  return { iterations: rounds, salt, hash };
}

/** Vérifie un mot de passe et indique si l'empreinte doit être renforcée. */
export async function verifyPassword(stored, clientPrehash, { iterations, pepper }) {
  const parsed = parseVerifier(stored);
  if (!parsed) return { ok: false, needsUpgrade: false };
  const material = await hmacSha256(pepperBytes(pepper), encoder.encode(clientPrehash));
  const candidate = await pbkdf2(material, b64urlToBytes(parsed.salt), parsed.iterations, 256);
  const ok = timingSafeEqual(candidate, b64urlToBytes(parsed.hash));
  const target = Math.min(Number(iterations) || parsed.iterations, MAX_PBKDF2_ITERATIONS);
  return { ok, needsUpgrade: ok && parsed.iterations < target };
}

/* ------------------------------------------------------------------ */
/*  Vérification des jetons Google (id_token, RS256)                   */
/* ------------------------------------------------------------------ */

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const jwksCache = new Map(); // url -> { at, keys }

async function fetchGoogleKeys(url, force = false) {
  const now = Date.now();
  const cached = jwksCache.get(url);
  if (!force && cached && cached.keys.length && now - cached.at < 30 * 60 * 1000) {
    return cached.keys;
  }
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 1800 }
  });
  if (!response.ok) throw new Error(`JWKS Google indisponible (${response.status})`);
  const payload = await response.json();
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  jwksCache.set(url, { at: now, keys });
  return keys;
}

/**
 * Valide la signature RS256 et les revendications d'un id_token Google.
 * Renvoie la charge utile si tout est correct, sinon lève une erreur.
 */
export async function verifyGoogleIdToken(idToken, clientId, { jwksUrl = GOOGLE_JWKS_URL } = {}) {
  if (typeof idToken !== 'string') throw new Error('id_token manquant');
  const segments = idToken.split('.');
  if (segments.length !== 3) throw new Error('id_token mal formé');
  const [headerB64, payloadB64, signatureB64] = segments;

  let header;
  let payload;
  try {
    header = JSON.parse(b64urlToString(headerB64));
    payload = JSON.parse(b64urlToString(payloadB64));
  } catch {
    throw new Error('id_token illisible');
  }

  if (header.alg !== 'RS256') throw new Error('algorithme de signature inattendu');

  let keys = await fetchGoogleKeys(jwksUrl);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await fetchGoogleKeys(jwksUrl, true); // rotation de clés : on retente une fois
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('clé de signature Google inconnue');

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(signatureB64),
    encoder.encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) throw new Error('signature Google invalide');

  const now = Math.floor(Date.now() / 1000);
  const issuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (!issuers.includes(payload.iss)) throw new Error('émetteur du jeton inattendu');
  if (payload.aud !== clientId) throw new Error('jeton destiné à une autre application');
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) throw new Error('jeton expiré');
  if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new Error('jeton émis dans le futur');
  if (payload.email && payload.email_verified === false) {
    throw new Error('adresse e-mail Google non vérifiée');
  }
  return payload;
}
