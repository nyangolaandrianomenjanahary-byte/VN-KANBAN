#!/usr/bin/env node
/**
 * Tests de public/js/vn-auth.js — la VRAIE bibliothèque utilisée par le
 * navigateur — exécutée dans Node avec un minimum de shims.
 *
 * Objectif : vérifier que le pré-hachage produit dans le navigateur est bien
 * accepté par le serveur, et que toute la chaîne d'authentification fonctionne
 * avec le code réellement livré (et non une réécriture de test).
 *
 * Prérequis : npx wrangler dev --port 8787
 */

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');

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

/* ------------------------------------------------------------------ */
/*  Environnement navigateur simulé (le strict nécessaire)             */
/* ------------------------------------------------------------------ */

let cookieJar = '';
const realFetch = globalThis.fetch;

globalThis.fetch = async (input, options = {}) => {
  const url = typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : input;
  const headers = new Headers(options.headers || {});
  if (cookieJar) headers.set('Cookie', cookieJar);
  const response = await realFetch(url, { ...options, headers, redirect: 'manual' });
  const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    const [pair] = cookie.split(';');
    if (/Max-Age=0/.test(cookie)) cookieJar = '';
    else cookieJar = pair;
  }
  return response;
};

const redirects = [];
globalThis.window = {};
globalThis.location = {
  href: `${BASE}/login`,
  pathname: '/login',
  search: '',
  protocol: 'http:',
  replace(target) {
    redirects.push(target);
  }
};
globalThis.document = { getElementById: () => null };

await import('../public/js/vn-auth.js');
const VNAuth = globalThis.window.VNAuth;

/* ------------------------------------------------------------------ */

function randomEmail(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@exemple.test`;
}

async function main() {
  console.log(`\u001b[1mVN Kanban — tests de la bibliothèque client\u001b[0m  (${BASE})`);

  check('la bibliothèque s’exporte sur window.VNAuth', !!VNAuth && typeof VNAuth.login === 'function');

  const config = await VNAuth.loadConfig();
  check('la configuration du serveur est lue', !!(config && config.auth));
  check('la version du KDF est exposée', config && config.auth.kdf.version === 'v1');

  /* ---------------- Robustesse du mot de passe ---------------- */
  console.log('\n\u001b[1mMot de passe : évaluation de robustesse\u001b[0m');
  check('« 123 » est refusé', VNAuth.passwordScore('123').valid === false);
  check('« court123 » est refusé', VNAuth.passwordScore('court12').valid === false);
  check('« MotDePasse!2026 » est accepté', VNAuth.passwordScore('MotDePasse!2026').valid === true);
  check(
    'un mot de passe long est mieux noté qu’un court',
    VNAuth.passwordScore('MotDePasse!2026').score > VNAuth.passwordScore('court12').score
  );
  check('un mot de passe de 200+ caractères reste accepté', VNAuth.passwordScore('a'.repeat(150) + 'Z9!').valid === true);

  /* ---------------- Pré-hachage ---------------- */
  console.log('\n\u001b[1mPré-hachage PBKDF2 dans le navigateur\u001b[0m');
  const t0 = Date.now();
  const first = await VNAuth.prehash('MotDePasse!2026');
  const elapsed = Date.now() - t0;
  const second = await VNAuth.prehash('MotDePasse!2026');
  check('le pré-hachage est déterministe', first.value === second.value);
  check('le pré-hachage fait 256 bits (43 caractères base64url)', /^[A-Za-z0-9_-]{43}$/.test(first.value), first.value);
  check('le pré-hachage n’est pas le mot de passe', !first.value.includes('MotDePasse'));
  check('le calcul reste raisonnable (< 2 s)', elapsed < 2000, `${elapsed} ms`);
  console.log(`  (pré-hachage mesuré : ${elapsed} ms pour ${first.iterations} itérations)`);

  /* ---------------- Inscription ---------------- */
  console.log('\n\u001b[1mInscription et session\u001b[0m');
  const email = randomEmail('lib');
  const password = 'MotDePasseLib!2026';

  const register = await VNAuth.register({ email, name: 'Test Bibliothèque', password });
  check('VNAuth.register crée le compte', !!register.user && register.user.email === email);

  const session = await VNAuth.me();
  check('VNAuth.me confirme la session', session.authenticated === true);
  check('la session ne contient pas d’empreinte de mot de passe', !JSON.stringify(session).includes('pbkdf2'));

  /* ---------------- Erreurs ---------------- */
  console.log('\n\u001b[1mGestion des erreurs\u001b[0m');
  const duplicate = await VNAuth.register({ email, name: 'Doublon', password }).catch((error) => error);
  check(
    'réinscription : erreur typée avec code',
    duplicate instanceof VNAuth.VNAuthError && duplicate.code === 'email_taken',
    String(duplicate && duplicate.code)
  );

  const wrongPassword = await VNAuth.login({ email, password: 'MauvaisMotDePasse!1' }).catch((error) => error);
  check(
    'mauvais mot de passe : code « invalid_credentials »',
    wrongPassword instanceof VNAuth.VNAuthError && wrongPassword.code === 'invalid_credentials',
    String(wrongPassword && wrongPassword.code)
  );
  check('l’erreur porte un statut HTTP 401', wrongPassword.status === 401);

  /* ---------------- Changement de mot de passe ---------------- */
  console.log('\n\u001b[1mChangement de mot de passe\u001b[0m');
  const newPassword = 'NouveauMotDePasseLib!2027';
  const changed = await VNAuth.changePassword({ currentPassword: password, newPassword });
  check('VNAuth.changePassword réussit', changed.ok === true);

  cookieJar = '';
  const loginOld = await VNAuth.login({ email, password }).catch((error) => error);
  check('l’ancien mot de passe est refusé', loginOld instanceof Error && loginOld.status === 401);

  const loginNew = await VNAuth.login({ email, password: newPassword });
  check('le nouveau mot de passe fonctionne', !!loginNew.user && loginNew.user.email === email);

  /* ---------------- Redirection si non connecté ---------------- */
  console.log('\n\u001b[1mProtection des pages\u001b[0m');
  await VNAuth.logout();
  cookieJar = '';
  redirects.length = 0;
  const anonymous = await VNAuth.requireSession();
  check('sans session, requireSession redirige', anonymous === null && redirects.length === 1);
  check(
    'la redirection conserve la page demandée',
    redirects[0] && redirects[0].startsWith('/login?next='),
    String(redirects[0])
  );

  const afterLogout = await VNAuth.me();
  check('après déconnexion, me() renvoie authenticated = false', afterLogout.authenticated === false);

  /* ---------------- Réinitialisation ---------------- */
  console.log('\n\u001b[1mDemande de réinitialisation\u001b[0m');
  const forgot = await VNAuth.forgot(email);
  check('VNAuth.forgot répond sans divulguer l’existence du compte', forgot.ok === true);

  const unknownForgot = await VNAuth.forgot(randomEmail('inconnu'));
  check('réponse identique pour un compte inexistant', unknownForgot.message === forgot.message);

  console.log(`\n\u001b[1mRésultat\u001b[0m : ${passed} réussite(s), ${failed} échec(s)`);
  if (failed) {
    console.log('\u001b[31mÉchecs :\u001b[0m');
    for (const name of failures) console.log(`  • ${name}`);
    process.exit(1);
  }
  console.log('\u001b[32mBibliothèque client : tous les tests sont passés.\u001b[0m');
}

main().catch((error) => {
  console.error('\n\u001b[31mErreur inattendue :\u001b[0m', error);
  process.exit(1);
});
