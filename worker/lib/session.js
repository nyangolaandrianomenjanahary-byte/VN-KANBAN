/**
 * Sessions : jeton opaque dans un cookie HttpOnly.
 * Seul le SHA-256 du jeton est stocké en base → une fuite de la base ne permet
 * pas de rejouer une session.
 */

import { randomToken, sha256Hex } from './crypto.js';
import { clientIp, isSecureRequest, nowMs, parseCookies, serializeCookie, userAgent } from './utils.js';
import { getUserById } from './db.js';

export const SESSION_COOKIE = 'vn_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
const RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // renouvellement glissant

export async function createSession(env, request, userId) {
  const token = randomToken(32);
  const id = await sha256Hex(token);
  const now = nowMs();
  const expiresAt = now + SESSION_TTL_MS;
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent, ip)
     VALUES (?,?,?,?,?,?,?)`
  )
    .bind(id, userId, now, expiresAt, now, userAgent(request), clientIp(request))
    .run();
  return { token, id, expiresAt };
}

export function cookieFor(token, request, expiresAt) {
  return serializeCookie(SESSION_COOKIE, token, {
    maxAge: Math.max(0, Math.floor((expiresAt - nowMs()) / 1000)),
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'Lax',
    path: '/'
  });
}

export function clearedCookie(request) {
  return serializeCookie(SESSION_COOKIE, '', {
    maxAge: 0,
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'Lax',
    path: '/'
  });
}

/**
 * Récupère l'utilisateur connecté à partir du cookie de session.
 * Renvoie null si aucune session valide (jeton inconnu, expiré, révoqué,
 * compte suspendu ou supprimé).
 */
export async function currentSession(env, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || token.length < 20 || token.length > 200) return null;

  const id = await sha256Hex(token);
  const session = await env.DB.prepare(
    'SELECT id, user_id, created_at, expires_at, revoked_at FROM sessions WHERE id = ?'
  )
    .bind(id)
    .first();
  if (!session || session.revoked_at) return null;

  const now = nowMs();
  if (session.expires_at < now) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    return null;
  }

  const user = await getUserById(env, session.user_id);
  if (!user) return null;
  if (user.status === 'suspended') {
    await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(now, id).run();
    return null;
  }

  let expiresAt = session.expires_at;
  let renewed = false;
  if (expiresAt - now < RENEW_THRESHOLD_MS) {
    expiresAt = now + SESSION_TTL_MS;
    renewed = true;
    await env.DB.prepare('UPDATE sessions SET expires_at = ?, last_seen_at = ? WHERE id = ?').bind(expiresAt, now, id).run();
  }

  return { user, sessionId: id, token, expiresAt, renewed };
}

export async function revokeSession(env, sessionId) {
  await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(nowMs(), sessionId).run();
}

export async function revokeAllSessions(env, userId, exceptSessionId = null) {
  const now = nowMs();
  if (exceptSessionId) {
    await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id <> ?').bind(now, userId, exceptSessionId).run();
  } else {
    await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ?').bind(now, userId).run();
  }
}

export function isRoot(user) {
  return !!user && (user.role === 'root' || user.role === 'admin');
}
