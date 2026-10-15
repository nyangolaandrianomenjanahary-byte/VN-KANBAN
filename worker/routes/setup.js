/**
 * Amorçage du compte ROOT.
 *
 *   GET  /api/setup/status   → état public de l'installation
 *   POST /api/setup/root     → crée (ou promeut) le compte ROOT
 *
 * La création exige un secret défini côté serveur :
 *     npx wrangler secret put ROOT_BOOTSTRAP_TOKEN
 * Sans ce secret, la route est fermée : impossible de se créer un compte ROOT
 * sur une installation en production.
 */

import { HttpError, clientIp, json, readJson, validateClientPassword, validateEmail, validateName } from '../lib/utils.js';
import { CLIENT_KDF_VERSION, hashPassword, timingSafeEqual } from '../lib/crypto.js';
import {
  audit,
  countRoots,
  countUsers,
  createUser,
  getUserByEmail,
  getUserById,
  publicUser,
  rateLimit,
  updateUser
} from '../lib/db.js';
import { isRoot, revokeAllSessions } from '../lib/session.js';

const ITERATIONS = (env) => Number(env.PBKDF2_ITERATIONS) || 25_000;
const PEPPER = (env) => env.PASSWORD_PEPPER || '';
const FIRST_USER_IS_ROOT = (env) => (env.FIRST_USER_IS_ROOT || 'true') !== 'false';

async function rootStats(env) {
  const total = await countUsers(env);
  const roots = total ? await countRoots(env) : 0;
  return { total, roots };
}

export async function setupStatus(env) {
  const { total, roots } = await rootStats(env);
  return json({
    installed: total > 0,
    userCount: total,
    rootCount: roots,
    hasRoot: roots > 0,
    // Le jeton d'amorçage n'est jamais renvoyé : on indique seulement s'il est posé.
    bootstrapEnabled: !!env.ROOT_BOOTSTRAP_TOKEN,
    firstUserIsRoot: FIRST_USER_IS_ROOT(env) && total === 0,
    googleConfigured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    pepperConfigured: !!env.PASSWORD_PEPPER,
    appName: env.APP_NAME || 'VN Kanban'
  });
}

function requireBootstrapToken(env, request) {
  const expected = env.ROOT_BOOTSTRAP_TOKEN;
  if (!expected) {
    throw new HttpError(
      403,
      'bootstrap_disabled',
      'Amorçage désactivé : définissez un secret ROOT_BOOTSTRAP_TOKEN (npx wrangler secret put ROOT_BOOTSTRAP_TOKEN) puis réessayez.'
    );
  }
  const provided = request.headers.get('X-Setup-Token') || '';
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw new HttpError(403, 'invalid_token', 'Jeton d’amorçage invalide.');
  }
}

export async function createRoot(env, request) {
  requireBootstrapToken(env, request);

  const ip = clientIp(request);
  const limit = await rateLimit(env, `setup:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 });
  if (!limit.allowed) throw new HttpError(429, 'too_many_requests', 'Trop de tentatives d’amorçage.');

  const body = await readJson(request);
  const email = validateEmail(body.email);
  const name = validateName(body.name);
  const password = body.password ? validateClientPassword(body.password) : null;

  if (!password && !body.promoteOnly) {
    throw new HttpError(400, 'missing_password', 'Le mot de passe (pré-haché) est obligatoire.');
  }

  const existing = await getUserByEmail(env, email);
  let user;

  if (existing) {
    // Promotion d'un compte existant
    user = await updateUser(env, existing.id, {
      role: 'root',
      status: 'active',
      ...(password
        ? {
            password_hash: await hashPassword(password, { iterations: ITERATIONS(env), pepper: PEPPER(env) }),
            password_kdf: CLIENT_KDF_VERSION,
            password_at: Date.now(),
            must_reset: 0,
            failed_attempts: 0,
            locked_until: null
          }
        : {}),
      ...(name ? { name } : {})
    });
    await audit(env, {
      actorEmail: email,
      action: 'setup.root.promoted',
      target: user.id,
      details: password ? 'Compte promu ROOT (mot de passe défini)' : 'Compte promu ROOT',
      ip
    });
  } else {
    user = await createUser(env, {
      email,
      name,
      role: 'root',
      status: 'active',
      provider: 'email',
      emailVerified: false,
      passwordHash: password ? await hashPassword(password, { iterations: ITERATIONS(env), pepper: PEPPER(env) }) : null,
      passwordKdf: password ? CLIENT_KDF_VERSION : null
    });
    await audit(env, { actorEmail: email, action: 'setup.root.created', target: user.id, details: email, ip });
  }

  if (password) await revokeAllSessions(env, user.id);

  const fresh = await getUserById(env, user.id);
  return json(
    {
      ok: true,
      user: publicUser(fresh),
      root: isRoot(fresh),
      message: 'Compte ROOT prêt. Connectez-vous depuis la page de connexion.'
    },
    201
  );
}
