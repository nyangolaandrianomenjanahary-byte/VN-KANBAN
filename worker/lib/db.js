/**
 * Accès à la base D1 (SQLite hébergé par Cloudflare).
 * Toutes les requêtes sont préparées (paramètres liés) : pas d'injection SQL.
 */

import { HttpError, nowMs, truncate } from './utils.js';
import { uuid } from './crypto.js';

/* ------------------------------------------------------------------ */
/*  Utilisateurs                                                       */
/* ------------------------------------------------------------------ */

const USER_COLUMN_LIST = [
  'id',
  'email',
  'name',
  'picture',
  'role',
  'status',
  'provider',
  'google_sub',
  'email_verified',
  'password_hash',
  'password_kdf',
  'password_at',
  'must_reset',
  'failed_attempts',
  'locked_until',
  'last_login_at',
  'last_login_ip',
  'created_at',
  'updated_at'
];
const USER_COLUMNS = USER_COLUMN_LIST.join(', ');
const USER_COLUMNS_U = USER_COLUMN_LIST.map((c) => `u.${c}`).join(', ');

export function publicUser(row, { withStats = false } = {}) {
  if (!row) return null;
  const user = {
    id: row.id,
    email: row.email,
    name: row.name || null,
    picture: row.picture || null,
    role: row.role || 'user',
    status: row.status || 'active',
    provider: row.provider || 'email',
    hasPassword: !!row.password_hash,
    googleLinked: !!row.google_sub,
    emailVerified: !!row.email_verified,
    mustReset: !!row.must_reset,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (withStats) {
    user.failedAttempts = row.failed_attempts || 0;
    user.lockedUntil = row.locked_until || null;
    user.lastLoginIp = row.last_login_ip || null;
    user.boardUpdatedAt = row.board_updated_at || null;
    user.boardSize = row.board_size ?? null;
    user.cardCount = row.card_count ?? null;
  }
  return user;
}

export async function getUserByEmail(env, email) {
  return env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).bind(email).first();
}

export async function getUserById(env, id) {
  return env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first();
}

export async function getUserByGoogleSub(env, sub) {
  return env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE google_sub = ?`).bind(sub).first();
}

export async function getFirstUser(env) {
  return env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at ASC LIMIT 1`).first();
}

export async function countUsers(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  return row ? row.n : 0;
}

export async function countRoots(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'root'").first();
  return row ? row.n : 0;
}

export async function createUser(env, data) {
  const now = nowMs();
  const id = data.id || uuid();
  await env.DB.prepare(
    `INSERT INTO users (
        id, email, name, picture, role, status, provider, google_sub,
        email_verified, password_hash, password_kdf, password_at, must_reset,
        created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      data.email,
      data.name || null,
      data.picture || null,
      data.role || 'user',
      data.status || 'active',
      data.provider || 'email',
      data.googleSub || null,
      data.emailVerified ? 1 : 0,
      data.passwordHash || null,
      data.passwordKdf || null,
      data.passwordHash ? now : null,
      data.mustReset ? 1 : 0,
      now,
      now
    )
    .run();
  return getUserById(env, id);
}

export async function updateUser(env, id, patch) {
  const allowed = {
    email: 'email',
    name: 'name',
    picture: 'picture',
    role: 'role',
    status: 'status',
    provider: 'provider',
    google_sub: 'google_sub',
    email_verified: 'email_verified',
    password_hash: 'password_hash',
    password_kdf: 'password_kdf',
    password_at: 'password_at',
    must_reset: 'must_reset',
    failed_attempts: 'failed_attempts',
    locked_until: 'locked_until',
    last_login_at: 'last_login_at',
    last_login_ip: 'last_login_ip'
  };
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (key in patch) {
      sets.push(`${column} = ?`);
      values.push(patch[key]);
    }
  }
  if (!sets.length) return getUserById(env, id);
  sets.push('updated_at = ?');
  values.push(nowMs(), id);
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return getUserById(env, id);
}

export async function deleteUser(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM boards WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id)
  ]);
}

export async function listUsers(env, { search = '', role = '', status = '', limit = 25, offset = 0 } = {}) {
  const where = [];
  const values = [];
  if (search) {
    where.push('(u.email LIKE ? OR u.name LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }
  if (role) {
    where.push('u.role = ?');
    values.push(role);
  }
  if (status) {
    where.push('u.status = ?');
    values.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users u ${clause}`).bind(...values).first();
  const rows = await env.DB.prepare(
    `SELECT ${USER_COLUMNS_U},
            b.updated_at AS board_updated_at,
            b.size_bytes AS board_size,
            json_array_length(b.data, '$.cards') AS card_count
       FROM users u
       LEFT JOIN boards b ON b.user_id = u.id
       ${clause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`
  )
    .bind(...values, limit, offset)
    .all();

  return {
    total: total ? total.n : 0,
    users: (rows.results || []).map((row) => publicUser(row, { withStats: true }))
  };
}

/* ------------------------------------------------------------------ */
/*  Tableaux Kanban (une ligne par utilisateur)                        */
/* ------------------------------------------------------------------ */

export async function getBoard(env, userId) {
  return env.DB.prepare(
    'SELECT user_id, data, archive, revision, size_bytes, created_at, updated_at, updated_by FROM boards WHERE user_id = ?'
  )
    .bind(userId)
    .first();
}

export async function saveBoard(env, userId, { data, archive, baseRevision, updatedBy = null }) {
  const now = nowMs();
  const dataText = JSON.stringify(data);
  const archiveText = JSON.stringify(archive ?? []);
  const size = dataText.length + archiveText.length;
  if (size > 1_800_000) {
    throw new HttpError(413, 'board_too_large', 'Tableau trop volumineux pour la synchronisation (limite ~1,8 Mo).');
  }

  const existing = await getBoard(env, userId);

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO boards (user_id, data, archive, revision, size_bytes, created_at, updated_at, updated_by)
       VALUES (?,?,?,1,?,?,?,?)`
    )
      .bind(userId, dataText, archiveText, size, now, now, updatedBy)
      .run();
    return { revision: 1, createdAt: now, updatedAt: now, conflict: false };
  }

  // Verrou optimiste : si la révision a bougé, on renvoie la version serveur.
  if (baseRevision !== undefined && baseRevision !== null && Number(baseRevision) !== existing.revision) {
    return { conflict: true, revision: existing.revision, data: existing.data, archive: existing.archive, updatedAt: existing.updated_at };
  }

  const nextRevision = existing.revision + 1;
  await env.DB.prepare(
    'UPDATE boards SET data = ?, archive = ?, revision = ?, size_bytes = ?, updated_at = ?, updated_by = ? WHERE user_id = ?'
  )
    .bind(dataText, archiveText, nextRevision, size, now, updatedBy, userId)
    .run();
  return { revision: nextRevision, updatedAt: now, conflict: false };
}

export async function writeBoardDirect(env, userId, { data, archive }, updatedBy) {
  const now = nowMs();
  const dataText = JSON.stringify(data);
  const archiveText = JSON.stringify(archive ?? []);
  const size = dataText.length + archiveText.length;
  const existing = await getBoard(env, userId);
  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO boards (user_id, data, archive, revision, size_bytes, created_at, updated_at, updated_by)
       VALUES (?,?,?,1,?,?,?,?)`
    )
      .bind(userId, dataText, archiveText, size, now, now, updatedBy || 'root')
      .run();
  } else {
    await env.DB.prepare(
      'UPDATE boards SET data = ?, archive = ?, revision = ?, size_bytes = ?, updated_at = ?, updated_by = ? WHERE user_id = ?'
    )
      .bind(dataText, archiveText, existing.revision + 1, size, now, updatedBy || 'root', userId)
      .run();
  }
  return true;
}

export async function deleteBoard(env, userId) {
  await env.DB.prepare('DELETE FROM boards WHERE user_id = ?').bind(userId).run();
}

/* ------------------------------------------------------------------ */
/*  Journal d'audit                                                    */
/* ------------------------------------------------------------------ */

export async function audit(env, { actorId = null, actorEmail = null, action, target = null, details = null, ip = null }) {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (at, actor_id, actor_email, action, target, details, ip) VALUES (?,?,?,?,?,?,?)'
    )
      .bind(nowMs(), actorId, actorEmail, action, target, truncate(details, 500), ip)
      .run();
  } catch (error) {
    console.warn('Journalisation impossible :', error && error.message);
  }
}

export async function listAudit(env, { limit = 100, offset = 0, action = '' } = {}) {
  const clause = action ? 'WHERE action = ?' : '';
  const rows = await env.DB.prepare(
    `SELECT id, at, actor_email, action, target, details, ip FROM audit_log ${clause} ORDER BY at DESC LIMIT ? OFFSET ?`
  )
    .bind(...(action ? [action, limit, offset] : [limit, offset]))
    .all();
  return rows.results || [];
}

/* ------------------------------------------------------------------ */
/*  Limitation de débit                                                */
/* ------------------------------------------------------------------ */

/**
 * Compteur à fenêtre glissante stocké dans D1.
 * Renvoie { allowed, retryAfterSecondes, blocked }.
 */
export async function rateLimit(env, key, { max = 10, windowMs = 15 * 60 * 1000, blockMs = 15 * 60 * 1000 } = {}) {
  const now = nowMs();
  const row = await env.DB.prepare('SELECT key, count, window_at, blocked_until FROM rate_limits WHERE key = ?')
    .bind(key)
    .first();

  if (row && row.blocked_until && row.blocked_until > now) {
    return { allowed: false, blocked: true, retryAfter: Math.ceil((row.blocked_until - now) / 1000) };
  }

  if (!row || now - row.window_at > windowMs) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, count, window_at, blocked_until) VALUES (?,1,?,NULL)
       ON CONFLICT (key) DO UPDATE SET count = 1, window_at = ?, blocked_until = NULL`
    )
      .bind(key, now, now)
      .run();
    return { allowed: true, blocked: false, remaining: max - 1 };
  }

  const nextCount = row.count + 1;
  const shouldBlock = nextCount > max;
  await env.DB.prepare('UPDATE rate_limits SET count = ?, blocked_until = ? WHERE key = ?')
    .bind(nextCount, shouldBlock ? now + blockMs : null, key)
    .run();
  return {
    allowed: !shouldBlock,
    blocked: shouldBlock,
    remaining: Math.max(0, max - nextCount),
    retryAfter: shouldBlock ? Math.ceil(blockMs / 1000) : 0
  };
}

export async function clearRateLimit(env, key) {
  await env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
}

export async function pruneExpired(env) {
  const now = nowMs();
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
      env.DB.prepare('DELETE FROM password_resets WHERE expires_at < ? OR used_at IS NOT NULL').bind(now),
      env.DB.prepare('DELETE FROM rate_limits WHERE window_at < ? AND (blocked_until IS NULL OR blocked_until < ?)').bind(
        now - 24 * 60 * 60 * 1000,
        now
      ),
      env.DB.prepare('DELETE FROM audit_log WHERE at < ?').bind(now - 180 * 24 * 60 * 60 * 1000)
    ]);
  } catch (error) {
    console.warn('Purge impossible :', error && error.message);
  }
}

/* ------------------------------------------------------------------ */
/*  Réinitialisation de mot de passe                                   */
/* ------------------------------------------------------------------ */

export async function createPasswordReset(env, userId, { tokenHash, ttlMs = 60 * 60 * 1000, ip = null }) {
  const now = nowMs();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(userId),
    env.DB.prepare('INSERT INTO password_resets (token_hash, user_id, created_at, expires_at, requested_ip) VALUES (?,?,?,?,?)').bind(
      tokenHash,
      userId,
      now,
      now + ttlMs,
      ip
    )
  ]);
}

export async function consumePasswordReset(env, tokenHash) {
  const now = nowMs();
  const row = await env.DB.prepare(
    'SELECT token_hash, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?'
  )
    .bind(tokenHash)
    .first();
  if (!row || row.used_at || row.expires_at < now) return null;
  await env.DB.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').bind(now, tokenHash).run();
  return row;
}

/* ------------------------------------------------------------------ */
/*  Statistiques (console ROOT)                                        */
/* ------------------------------------------------------------------ */

export async function globalStats(env) {
  const [usersRes, boardsRes, sessionsRes, auditRes, recentRes] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN role = 'root' THEN 1 ELSE 0 END) AS roots,
              SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
              SUM(CASE WHEN google_sub IS NOT NULL THEN 1 ELSE 0 END) AS google_users
         FROM users`
    ),
    env.DB.prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(json_array_length(data, '$.cards')), 0) AS cards,
              COALESCE(SUM(size_bytes), 0) AS bytes
         FROM boards`
    ),
    env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE revoked_at IS NULL AND expires_at > ?').bind(Date.now()),
    env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log'),
    env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE created_at > ?').bind(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ]);

  const u = usersRes.results?.[0] || {};
  const b = boardsRes.results?.[0] || {};
  const s = sessionsRes.results?.[0] || {};
  const a = auditRes.results?.[0] || {};
  const r = recentRes.results?.[0] || {};
  return {
    users: {
      total: u.total || 0,
      roots: u.roots || 0,
      suspended: u.suspended || 0,
      google: u.google_users || 0,
      newLast7Days: r.n || 0
    },
    boards: { total: b.n || 0, cards: b.cards || 0, bytes: b.bytes || 0 },
    sessions: { active: s.n || 0 },
    audit: { entries: a.n || 0 }
  };
}
