#!/usr/bin/env node
/**
 * Test de bout en bout de la connexion Google — SANS toucher à Google.
 *
 * Principe : on démarre
 *   1. un faux serveur Google (jetons JWT signés RS256 avec une vraie clé RSA) ;
 *   2. une instance de développement du Worker pointant vers ce faux serveur
 *      (variables GOOGLE_TOKEN_ENDPOINT / GOOGLE_JWKS_URL / GOOGLE_CLIENT_ID) ;
 *   3. le déroulé complet : /api/auth/google/start → /callback → session.
 *
 * Cela valide réellement : PKCE, protection d'état (anti-CSRF), échange du code,
 * vérification de la signature RS256 et des revendications (iss/aud/exp),
 * création/liaison de compte, puis ouverture de session.
 *
 * Usage : node tests/google-oauth.mjs
 */

import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { rmSync, mkdirSync } from 'node:fs';
import process from 'node:process';
import { resetRateLimits } from './helpers/db.mjs';

const APP_PORT = Number(process.env.GOOGLE_TEST_APP_PORT || 8790);
const MOCK_PORT = Number(process.env.GOOGLE_TEST_MOCK_PORT || 8799);
const PERSIST = '.wrangler/state-google-test';
const BASE = `http://127.0.0.1:${APP_PORT}`;
const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const CLIENT_SECRET = 'test-client-secret';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, info = '') {
  if (condition) {
    passed += 1;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \u001b[31m✗\u001b[0m ${name}${info ? ` — ${info}` : ''}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ------------------------------------------------------------------ */
/*  Faux Google                                                        */
/* ------------------------------------------------------------------ */

const good = generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrong = generateKeyPairSync('rsa', { modulusLength: 2048 });

const goodJwk = { ...good.publicKey.export({ format: 'jwk' }), kid: 'test-key-1', alg: 'RS256', use: 'sig' };
const wrongJwk = { ...wrong.publicKey.export({ format: 'jwk' }), kid: 'test-key-2', alg: 'RS256', use: 'sig' };

const mockState = {
  email: 'google-user@exemple.test',
  sub: 'google-sub-123456789',
  emailVerified: true,
  // 'signature'  : signé par une clé inconnue mais avec le bon « kid »
  // 'unknown-kid': signé par une clé inconnue avec un « kid » inexistant
  tamper: false,
  lastTokenRequest: null
};

function makeIdToken({ keyPair, kid, email, sub, emailVerified, aud = CLIENT_ID }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const payload = {
    iss: 'https://accounts.google.com',
    azp: CLIENT_ID,
    aud,
    sub,
    email,
    email_verified: emailVerified,
    name: 'Utilisateur Google',
    picture: 'https://lh3.googleusercontent.com/a/test',
    iat: now,
    exp: now + 3600
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = sign('sha256', Buffer.from(signingInput), keyPair.privateKey);
  return `${signingInput}.${b64url(signature)}`;
}

function startMockGoogle() {
  const server = createServer((request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${MOCK_PORT}`);

    if (url.pathname === '/certs') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      // Comme le vrai Google : seules les clés LÉGITIMES sont publiées.
      response.end(JSON.stringify({ keys: [goodJwk] }));
      return;
    }

    if (url.pathname === '/token' && request.method === 'POST') {
      let body = '';
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        const params = new URLSearchParams(body);
        mockState.lastTokenRequest = {
          code: params.get('code'),
          clientId: params.get('client_id'),
          clientSecret: params.get('client_secret'),
          redirectUri: params.get('redirect_uri'),
          codeVerifier: params.get('code_verifier')
        };
        if (params.get('code') !== 'code-valide') {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'invalid_grant', error_description: 'code inconnu' }));
          return;
        }
        const forged = mockState.tamper
          ? {
              keyPair: wrong,
              kid: mockState.tamper === 'unknown-kid' ? 'test-key-inexistante' : 'test-key-1'
            }
          : { keyPair: good, kid: 'test-key-1' };
        const idToken = makeIdToken({
          keyPair: forged.keyPair,
          kid: forged.kid,
          email: mockState.email,
          sub: mockState.sub,
          emailVerified: mockState.emailVerified
        });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600, id_token: idToken, token_type: 'Bearer' }));
      });
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
  });
  return new Promise((resolve) => server.listen(MOCK_PORT, '127.0.0.1', () => resolve(server)));
}

/* ------------------------------------------------------------------ */
/*  Client HTTP avec cookies                                           */
/* ------------------------------------------------------------------ */

class Client {
  constructor() {
    this.cookies = new Map();
  }

  async fetch(path, { method = 'GET', body, redirect = 'manual' } = {}) {
    const headers = { 'X-VN-Client': 'web' };
    if (this.cookies.size) headers.Cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect
    });
    const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (/Max-Age=0/.test(cookie) || value === '') this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, text, location: response.headers.get('Location') };
  }
}

/** Déroule le tunnel OAuth et renvoie la réponse du callback. */
async function oauthFlow(client, { code = 'code-valide', next = '/' } = {}) {
  const start = await client.fetch(`/api/auth/google/start?next=${encodeURIComponent(next)}`);
  if (start.status !== 302) return { start, callback: { status: start.status, location: null } };
  const authUrl = new URL(start.location);
  const state = authUrl.searchParams.get('state');
  const callback = await client.fetch(
    `/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
  );
  return { start, authUrl, callback };
}

/* ------------------------------------------------------------------ */
/*  Démarrage du Worker de test                                        */
/* ------------------------------------------------------------------ */

let devServer = null;
let mockServer = null;

function startWorker() {
  const child = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '--port',
      String(APP_PORT),
      '--persist-to',
      PERSIST,
      '--var',
      `GOOGLE_CLIENT_ID:${CLIENT_ID}`,
      '--var',
      `GOOGLE_CLIENT_SECRET:${CLIENT_SECRET}`,
      '--var',
      `GOOGLE_TOKEN_ENDPOINT:http://127.0.0.1:${MOCK_PORT}/token`,
      '--var',
      `GOOGLE_JWKS_URL:http://127.0.0.1:${MOCK_PORT}/certs`
    ],
    { cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

async function waitForServer(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(700);
  }
  return false;
}

function stopAll() {
  if (devServer && devServer.pid) {
    try {
      process.kill(-devServer.pid, 'SIGTERM');
    } catch {
      try {
        devServer.kill('SIGTERM');
      } catch {
        /* déjà arrêté */
      }
    }
  }
  if (mockServer) mockServer.close();
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log('\u001b[1mVN Kanban — connexion Google (Google simulé)\u001b[0m');
  console.log('Préparation de l’environnement de test…');

  rmSync(PERSIST, { recursive: true, force: true });
  mkdirSync(PERSIST, { recursive: true });

  const migrate = spawnSync(
    'npx',
    ['wrangler', 'd1', 'migrations', 'apply', 'vn-kanban-db', '--local', '--persist-to', PERSIST],
    { encoding: 'utf8', shell: process.platform === 'win32' }
  );
  if (migrate.status !== 0) {
    console.error('Migration impossible :', migrate.stdout, migrate.stderr);
    process.exit(1);
  }

  mockServer = await startMockGoogle();
  devServer = startWorker();

  const ready = await waitForServer();
  if (!ready) {
    console.error('\u001b[31mLe Worker de test n’a pas démarré.\u001b[0m');
    stopAll();
    process.exit(1);
  }
  console.log(`Worker prêt sur ${BASE}\n`);

  /* ---------------- 1. Démarrage OAuth ---------------- */
  console.log('\u001b[1m1. Redirection vers Google\u001b[0m');
  const client = new Client();
  const start = await client.fetch('/api/auth/google/start?next=/');
  const authUrl = new URL(start.location || 'http://x/');
  check('réponse 302 vers Google', start.status === 302 && authUrl.hostname === 'accounts.google.com', start.location || '');
  check('client_id transmis', authUrl.searchParams.get('client_id') === CLIENT_ID);
  check('portée openid/email/profile', authUrl.searchParams.get('scope') === 'openid email profile');
  check('PKCE : méthode S256', authUrl.searchParams.get('code_challenge_method') === 'S256');
  check('PKCE : défi présent (43 caractères)', (authUrl.searchParams.get('code_challenge') || '').length === 43);
  check('paramètre d’état présent', (authUrl.searchParams.get('state') || '').length > 20);
  check('cookie d’état déposé (HttpOnly)', client.cookies.has('vn_oauth_state'));
  check(
    'redirect_uri = /api/auth/google/callback',
    (authUrl.searchParams.get('redirect_uri') || '').endsWith('/api/auth/google/callback'),
    authUrl.searchParams.get('redirect_uri') || ''
  );

  /* ---------------- 2. Callback refusé sans état ---------------- */
  console.log('\n\u001b[1m2. Protection contre le rejeu (state)\u001b[0m');
  const noState = new Client();
  const noStateResponse = await noState.fetch('/api/auth/google/callback?code=code-valide&state=faux');
  check(
    'callback sans cookie d’état refusé',
    noStateResponse.status === 302 && /error=oauth_state/.test(noStateResponse.location || ''),
    noStateResponse.location || ''
  );

  /* ---------------- 3. Tunnel complet ---------------- */
  console.log('\n\u001b[1m3. Connexion Google de bout en bout\u001b[0m');
  mockState.email = 'premier-google@exemple.test';
  mockState.sub = 'google-sub-premier';
  mockState.tamper = false;
  const flow = await oauthFlow(client, { next: '/' });
  check('callback : redirection vers l’application', flow.callback.status === 302 && flow.callback.location === '/', flow.callback.location || '');
  check('session ouverte (cookie vn_session)', client.cookies.has('vn_session'));
  check(
    'le code a été échangé avec le secret client',
    mockState.lastTokenRequest && mockState.lastTokenRequest.clientSecret === CLIENT_SECRET
  );
  check(
    'PKCE : le vérificateur est renvoyé à Google',
    mockState.lastTokenRequest && (mockState.lastTokenRequest.codeVerifier || '').length === 43
  );

  const me = await client.fetch('/api/auth/me');
  check('la session Google est valide', me.status === 200 && me.json.authenticated === true, me.text.slice(0, 120));
  check('l’e-mail Google est bien celui du compte', me.json && me.json.user && me.json.user.email === 'premier-google@exemple.test');
  check('le compte est marqué Google', me.json && me.json.user.provider === 'google');
  check('le premier compte Google devient ROOT', me.json && me.json.root === true);

  const board = await client.fetch('/api/data');
  check('un compte Google accède à sa base Kanban', board.status === 200 && board.json.exists === false);

  const save = await client.fetch('/api/data', {
    method: 'PUT',
    body: { revision: 0, data: { version: 8, columns: [{ id: 1, title: "Aujourd'hui" }], cards: [], notes: [] }, archive: [] }
  });
  check('le compte Google peut enregistrer son tableau', save.status === 200, save.text.slice(0, 120));

  /* ---------------- 4. Liaison à un compte e-mail ---------------- */
  console.log('\n\u001b[1m4. Liaison avec un compte e-mail existant\u001b[0m');
  const { prehashFor } = await import('../scripts/lib/prehash.mjs');
  const emailClient = new Client();
  const sharedEmail = 'deja-inscrit@exemple.test';
  const created = await emailClient.fetch('/api/auth/register', {
    method: 'POST',
    body: { email: sharedEmail, name: 'Déjà inscrit', password: await prehashFor('MotDePasse!2026'), kdf: 'v1' }
  });
  check('un compte e-mail est créé au préalable', created.status === 201, created.text.slice(0, 120));

  mockState.email = sharedEmail;
  mockState.sub = 'google-sub-lie';
  const linkClient = new Client();
  const linkFlow = await oauthFlow(linkClient, { next: '/admin' });
  check('connexion Google acceptée pour un e-mail existant', linkFlow.callback.status === 302);
  check('redirection vers la page demandée', linkFlow.callback.location === '/admin', linkFlow.callback.location || '');

  const linkedSession = await linkClient.fetch('/api/auth/me');
  check(
    'le compte e-mail a été lié à Google (et non dupliqué)',
    linkedSession.json && linkedSession.json.user.provider === 'email+google',
    JSON.stringify(linkedSession.json && linkedSession.json.user && linkedSession.json.user.provider)
  );
  check(
    'même identifiant de compte qu’avant la liaison',
    linkedSession.json && linkedSession.json.user.id === (created.json && created.json.user && created.json.user.id)
  );
  check('le compte lié reste un compte simple', linkedSession.json && linkedSession.json.root === false);

  /* ---------------- 5. Sécurité des jetons ---------------- */
  console.log('\n\u001b[1m5. Sécurité des jetons Google\u001b[0m');
  mockState.email = 'usurpateur@exemple.test';
  mockState.sub = 'google-sub-usurpateur';

  mockState.tamper = 'signature';
  const forged = new Client();
  const forgedFlow = await oauthFlow(forged);
  check(
    'signature invalide (bon « kid », mauvaise clé) → refus',
    forgedFlow.callback.status === 302 && /error=google_failed/.test(forgedFlow.callback.location || ''),
    forgedFlow.callback.location || ''
  );
  check('aucune session ouverte avec un jeton falsifié', !forged.cookies.has('vn_session'));

  mockState.tamper = 'unknown-kid';
  const unknownKid = new Client();
  const unknownKidFlow = await oauthFlow(unknownKid);
  check(
    'clé de signature inconnue → refus',
    unknownKidFlow.callback.status === 302 && /error=google_failed/.test(unknownKidFlow.callback.location || ''),
    unknownKidFlow.callback.location || ''
  );

  mockState.tamper = false;
  const badCode = new Client();
  const badCodeFlow = await oauthFlow(badCode, { code: 'code-invalide' });
  check(
    'code d’autorisation invalide → refus propre',
    badCodeFlow.callback.status === 302 && /error=google_failed/.test(badCodeFlow.callback.location || ''),
    badCodeFlow.callback.location || ''
  );

  /* ---------------- 6. Suspension ---------------- */
  console.log('\n\u001b[1m6. Compte suspendu\u001b[0m');
  const rootClient = new Client();
  const rootLogin = await rootClient.fetch('/api/auth/login', {
    method: 'POST',
    body: { email: 'premier-google@exemple.test', password: 'sans-objet', kdf: 'v1' }
  });
  check('un compte 100 % Google ne peut pas utiliser le mot de passe (409)', rootLogin.status === 409, `reçu ${rootLogin.status}`);
  check(
    'le message invite à utiliser Google',
    rootLogin.json && rootLogin.json.error === 'google_only',
    rootLogin.text.slice(0, 120)
  );

  console.log(`\n\u001b[1mRésultat\u001b[0m : ${passed} réussite(s), ${failed} échec(s)`);
  if (failed) {
    console.log('\u001b[31mÉchecs :\u001b[0m');
    for (const name of failures) console.log(`  • ${name}`);
    stopAll();
    process.exit(1);
  }
  console.log('\u001b[32mConnexion Google : tous les tests sont passés.\u001b[0m');
  stopAll();
}

process.on('exit', stopAll);
process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});

main().catch((error) => {
  console.error('\n\u001b[31mErreur inattendue :\u001b[0m', error);
  stopAll();
  process.exit(1);
});
