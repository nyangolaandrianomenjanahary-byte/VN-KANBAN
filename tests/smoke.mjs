#!/usr/bin/env node
/**
 * Tests de bout en bout de l'API VN Kanban.
 *
 * Ils s'exécutent contre le serveur de développement local :
 *     npx wrangler dev --port 8787      (dans un terminal)
 *     npm test                          (dans un autre)
 *
 * Variables : BASE_URL (défaut http://127.0.0.1:8787)
 */

import { resetRateLimits } from './helpers/db.mjs';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const HEADERS = { 'X-VN-Client': 'web' };

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

function section(title) {
  console.log(`\n\u001b[1m${title}\u001b[0m`);
}

/* ------------------------------------------------------------------ */
/*  Client HTTP minimal avec gestion des cookies                       */
/* ------------------------------------------------------------------ */

class Client {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async fetch(path, { method = 'GET', body, headers = {}, redirect = 'manual', raw = false } = {}) {
    const finalHeaders = { ...HEADERS, ...headers };
    if (this.cookies.size) finalHeaders.Cookie = this.cookieHeader();
    if (body !== undefined && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      redirect
    });

    const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === '' || /Max-Age=0/.test(cookie)) this.cookies.delete(key);
      else this.cookies.set(key, value);
    }

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, text, headers: response.headers, location: response.headers.get('Location') };
  }
}

/* ------------------------------------------------------------------ */
/*  Pré-hachage identique au navigateur                                */
/* ------------------------------------------------------------------ */

const SALT = new TextEncoder().encode('vn-kanban-auth-v1|prehash');
let KDF_ITERATIONS = 210000;

function toB64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function prehash(password) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: KDF_ITERATIONS },
    key,
    256
  );
  return toB64url(bits);
}

function randomEmail(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@exemple.test`;
}

/* ------------------------------------------------------------------ */
/*  Scénario                                                           */
/* ------------------------------------------------------------------ */

async function main() {
  // Les tests créent de nombreux comptes : on repart de compteurs vierges.
  resetRateLimits();
  console.log(`\u001b[1mVN Kanban — tests d'intégration\u001b[0m  (${BASE})`);

  const root = new Client('root');

  /* ---------------- 1. Santé et configuration ---------------- */
  section('1. Santé et configuration');
  const health = await root.fetch('/api/health');
  check('GET /api/health répond 200', health.status === 200, `reçu ${health.status}`);
  check('la base D1 est joignable', health.json && health.json.checks && health.json.checks.database === true);

  const config = await root.fetch('/api/config');
  check('GET /api/config répond 200', config.status === 200, `reçu ${config.status}`);
  check('la configuration expose le KDF client', !!(config.json && config.json.auth && config.json.auth.kdf));
  check(
    'le KDF client utilise PBKDF2 v1',
    config.json && config.json.auth.kdf.version === 'v1',
    JSON.stringify(config.json && config.json.auth && config.json.auth.kdf)
  );
  KDF_ITERATIONS = (config.json && config.json.auth.kdf.iterations) || KDF_ITERATIONS;
  const firstUserIsRoot = !!(config.json && config.json.auth.firstUserIsRoot);
  const googleConfigured = !!(config.json && config.json.auth.google);

  /* ---------------- 2. Inscription du ROOT ---------------- */
  section('2. Inscription (e-mail + mot de passe)');
  const rootEmail = randomEmail('root');
  const rootPassword = 'MotDePasseRoot!2026';
  const rootPrehash = await prehash(rootPassword);

  const badRegister = await root.fetch('/api/auth/register', {
    method: 'POST',
    body: { email: 'pas-un-email', password: rootPrehash, kdf: 'v1' }
  });
  check('inscription refusée avec un e-mail invalide', badRegister.status === 400, `reçu ${badRegister.status}`);

  const register = await root.fetch('/api/auth/register', {
    method: 'POST',
    body: { email: rootEmail, name: 'Compte ROOT', password: rootPrehash, kdf: 'v1' }
  });
  check('inscription du premier compte réussie', register.status === 201, `reçu ${register.status} ${register.text.slice(0, 120)}`);
  check('un cookie de session est déposé', root.cookies.has('vn_session'));
  if (firstUserIsRoot) {
    check('le premier compte devient ROOT', register.json && register.json.root === true);
  } else {
    console.log('  (base déjà initialisée : le rôle ROOT n’est pas attendu)');
  }

  const duplicate = await new Client('dup').fetch('/api/auth/register', {
    method: 'POST',
    body: { email: rootEmail, name: 'Doublon', password: rootPrehash, kdf: 'v1' }
  });
  check('inscription refusée pour un e-mail déjà utilisé', duplicate.status === 409, `reçu ${duplicate.status}`);

  /* ---------------- 3. Session ---------------- */
  section('3. Session');
  const me = await root.fetch('/api/auth/me');
  check('GET /api/auth/me renvoie la session', me.status === 200 && me.json.authenticated === true);
  check('l’e-mail de session est correct', me.json && me.json.user && me.json.user.email === rootEmail);
  check('aucun mot de passe n’est exposé', !JSON.stringify(me.json).includes('password'));

  const anonymous = new Client('anon');
  const meAnon = await anonymous.fetch('/api/auth/me');
  check('une requête sans cookie est refusée (401)', meAnon.status === 401, `reçu ${meAnon.status}`);

  /* ---------------- 4. Protection CSRF ---------------- */
  section('4. Protections CSRF / origine');
  const noClientHeader = await root.fetch('/api/auth/logout', { method: 'POST', body: {}, headers: { 'X-VN-Client': '' } });
  check('écriture sans en-tête X-VN-Client refusée (403)', noClientHeader.status === 403, `reçu ${noClientHeader.status}`);

  const badOrigin = await root.fetch('/api/auth/logout', {
    method: 'POST',
    body: {},
    headers: { Origin: 'https://site-malveillant.example' }
  });
  check('écriture depuis une origine tierce refusée (403)', badOrigin.status === 403, `reçu ${badOrigin.status}`);

  /* ---------------- 5. Synchronisation des données ---------------- */
  section('5. Synchronisation du tableau Kanban');
  const emptyBoard = await root.fetch('/api/data');
  check('GET /api/data répond 200', emptyBoard.status === 200);
  check('aucun tableau au départ', emptyBoard.json && emptyBoard.json.exists === false);

  const boardA = {
    version: 8,
    columns: [
      { id: 1, title: 'Hier', color: '#FF9500' },
      { id: 2, title: "Aujourd'hui", color: '#0071E3' }
    ],
    cards: [{ id: 1, title: 'Première tâche', columnId: 2, priority: 'high', totalTimeSpent: 0 }],
    notes: [],
    nextColumnId: 3,
    nextCardId: 2,
    nextNoteId: 1
  };

  const save = await root.fetch('/api/data', { method: 'PUT', body: { revision: 0, data: boardA, archive: [] } });
  check('PUT /api/data enregistre la révision 1', save.status === 200 && save.json.revision === 1, save.text.slice(0, 150));

  const reload = await root.fetch('/api/data');
  check('les données relues sont identiques', reload.json && reload.json.data.cards[0].title === 'Première tâche');
  check('la révision est conservée', reload.json.revision === 1, `révision ${reload.json.revision}`);

  const boardB = { ...boardA, cards: [{ id: 1, title: 'Écrasement', columnId: 2 }] };
  const stale = await root.fetch('/api/data', { method: 'PUT', body: { revision: 0, data: boardB, archive: [] } });
  check('une écriture obsolète est refusée (409 conflit)', stale.status === 409, `reçu ${stale.status}`);
  check('le conflit renvoie la version serveur', stale.json && stale.json.data && stale.json.data.cards[0].title === 'Première tâche');

  const fresh = await root.fetch('/api/data', { method: 'PUT', body: { revision: 1, data: boardB, archive: [{ date: '2026-01-01' }] } });
  check('une écriture avec la bonne révision est acceptée', fresh.status === 200 && fresh.json.revision === 2);

  const isolation = await new Client('isolation').fetch('/api/data');
  check('un visiteur non connecté ne peut pas lire les données', isolation.status === 401, `reçu ${isolation.status}`);

  /* ---------------- 6. Connexion ---------------- */
  section('6. Connexion');
  const wrongPassword = await root.fetch('/api/auth/login', {
    method: 'POST',
    body: { email: rootEmail, password: await prehash('MauvaisMotDePasse!'), kdf: 'v1' }
  });
  check('mot de passe incorrect → 401', wrongPassword.status === 401, `reçu ${wrongPassword.status}`);

  const unknownAccount = await root.fetch('/api/auth/login', {
    method: 'POST',
    body: { email: randomEmail('inconnu'), password: await prehash('PeuImporte!123'), kdf: 'v1' }
  });
  check('compte inexistant → 401 (message générique)', unknownAccount.status === 401, `reçu ${unknownAccount.status}`);
  check(
    'le message ne révèle pas l’existence du compte',
    unknownAccount.json && /incorrect/i.test(unknownAccount.json.message)
  );

  const login = await new Client('root-login').fetch('/api/auth/login', {
    method: 'POST',
    body: { email: rootEmail, password: rootPrehash, kdf: 'v1' }
  });
  check('connexion réussie', login.status === 200, `reçu ${login.status} ${login.text.slice(0, 150)}`);
  const rootSession = new Client('root-session');
  rootSession.cookies = new Map([['vn_session', login.headers.getSetCookie()[0].split('=')[1].split(';')[0]]]);
  const meAgain = await rootSession.fetch('/api/auth/me');
  check('la session issue de la connexion est valide', meAgain.status === 200);

  /* ---------------- 7. Verrouillage anti-force brute ---------------- */
  section('7. Anti-force brute');
  const victim = randomEmail('victime');
  const victimPrehash = await prehash('MotDePasseVictime!1');
  const victimClient = new Client('victime');
  await victimClient.fetch('/api/auth/register', {
    method: 'POST',
    body: { email: victim, name: 'Victime', password: victimPrehash, kdf: 'v1' }
  });
  let locked = false;
  let statuses = [];
  for (let i = 0; i < 12; i += 1) {
    const attempt = await new Client(`brute-${i}`).fetch('/api/auth/login', {
      method: 'POST',
      body: { email: victim, password: await prehash(`Mauvais${i}!`), kdf: 'v1' }
    });
    statuses.push(attempt.status);
    if (attempt.status === 429 || attempt.status === 423) {
      locked = true;
      break;
    }
  }
  check('le compte est verrouillé après plusieurs échecs', locked, `statuts : ${statuses.join(',')}`);

  /* ---------------- 8. Console ROOT ---------------- */
  section('8. Console ROOT');
  const stats = await root.fetch('/api/admin/stats');
  check('GET /api/admin/stats accessible au ROOT', stats.status === 200, `reçu ${stats.status}`);
  check('les statistiques comptent les comptes', stats.json && stats.json.users.total >= 2);

  const userEmail = randomEmail('utilisateur');
  const userPrehash = await prehash('MotDePasseUser!42');
  const created = await root.fetch('/api/admin/users', {
    method: 'POST',
    body: { email: userEmail, name: 'Utilisateur Test', role: 'user', password: userPrehash, mustReset: true }
  });
  check('le ROOT peut créer un compte', created.status === 201, created.text.slice(0, 150));
  const userId = created.json && created.json.user && created.json.user.id;

  const list = await root.fetch(`/api/admin/users?q=${encodeURIComponent(userEmail)}`);
  check('la recherche d’utilisateur fonctionne', list.status === 200 && list.json.users.length === 1);

  const plainPasswordRefused = await root.fetch('/api/admin/users', {
    method: 'POST',
    body: { email: randomEmail('clair'), role: 'user', password: 'MotDePasseEnClair!1' }
  });
  check(
    'le ROOT ne transmet jamais un mot de passe en clair (400 attendu)',
    plainPasswordRefused.status === 400,
    `reçu ${plainPasswordRefused.status}`
  );

  const nonRoot = new Client('non-root');
  const nonRootLogin = await nonRoot.fetch('/api/auth/login', {
    method: 'POST',
    body: { email: userEmail, password: userPrehash, kdf: 'v1' }
  });
  check('le compte créé par le ROOT peut se connecter', nonRootLogin.status === 200, nonRootLogin.text.slice(0, 150));
  check(
    'un mot de passe défini par le ROOT est marqué comme temporaire',
    nonRootLogin.json && nonRootLogin.json.mustReset === true,
    JSON.stringify(nonRootLogin.json)
  );

  const forbidden = await nonRoot.fetch('/api/admin/stats');
  check('un compte simple n’accède pas à l’administration (403)', forbidden.status === 403, `reçu ${forbidden.status}`);

  const selfDemote = await root.fetch(`/api/admin/users/${me.json.user.id}`, { method: 'PATCH', body: { status: 'suspended' } });
  check('le ROOT ne peut pas se suspendre lui-même', selfDemote.status === 409, `reçu ${selfDemote.status}`);

  const promoted = await root.fetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: { role: 'admin' } });
  check('changement de rôle par le ROOT', promoted.status === 200 && promoted.json.user.role === 'admin');

  const adminReads = await nonRoot.fetch('/api/admin/stats');
  check('le rôle « admin » consulte la console', adminReads.status === 200, `reçu ${adminReads.status}`);

  const adminWrites = await nonRoot.fetch(`/api/admin/users/${me.json.user.id}`, { method: 'PATCH', body: { role: 'user' } });
  check('le rôle « admin » ne peut pas modifier un compte (403)', adminWrites.status === 403, `reçu ${adminWrites.status}`);

  const adminBackup = await nonRoot.fetch('/api/admin/backup');
  check('le rôle « admin » n’exporte pas la base (403)', adminBackup.status === 403, `reçu ${adminBackup.status}`);

  /* ---------------- 9. Suspension ---------------- */
  section('9. Suspension de compte');
  await root.fetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: { role: 'user' } });
  const suspended = await root.fetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: { status: 'suspended' } });
  check('suspension enregistrée', suspended.status === 200 && suspended.json.user.status === 'suspended');

  const suspendedLogin = await new Client('suspendu').fetch('/api/auth/login', {
    method: 'POST',
    body: { email: userEmail, password: userPrehash, kdf: 'v1' }
  });
  check('un compte suspendu ne peut plus se connecter', suspendedLogin.status === 403, `reçu ${suspendedLogin.status}`);

  const meSuspended = await nonRoot.fetch('/api/auth/me');
  check('la session existante est révoquée à la suspension', meSuspended.status === 401, `reçu ${meSuspended.status}`);

  await root.fetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: { status: 'active' } });

  /* ---------------- 10. Réinitialisation du mot de passe ---------------- */
  section('10. Réinitialisation du mot de passe');
  const forgot = await new Client('oubli').fetch('/api/auth/forgot', { method: 'POST', body: { email: userEmail } });
  check('la demande de réinitialisation répond 200', forgot.status === 200);
  check(
    'la réponse ne révèle pas si le compte existe',
    forgot.json && /si un compte existe/i.test(forgot.json.message)
  );

  const link = await root.fetch(`/api/admin/users/${userId}/reset-link`, { method: 'POST', body: {} });
  check('le ROOT génère un lien de réinitialisation', link.status === 200 && /\/reset\?token=/.test(link.json.link || ''));
  const token = link.json.link.split('token=')[1];

  const newUserPassword = 'NouveauMotDePasse!2026';
  const reset = await new Client('reset').fetch('/api/auth/reset', {
    method: 'POST',
    body: { token: decodeURIComponent(token), password: await prehash(newUserPassword), kdf: 'v1' }
  });
  check('réinitialisation acceptée', reset.status === 200, reset.text.slice(0, 150));

  const reuseToken = await new Client('reset-rejoue').fetch('/api/auth/reset', {
    method: 'POST',
    body: { token: decodeURIComponent(token), password: await prehash('AutreMotDePasse!1'), kdf: 'v1' }
  });
  check('un jeton de réinitialisation ne peut pas être réutilisé', reuseToken.status === 400, `reçu ${reuseToken.status}`);

  const loginNew = await new Client('user-new').fetch('/api/auth/login', {
    method: 'POST',
    body: { email: userEmail, password: await prehash(newUserPassword), kdf: 'v1' }
  });
  check('connexion avec le nouveau mot de passe', loginNew.status === 200, `reçu ${loginNew.status}`);

  const loginOld = await new Client('user-old').fetch('/api/auth/login', {
    method: 'POST',
    body: { email: userEmail, password: userPrehash, kdf: 'v1' }
  });
  check('l’ancien mot de passe ne fonctionne plus', loginOld.status === 401, `reçu ${loginOld.status}`);

  /* ---------------- 11. Changement de mot de passe ---------------- */
  section('11. Changement de mot de passe');
  const changer = new Client('changer');
  const changerEmail = randomEmail('changer');
  await changer.fetch('/api/auth/register', {
    method: 'POST',
    body: { email: changerEmail, name: 'Changeur', password: await prehash('AncienMotDePasse!1'), kdf: 'v1' }
  });
  const changed = await changer.fetch('/api/auth/password', {
    method: 'POST',
    body: {
      currentPassword: (await prehash('AncienMotDePasse!1')),
      newPassword: (await prehash('NouveauMotDePasse!2'))
    }
  });
  check('changement de mot de passe accepté', changed.status === 200, changed.text.slice(0, 150));

  const wrongCurrent = await changer.fetch('/api/auth/password', {
    method: 'POST',
    body: {
      currentPassword: (await prehash('PasLeBon!123')),
      newPassword: (await prehash('EncoreUnAutre!3'))
    }
  });
  check('changement refusé si le mot de passe actuel est faux', wrongCurrent.status === 401, `reçu ${wrongCurrent.status}`);

  const sessionsRevoked = await root.fetch(`/api/admin/users/${userId}/revoke-sessions`, { method: 'POST', body: {} });
  check('le ROOT peut révoquer toutes les sessions', sessionsRevoked.status === 200);
  const afterRevoke = await new Client('apres-revocation').fetch('/api/auth/me', { headers: { Cookie: '' } });
  check('sans cookie, aucune session', afterRevoke.status === 401);

  /* ---------------- 12. Base de données ROOT ---------------- */
  section('12. Gestion de la base de données par le ROOT');
  const boardOfUser = await root.fetch(`/api/admin/users/${userId}/board`);
  check('le ROOT peut consulter le tableau d’un utilisateur', boardOfUser.status === 200);

  const restore = await root.fetch(`/api/admin/users/${userId}/board`, {
    method: 'PUT',
    body: { data: { ...boardA, cards: [{ id: 9, title: 'Tâche injectée par le ROOT', columnId: 2 }] }, archive: [] }
  });
  check('le ROOT peut restaurer un tableau', restore.status === 200);

  const checkRestore = await root.fetch(`/api/admin/users/${userId}/board`);
  check(
    'la restauration est visible',
    checkRestore.json && checkRestore.json.data.cards[0].title === 'Tâche injectée par le ROOT'
  );

  const backup = await root.fetch('/api/admin/backup');
  check('export de sauvegarde disponible', backup.status === 200);
  const backupJson = JSON.parse(backup.text);
  check('la sauvegarde contient les comptes', Array.isArray(backupJson.users) && backupJson.users.length >= 3);
  check('la sauvegarde ne contient AUCUN mot de passe', !backup.text.includes('password_hash'));
  check('la sauvegarde contient les tableaux', Array.isArray(backupJson.boards) && backupJson.boards.length >= 1);

  const restoreBackup = await root.fetch('/api/admin/restore', { method: 'POST', body: backupJson });
  check('restauration de la sauvegarde acceptée', restoreBackup.status === 200, restoreBackup.text.slice(0, 200));

  const badRestore = await root.fetch('/api/admin/restore', { method: 'POST', body: { nope: true } });
  check('fichier de sauvegarde invalide refusé (400)', badRestore.status === 400, `reçu ${badRestore.status}`);

  const audit = await root.fetch('/api/admin/audit?limit=200');
  check('le journal d’audit est consultable', audit.status === 200 && audit.json.entries.length > 0);
  const actions = new Set((audit.json.entries || []).map((e) => e.action));
  check('les connexions sont journalisées', actions.has('auth.login'));
  check('les actions d’administration sont journalisées', actions.has('admin.user.create'));

  /* ---------------- 13. Suppression ---------------- */
  section('13. Suppression');
  const tempEmail = randomEmail('jetable');
  const tempUser = await root.fetch('/api/admin/users', { method: 'POST', body: { email: tempEmail, role: 'user' } });
  const tempId = tempUser.json.user.id;
  const deleted = await root.fetch(`/api/admin/users/${tempId}`, { method: 'DELETE' });
  check('suppression d’un compte', deleted.status === 200);
  const deletedAgain = await root.fetch(`/api/admin/users/${tempId}`, { method: 'DELETE' });
  check('compte déjà supprimé → 404', deletedAgain.status === 404, `reçu ${deletedAgain.status}`);

  /* ---------------- 14. Déconnexion ---------------- */
  section('14. Déconnexion');
  const logout = await rootSession.fetch('/api/auth/logout', { method: 'POST', body: {} });
  check('déconnexion acceptée', logout.status === 200);
  const afterLogout = await rootSession.fetch('/api/auth/me');
  check('la session est invalidée après déconnexion', afterLogout.status === 401, `reçu ${afterLogout.status}`);

  /* ---------------- 15. Google OAuth ---------------- */
  section('15. Google OAuth');
  const googleStart = await new Client('google').fetch('/api/auth/google/start?next=/', { redirect: 'manual' });
  if (googleConfigured) {
    check('redirection vers Google', googleStart.status === 302 && /accounts\.google\.com/.test(googleStart.location || ''));
    check(
      'PKCE + protection d’état présents',
      /code_challenge=/.test(googleStart.location || '') && /state=/.test(googleStart.location || '')
    );
  } else {
    check(
      'sans identifiants configurés : renvoi vers la connexion avec explication',
      googleStart.status === 302 && /\/login\?error=google_not_configured/.test(googleStart.location || ''),
      googleStart.location
    );
  }

  if (googleConfigured) {
    const badCallback = await new Client('google-cb').fetch('/api/auth/google/callback?code=x&state=y');
    check(
      'callback sans cookie d’état refusé (anti-CSRF)',
      badCallback.status === 302 && /error=oauth_state/.test(badCallback.location || ''),
      badCallback.location
    );
  }

  /* ---------------- 16. Amorçage du compte ROOT ---------------- */
  section('16. Amorçage du compte ROOT (CLI / installation)');
  const setupStatus = await root.fetch('/api/setup/status');
  check('GET /api/setup/status répond', setupStatus.status === 200 && typeof setupStatus.json.userCount === 'number');

  const bootstrapToken = process.env.ROOT_BOOTSTRAP_TOKEN || '';
  if (setupStatus.json.bootstrapEnabled) {
    const noToken = await new Client('setup-sans-jeton').fetch('/api/setup/root', {
      method: 'POST',
      body: { email: randomEmail('root-cli'), password: await prehash('RootParCli!2026') }
    });
    check('sans jeton d’amorçage : refus (403)', noToken.status === 403, `reçu ${noToken.status}`);

    const badToken = await new Client('setup-mauvais-jeton').fetch('/api/setup/root', {
      method: 'POST',
      headers: { 'X-Setup-Token': 'jeton-faux' },
      body: { email: randomEmail('root-cli'), password: await prehash('RootParCli!2026') }
    });
    check('jeton d’amorçage invalide : refus (403)', badToken.status === 403, `reçu ${badToken.status}`);

    if (bootstrapToken) {
      const rootEmailCli = randomEmail('root-cli');
      const rootPasswordCli = 'RootParCli!2026';
      const created = await new Client('setup-root').fetch('/api/setup/root', {
        method: 'POST',
        headers: { 'X-Setup-Token': bootstrapToken },
        body: { email: rootEmailCli, name: 'ROOT CLI', password: await prehash(rootPasswordCli) }
      });
      check('création du compte ROOT par jeton', created.status === 201 && created.json.root === true, created.text.slice(0, 150));

      const loginCli = await new Client('root-cli-login').fetch('/api/auth/login', {
        method: 'POST',
        body: { email: rootEmailCli, password: await prehash(rootPasswordCli), kdf: 'v1' }
      });
      check('le compte ROOT créé peut se connecter', loginCli.status === 200, `reçu ${loginCli.status}`);
    } else {
      console.log('  (jeton d’amorçage non fourni : création ROOT par jeton non testée)');
    }
  } else {
    console.log('  (amorçage désactivé sur ce serveur : tests dédiés ignorés)');
  }

  /* ---------------- Bilan ---------------- */
  console.log(`\n\u001b[1mRésultat\u001b[0m : ${passed} réussite(s), ${failed} échec(s)`);
  if (failed) {
    console.log('\u001b[31mÉchecs :\u001b[0m');
    for (const name of failures) console.log(`  • ${name}`);
    process.exit(1);
  }
  console.log('\u001b[32mTous les tests sont passés.\u001b[0m');
}

main().catch((error) => {
  console.error('\n\u001b[31mErreur inattendue pendant les tests :\u001b[0m', error);
  process.exit(1);
});
