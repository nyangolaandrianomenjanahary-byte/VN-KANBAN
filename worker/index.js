/**
 * VN Kanban — Worker Cloudflare (API + authentification).
 *
 * Rôle du Worker :
 *   • servir /api/* (authentification, synchronisation, console ROOT)
 *   • laisser Cloudflare servir les fichiers statiques (index.html, login.html…)
 *     → ces requêtes ne consomment aucun temps CPU du Worker
 *
 * Le Worker ne sert jamais les fichiers statiques lui-même : la configuration
 * `assets.run_worker_first = ["/api/*"]` de wrangler.jsonc s'en charge.
 */

import {
  HttpError,
  clientIp,
  fail,
  json,
  nowMs
} from './lib/utils.js';
import { pruneExpired } from './lib/db.js';
import * as auth from './routes/auth.js';
import * as data from './routes/data.js';
import * as admin from './routes/admin.js';
import * as setup from './routes/setup.js';

/* ------------------------------------------------------------------ */
/*  Table de routage                                                   */
/* ------------------------------------------------------------------ */

const routes = [
  ['GET', '/api/health', health],

  // Configuration publique (utilisée par la page de connexion)
  ['GET', '/api/config', (env) => auth.getConfig(env)],

  // Authentification
  ['POST', '/api/auth/register', (env, request) => auth.register(env, request)],
  ['POST', '/api/auth/login', (env, request) => auth.login(env, request)],
  ['POST', '/api/auth/logout', (env, request) => auth.logout(env, request)],
  ['GET', '/api/auth/me', (env, request) => auth.me(env, request)],
  ['POST', '/api/auth/password', (env, request) => auth.changePassword(env, request)],
  ['POST', '/api/auth/forgot', (env, request) => auth.forgotPassword(env, request)],
  ['POST', '/api/auth/reset', (env, request) => auth.resetPassword(env, request)],
  ['GET', '/api/auth/google/start', (env, request) => auth.googleStart(env, request)],
  ['GET', '/api/auth/google/callback', (env, request) => auth.googleCallback(env, request)],

  // Amorçage de l'installation (protégé par un secret serveur)
  ['GET', '/api/setup/status', (env) => setup.setupStatus(env)],
  ['POST', '/api/setup/root', (env, request) => setup.createRoot(env, request)],

  // Données Kanban
  ['GET', '/api/data', (env, request) => data.getData(env, request)],
  ['PUT', '/api/data', (env, request) => data.putData(env, request)],
  ['DELETE', '/api/data', (env, request) => data.deleteData(env, request)],

  // Console ROOT
  ['GET', '/api/admin/stats', (env, request) => admin.stats(env, request)],
  ['GET', '/api/admin/users', (env, request) => admin.users(env, request)],
  ['POST', '/api/admin/users', (env, request) => admin.createUserByRoot(env, request)],
  ['PATCH', '/api/admin/users/:id', (env, request, params) => admin.updateUserByRoot(env, request, params.id)],
  ['DELETE', '/api/admin/users/:id', (env, request, params) => admin.deleteUserByRoot(env, request, params.id)],
  ['POST', '/api/admin/users/:id/reset-link', (env, request, params) => admin.resetLinkForUser(env, request, params.id)],
  ['POST', '/api/admin/users/:id/revoke-sessions', (env, request, params) => admin.revokeSessionsByRoot(env, request, params.id)],
  ['GET', '/api/admin/users/:id/board', (env, request, params) => admin.userBoard(env, request, params.id)],
  ['PUT', '/api/admin/users/:id/board', (env, request, params) => admin.updateUserBoard(env, request, params.id)],
  ['DELETE', '/api/admin/users/:id/board', (env, request, params) => admin.deleteUserBoard(env, request, params.id)],
  ['GET', '/api/admin/audit', (env, request) => admin.auditEntries(env, request)],
  ['GET', '/api/admin/backup', (env, request) => admin.backup(env, request)],
  ['POST', '/api/admin/restore', (env, request) => admin.restore(env, request)]
];

function matchRoute(method, pathname) {
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    if (pattern === pathname) return { handler, params: {} };
    if (!pattern.includes(':')) continue;

    const patternParts = pattern.split('/');
    const pathParts = pathname.split('/');
    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let ok = true;
    for (let i = 0; i < patternParts.length; i += 1) {
      const expected = patternParts[i];
      const actual = pathParts[i];
      if (expected.startsWith(':')) {
        if (!actual) {
          ok = false;
          break;
        }
        params[expected.slice(1)] = decodeURIComponent(actual);
      } else if (expected !== actual) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler, params };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Sécurité des requêtes                                              */
/* ------------------------------------------------------------------ */

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Double protection CSRF :
 *  1. l'en-tête Origin doit correspondre au site lui-même ;
 *  2. un en-tête personnalisé X-VN-Client est exigé sur les écritures
 *     (impossible à poser depuis un site tiers sans déclencher un préflight
 *     CORS que nous n'autorisons pas).
 */
function guardOrigin(request, env) {
  const method = request.method.toUpperCase();
  if (!MUTATING.has(method)) return;

  // Origines et hôtes considérés comme « nous-mêmes ».
  const selfOrigins = new Set();
  const selfHosts = new Set();
  const addOrigin = (value) => {
    if (!value) return;
    try {
      const url = new URL(value);
      selfOrigins.add(url.origin);
      selfHosts.add(url.host);
    } catch {
      /* valeur invalide : ignorée */
    }
  };

  addOrigin(request.url);
  if (request.headers.get('Host')) addOrigin(`https://${request.headers.get('Host')}`);
  if (env.APP_URL) addOrigin(String(env.APP_URL));

  // Relais inverse (proxy du serveur de développement, hébergement intermédiaire) :
  // ces en-têtes sont posés par le relais, pas par le navigateur. Un site tiers ne
  // peut ni les poser sur une requête de formulaire, ni faire correspondre
  // l'en-tête Origin, qui reste, lui, toujours maîtrisé par le navigateur.
  const forwardedHost = request.headers.get('X-Forwarded-Host');
  const forwardedProto = request.headers.get('X-Forwarded-Proto') || 'https';
  if (forwardedHost) {
    addOrigin(`${forwardedProto.split(',')[0].trim()}://${forwardedHost.split(',')[0].trim()}`);
  }

  const origin = request.headers.get('Origin');
  if (origin) {
    let originHost = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new HttpError(403, 'bad_origin', 'Origine illisible.');
    }
    // On compare d'abord l'origine complète (le cas normal), puis l'hôte seul :
    // certains hébergeurs (et le serveur de développement) placent un proxy
    // devant le Worker, auquel cas le protocole vu par le Worker peut différer
    // du protocole réel. L'hôte, lui, reste fiable : le navigateur ne laisse
    // jamais une page tierce envoyer cet en-tête pour notre domaine.
    if (!selfOrigins.has(origin.replace(/\/+$/, '')) && !selfHosts.has(originHost)) {
      throw new HttpError(403, 'bad_origin', 'Origine non autorisée.');
    }
  }

  const client = request.headers.get('X-VN-Client');
  if (client !== 'web' && client !== 'cli') {
    throw new HttpError(
      403,
      'csrf',
      'Requête refusée : en-tête X-VN-Client manquant (protection CSRF).'
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Point d'entrée                                                     */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // Préflight CORS : on n'ouvre AUCUNE origine tierce.
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Cache-Control': 'no-store'
        }
      });
    }

    // Hors /api/* : le Worker n'est normalement pas appelé (assets statiques),
    // mais on assure un repli propre si une route inconnue arrive ici.
    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return fail(404, 'not_found', 'Ressource introuvable.');
    }

    const started = nowMs();
    try {
      const route = matchRoute(method, url.pathname);
      if (!route) {
        return fail(404, 'not_found', `Route inconnue : ${method} ${url.pathname}`);
      }

      guardOrigin(request, env);
      const response = await route.handler(env, request, route.params);
      return withTiming(response, started);
    } catch (error) {
      if (error instanceof HttpError) {
        return withTiming(fail(error.status, error.code, error.message, error.details), started);
      }
      // Le détail est écrit dans les journaux (wrangler tail) mais jamais renvoyé
      // au navigateur : un message d'erreur interne peut révéler des informations
      // sur la base de données.
      console.error('Erreur API', method, url.pathname, error && error.stack ? error.stack : error);
      return withTiming(fail(500, 'server_error', 'Erreur interne. Réessayez dans un instant.'), started);
    } finally {
      // Nettoyage de fond (sessions expirées, jetons usagés…) : n'allonge pas
      // la réponse grâce à ctx.waitUntil.
      if (ctx && typeof ctx.waitUntil === 'function' && Math.random() < 0.1) {
        ctx.waitUntil(pruneExpired(env));
      }
    }
  }
};

function withTiming(response, started) {
  const headers = new Headers(response.headers);
  headers.set('X-Response-Time', `${nowMs() - started}ms`);
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function health(env, request) {
  const checks = { worker: true, database: false, google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) };
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
    checks.database = true;
  } catch (error) {
    checks.databaseError = error && error.message ? String(error.message).slice(0, 200) : 'inconnue';
  }
  return json(
    {
      ok: checks.database,
      app: env.APP_NAME || 'VN Kanban',
      time: new Date().toISOString(),
      checks,
      clientIp: clientIp(request),
      pbkdf2Iterations: Number(env.PBKDF2_ITERATIONS) || 25_000
    },
    checks.database ? 200 : 503
  );
}
