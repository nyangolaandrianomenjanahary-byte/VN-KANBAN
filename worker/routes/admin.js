/**
 * Console ROOT : administration des comptes et de la base de données.
 * Toutes les routes exigent une session avec le rôle « root ».
 *
 *   GET    /api/admin/stats
 *   GET    /api/admin/users
 *   POST   /api/admin/users
 *   PATCH  /api/admin/users/:id
 *   DELETE /api/admin/users/:id
 *   POST   /api/admin/users/:id/reset-link
 *   POST   /api/admin/users/:id/revoke-sessions
 *   GET    /api/admin/users/:id/board
 *   PUT    /api/admin/users/:id/board
 *   DELETE /api/admin/users/:id/board
 *   GET    /api/admin/audit
 *   GET    /api/admin/backup
 *   POST   /api/admin/restore
 */

import {
  HttpError,
  clientIp,
  json,
  readJson,
  validateClientPassword,
  validateEmail,
  validateName
} from '../lib/utils.js';
import { CLIENT_KDF_VERSION, hashPassword, randomToken, sha256Hex } from '../lib/crypto.js';
import {
  audit,
  countRoots,
  createPasswordReset,
  createUser,
  deleteBoard,
  deleteUser,
  getBoard,
  getUserByEmail,
  getUserById,
  globalStats,
  listAudit,
  listUsers,
  publicUser,
  updateUser,
  writeBoardDirect
} from '../lib/db.js';
import { currentSession, isRoot, revokeAllSessions } from '../lib/session.js';

const ROLES = new Set(['root', 'admin', 'user']);
const STATUSES = new Set(['active', 'suspended']);
const ITERATIONS = (env) => Number(env.PBKDF2_ITERATIONS) || 25_000;
const PEPPER = (env) => env.PASSWORD_PEPPER || '';

/**
 * Deux niveaux d'accès :
 *   • ROOT  : contrôle total (comptes, rôles, tableaux, sauvegardes)
 *   • ADMIN : consultation seule (statistiques, liste des comptes, journal)
 */
async function requireSession(env, request) {
  const session = await currentSession(env, request);
  if (!session) throw new HttpError(401, 'unauthenticated', 'Vous devez être connecté.');
  if (!isRoot(session.user)) {
    throw new HttpError(403, 'forbidden', 'Accès réservé à l’administration.');
  }
  return session;
}

async function requireRoot(env, request) {
  const session = await requireSession(env, request);
  if (session.user.role !== 'root') {
    throw new HttpError(
      403,
      'root_required',
      'Action réservée au compte ROOT : le rôle « admin » est en lecture seule.'
    );
  }
  return session;
}

/**
 * L'API n'accepte JAMAIS de mot de passe en clair, même pour le ROOT.
 *
 * Raison : l'étirement du mot de passe (PBKDF2, 210 000 itérations) se fait
 * dans le navigateur. Le serveur reçoit donc directement le pré-hachage —
 * exactement la même valeur que celle produite à la connexion par l'utilisateur.
 * (Refaire ce calcul côté serveur dépasserait la limite de CPU de Cloudflare.)
 *
 * Le champ attendu s'appelle `password` et contient ce pré-hachage : la console
 * d'administration le calcule elle-même via VNAuth.prehash().
 * Pour transmettre un mot de passe sans le connaître, utilisez plutôt
 * « générer un lien de réinitialisation ».
 */
function passwordHashFromClient(env, value) {
  let prehash;
  try {
    prehash = validateClientPassword(value);
  } catch {
    throw new HttpError(
      400,
      'invalid_prehash',
      'Le champ « password » doit contenir le pré-hachage calculé par le navigateur (VNAuth.prehash), jamais un mot de passe en clair.'
    );
  }
  return hashPassword(prehash, { iterations: ITERATIONS(env), pepper: PEPPER(env) });
}

/* ------------------------------------------------------------------ */
/*  Vue d'ensemble                                                     */
/* ------------------------------------------------------------------ */

export async function stats(env, request) {
  await requireSession(env, request);
  const data = await globalStats(env);
  return json({
    ...data,
    config: {
      pbkdf2Iterations: ITERATIONS(env),
      pepperConfigured: !!env.PASSWORD_PEPPER,
      googleConfigured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      mailerConfigured: !!(env.RESEND_API_KEY || env.MAIL_WEBHOOK_URL),
      allowSignup: (env.ALLOW_SIGNUP || 'true') !== 'false',
      firstUserIsRoot: (env.FIRST_USER_IS_ROOT || 'true') !== 'false',
      appUrl: env.APP_URL || null,
      kdf: CLIENT_KDF_VERSION
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Utilisateurs                                                       */
/* ------------------------------------------------------------------ */

export async function users(env, request) {
  await requireSession(env, request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const result = await listUsers(env, {
    search: (url.searchParams.get('q') || '').trim().slice(0, 80),
    role: ROLES.has(url.searchParams.get('role')) ? url.searchParams.get('role') : '',
    status: STATUSES.has(url.searchParams.get('status')) ? url.searchParams.get('status') : '',
    limit,
    offset: (page - 1) * limit
  });
  return json({ ...result, page, limit, pages: Math.max(1, Math.ceil(result.total / limit)) });
}

export async function createUserByRoot(env, request) {
  const session = await requireRoot(env, request);
  const body = await readJson(request);
  const email = validateEmail(body.email);
  const name = validateName(body.name);
  const role = ROLES.has(body.role) ? body.role : 'user';

  if (await getUserByEmail(env, email)) {
    throw new HttpError(409, 'email_taken', 'Cette adresse e-mail est déjà utilisée.');
  }

  const passwordHash = body.password ? await passwordHashFromClient(env, body.password) : null;
  const created = await createUser(env, {
    email,
    name,
    role,
    status: 'active',
    provider: 'email',
    emailVerified: false,
    passwordHash,
    mustReset: body.mustReset ? 1 : 0
  });

  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.user.create',
    target: created.id,
    details: `${email} (${role})`,
    ip: clientIp(request)
  });
  return json({ user: publicUser(created) }, 201);
}

export async function updateUserByRoot(env, request, id) {
  const session = await requireRoot(env, request);
  const body = await readJson(request);
  const target = await getUserById(env, id);
  if (!target) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');

  const patch = {};
  const changes = [];

  if (body.role !== undefined) {
    if (!ROLES.has(body.role)) throw new HttpError(400, 'invalid_role', 'Rôle inconnu.');
    if (target.role === 'root' && body.role !== 'root') {
      const roots = await countRoots(env);
      if (roots <= 1) throw new HttpError(409, 'last_root', 'Impossible de retirer le dernier compte ROOT.');
    }
    patch.role = body.role;
    changes.push(`rôle ${target.role} → ${body.role}`);
  }

  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) throw new HttpError(400, 'invalid_status', 'Statut inconnu.');
    if (target.id === session.user.id && body.status === 'suspended') {
      throw new HttpError(409, 'self_suspend', 'Vous ne pouvez pas suspendre votre propre compte.');
    }
    patch.status = body.status;
    changes.push(`statut ${target.status} → ${body.status}`);
  }

  if (body.name !== undefined) {
    patch.name = validateName(body.name);
    changes.push('nom modifié');
  }

  if (body.email !== undefined) {
    const email = validateEmail(body.email);
    const other = await getUserByEmail(env, email);
    if (other && other.id !== target.id) throw new HttpError(409, 'email_taken', 'Cette adresse e-mail est déjà utilisée.');
    patch.email = email;
    changes.push('e-mail modifié');
  }

  if (body.mustReset !== undefined) {
    patch.must_reset = body.mustReset ? 1 : 0;
    changes.push(body.mustReset ? 'réinitialisation imposée' : 'réinitialisation levée');
  }

  if (body.password) {
    patch.password_hash = await passwordHashFromClient(env, body.password);
    patch.password_kdf = CLIENT_KDF_VERSION;
    patch.password_at = Date.now();
    // Un mot de passe transmis par le ROOT est TOUJOURS temporaire :
    // l'utilisateur devra le changer à sa première connexion.
    patch.must_reset = 1;
    patch.failed_attempts = 0;
    patch.locked_until = null;
    changes.push('mot de passe temporaire défini par le ROOT (changement imposé)');
    await revokeAllSessions(env, target.id);
  }

  if (!changes.length) throw new HttpError(400, 'nothing_to_update', 'Aucune modification demandée.');

  const updated = await updateUser(env, target.id, patch);
  if (patch.status === 'suspended') await revokeAllSessions(env, target.id);

  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.user.update',
    target: target.id,
    details: `${target.email} : ${changes.join(', ')}`,
    ip: clientIp(request)
  });
  return json({ user: publicUser(updated) });
}

export async function deleteUserByRoot(env, request, id) {
  const session = await requireRoot(env, request);
  const target = await getUserById(env, id);
  if (!target) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
  if (target.id === session.user.id) {
    throw new HttpError(409, 'self_delete', 'Vous ne pouvez pas supprimer votre propre compte depuis la console.');
  }
  if (target.role === 'root') {
    const roots = await countRoots(env);
    if (roots <= 1) throw new HttpError(409, 'last_root', 'Impossible de supprimer le dernier compte ROOT.');
  }

  await deleteUser(env, target.id);
  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.user.delete',
    target: target.id,
    details: target.email,
    ip: clientIp(request)
  });
  return json({ ok: true });
}

export async function resetLinkForUser(env, request, id) {
  const session = await requireRoot(env, request);
  const target = await getUserById(env, id);
  if (!target) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  await createPasswordReset(env, target.id, { tokenHash, ttlMs: 24 * 60 * 60 * 1000, ip: clientIp(request) });

  const origin = env.APP_URL ? env.APP_URL.replace(/\/+$/, '') : new URL(request.url).origin;
  const link = `${origin}/reset?token=${encodeURIComponent(token)}`;

  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.user.reset_link',
    target: target.id,
    details: target.email,
    ip: clientIp(request)
  });
  return json({ ok: true, link, expiresInHours: 24, user: publicUser(target) });
}

export async function revokeSessionsByRoot(env, request, id) {
  const session = await requireRoot(env, request);
  const target = await getUserById(env, id);
  if (!target) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
  await revokeAllSessions(env, target.id);
  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.user.revoke_sessions',
    target: target.id,
    details: target.email,
    ip: clientIp(request)
  });
  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/*  Tableaux Kanban (base de données ROOT)                             */
/* ------------------------------------------------------------------ */

export async function userBoard(env, request, id) {
  await requireRoot(env, request);
  const target = await getUserById(env, id);
  if (!target) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
  const board = await getBoard(env, id);
  if (!board) return json({ exists: false, user: publicUser(target) });
  return json({
    exists: true,
    user: publicUser(target),
    revision: board.revision,
    updatedAt: board.updated_at,
    size: board.size_bytes,
    data: safeJson(board.data),
    archive: safeJson(board.archive) || []
  });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function updateUserBoard(env, request, id) {
  const session = await requireRoot(env, request);
  const target = await getUserById(env, id);
  if (!target) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
  const body = await readJson(request, 2_500_000);
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    throw new HttpError(400, 'invalid_payload', 'Données invalides.');
  }
  await writeBoardDirect(env, id, { data: body.data, archive: body.archive || [] }, session.user.email);
  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.board.restore',
    target: id,
    details: `${target.email} : tableau restauré par le ROOT`,
    ip: clientIp(request)
  });
  return json({ ok: true });
}

export async function deleteUserBoard(env, request, id) {
  const session = await requireRoot(env, request);
  const target = await getUserById(env, id);
  if (!target) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
  await deleteBoard(env, id);
  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.board.delete',
    target: id,
    details: target.email,
    ip: clientIp(request)
  });
  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/*  Journal, sauvegarde et restauration                                */
/* ------------------------------------------------------------------ */

export async function auditEntries(env, request) {
  await requireSession(env, request);
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const entries = await listAudit(env, { limit, offset, action: url.searchParams.get('action') || '' });
  return json({ entries, limit, offset });
}

/** Sauvegarde complète (comptes + tableaux) au format JSON. */
export async function backup(env, request) {
  const session = await requireRoot(env, request);
  const rows = await env.DB.prepare('SELECT * FROM boards').all();
  const usersRows = await env.DB.prepare('SELECT * FROM users').all();

  const payload = {
    format: 'vn-kanban-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.email,
    users: (usersRows.results || []).map((row) => {
      const { password_hash, password_kdf, ...safe } = row;
      return { ...safe, hasPassword: !!password_hash, passwordKdf: password_kdf || null };
    }),
    boards: (rows.results || []).map((row) => ({
      user_id: row.user_id,
      revision: row.revision,
      updated_at: row.updated_at,
      data: safeJson(row.data),
      archive: safeJson(row.archive)
    }))
  };

  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.backup.export',
    details: `${payload.users.length} compte(s), ${payload.boards.length} tableau(x)`,
    ip: clientIp(request)
  });

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="vn-kanban-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store'
    }
  });
}

/**
 * Restauration : réinjecte les tableaux, et crée les comptes manquants.
 * Les mots de passe ne sont jamais restaurés depuis une sauvegarde
 * (les empreintes ne sont pas exportées) : les comptes recréés reçoivent un
 * mot de passe temporaire renvoyé dans la réponse.
 */
export async function restore(env, request) {
  const session = await requireRoot(env, request);
  const body = await readJson(request, 5_000_000);
  if (body.format !== 'vn-kanban-backup' || !Array.isArray(body.boards)) {
    throw new HttpError(400, 'invalid_backup', 'Fichier de sauvegarde non reconnu.');
  }

  const created = [];
  let restoredBoards = 0;
  // Les empreintes de mots de passe ne sont pas exportées : les comptes
  // recréés sont donc créés SANS mot de passe. Le ROOT génère ensuite un lien
  // de réinitialisation pour chacun depuis la console.

  for (const entry of body.boards) {
    if (!entry || typeof entry.user_id !== 'string' || !entry.data) continue;

    let user = await getUserById(env, entry.user_id);
    if (!user) {
      const source = (body.users || []).find((u) => u && u.id === entry.user_id);
      const email = source && source.email ? String(source.email).toLowerCase() : null;
      if (!email) continue;
      const existing = await getUserByEmail(env, email);
      if (existing) {
        user = existing;
      } else {
        user = await createUser(env, {
          id: entry.user_id,
          email,
          name: source.name || null,
          role: 'user',
          status: source.status === 'suspended' ? 'suspended' : 'active',
          provider: 'email',
          passwordHash: null,
          mustReset: 1
        });
        created.push({ id: user.id, email: user.email });
      }
    }

    await writeBoardDirect(env, user.id, { data: entry.data, archive: entry.archive || [] }, session.user.email);
    restoredBoards += 1;
  }

  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'admin.backup.restore',
    details: `${restoredBoards} tableau(x), ${created.length} compte(s) créé(s)`,
    ip: clientIp(request)
  });

  return json({
    ok: true,
    restoredBoards,
    createdUsers: created,
    message: created.length
      ? 'Comptes recréés sans mot de passe : générez un lien de réinitialisation pour chacun d’eux.'
      : 'Restauration terminée.'
  });
}
