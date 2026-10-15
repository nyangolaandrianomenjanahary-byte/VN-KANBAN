#!/usr/bin/env node
/**
 * Tests des pages réelles (HTML + DOM) avec jsdom.
 *
 * On charge les vraies pages (/login, /reset, /admin) depuis le serveur de
 * développement, on exécute leurs scripts et on simule un utilisateur :
 * saisie du formulaire, clic sur les onglets, affichage des erreurs.
 *
 * Cela vérifie que la page fonctionne vraiment — et pas seulement l'API.
 *
 * Prérequis : npx wrangler dev --port 8787  +  base locale vidée
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { webcrypto } from 'node:crypto';
import { prehashFor } from '../scripts/lib/prehash.mjs';
import { resetRateLimits } from './helpers/db.mjs';

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/*  Bac à sable : un navigateur avec son propre pot de cookies         */
/* ------------------------------------------------------------------ */

class Browser {
  constructor() {
    this.cookieJar = new Map();
    this.navigations = [];
    this.jsdomErrors = [];
  }

  cookieHeader() {
    return [...this.cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async fetch(input, options = {}) {
    const url = typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : String(input);
    // L'en-tête X-VN-Client est exigé par le serveur sur les écritures (anti-CSRF) ;
    // la bibliothèque de la page l'ajoute elle-même, on le fait ici pour les
    // appels directs du test.
    const headers = new Headers({ 'X-VN-Client': 'web', ...(options.headers || {}) });
    if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const cookies = this.cookieHeader();
    if (cookies) headers.set('Cookie', cookies);

    let response;
    try {
      response = await globalThis.fetch(url, { ...options, headers, redirect: 'manual' });
    } catch (error) {
      throw new TypeError('Échec réseau simulé');
    }

    const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (/Max-Age=0/.test(cookie) || value === '') this.cookieJar.delete(key);
      else this.cookieJar.set(key, value);
    }
    return response;
  }

  /** Appel d'API direct : renvoie { status, ok, json, text }. */
  async api(path, options = {}) {
    const response = await this.fetch(path, options);
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* réponse non JSON */
    }
    return { status: response.status, ok: response.ok, json, text };
  }

  /** Charge une page, exécute ses scripts et attend la fin du chargement. */
  async open(path, { settle = 1400 } = {}) {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (error) => {
      // jsdom ne sait pas naviguer : on enregistre la tentative puis on l'ignore.
      if (/Not implemented: navigation/.test(error.message)) this.navigations.push(path);
      else this.jsdomErrors.push(error.message);
    });
    virtualConsole.on('error', (message) => {
      if (!/Not implemented: navigation/.test(String(message))) this.jsdomErrors.push(String(message));
    });

    const dom = await JSDOM.fromURL(`${BASE}${path}`, {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      virtualConsole,
      beforeParse: (window) => {
        // Le DOM n'embarque pas ces API : on fournit celles de Node.
        try {
          Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
        } catch {
          Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
        }
        window.fetch = (input, options) => this.fetch(input, options);
        window.AbortController = AbortController;
        window.TextEncoder = TextEncoder;
        window.TextDecoder = TextDecoder;
        window.Headers = Headers;
        window.Response = Response;
        window.Request = Request;
        Object.defineProperty(window.navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async () => {} }
        });
      }
    });

    await new Promise((resolve) => {
      if (dom.window.document.readyState === 'complete') resolve();
      else dom.window.addEventListener('load', resolve);
    });
    await sleep(settle);
    return dom;
  }
}

function randomEmail(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@exemple.test`;
}

function submit(window, formId) {
  const form = window.document.getElementById(formId);
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

function setValue(window, id, value) {
  const input = window.document.getElementById(id);
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  return input;
}

/* ------------------------------------------------------------------ */

async function main() {
  resetRateLimits();
  console.log(`\u001b[1mVN Kanban — tests des pages (jsdom)\u001b[0m  (${BASE})`);

  // Vérifie que le serveur répond
  const ping = await globalThis.fetch(`${BASE}/api/health`).catch(() => null);
  if (!ping || !ping.ok) {
    console.error('\u001b[31mLe serveur de développement ne répond pas.\u001b[0m');
    process.exit(1);
  }

  /* ---------------- Page de connexion ---------------- */
  console.log('\n\u001b[1m1. Page /login — chargement\u001b[0m');
  const browser = new Browser();
  const loginDom = await browser.open('/login');
  const win = loginDom.window;
  const doc = win.document;

  check('la page se charge', doc.readyState === 'complete');
  check('aucune erreur JavaScript', browser.jsdomErrors.length === 0, browser.jsdomErrors.join(' | '));
  check('la bibliothèque VNAuth est présente', typeof win.VNAuth === 'object');
  check('le formulaire de connexion existe', !!doc.getElementById('panel-login'));
  check('le bouton Google est présent', !!doc.getElementById('google-btn'));

  const googleHint = doc.getElementById('google-hint').textContent || '';
  check(
    'Google non configuré : mention explicite affichée',
    /non configuré/i.test(googleHint) || win.VNAuth.config.auth.google === true,
    googleHint
  );

  const notice = doc.getElementById('setup-notice').textContent || '';
  check(
    'première installation : le rôle ROOT est annoncé',
    /ROOT/.test(notice) || win.VNAuth.config.auth.firstUserIsRoot === false,
    notice.trim().slice(0, 80)
  );

  /* ---------------- Onglets ---------------- */
  console.log('\n\u001b[1m2. Navigation entre les formulaires\u001b[0m');
  doc.getElementById('tab-signup').click();
  await sleep(60);
  check('l’onglet « Créer un compte » affiche son formulaire', doc.getElementById('panel-signup').hidden === false);
  check('le formulaire de connexion est masqué', doc.getElementById('panel-login').hidden === true);

  doc.getElementById('tab-login').click();
  await sleep(60);
  check('retour au formulaire de connexion', doc.getElementById('panel-login').hidden === false);

  /* ---------------- Robustesse ---------------- */
  console.log('\n\u001b[1m3. Indicateur de robustesse du mot de passe\u001b[0m');
  setValue(win, 'signup-password', 'abc');
  await sleep(40);
  const weakScore = doc.getElementById('signup-strength').dataset.score;
  const weakLabel = doc.getElementById('signup-strength-label').textContent;
  check('un mot de passe faible est signalé', Number(weakScore) <= 1 && /faible/i.test(weakLabel), weakLabel);

  setValue(win, 'signup-password', 'MotDePasseTres!Solide2026');
  await sleep(40);
  const strongScore = Number(doc.getElementById('signup-strength').dataset.score);
  check('un mot de passe solide est signalé', strongScore >= 3, `score ${strongScore}`);

  /* ---------------- Afficher / masquer ---------------- */
  const toggle = doc.querySelector('[data-toggle-password="signup-password"]');
  toggle.click();
  check('le bouton affiche le mot de passe', doc.getElementById('signup-password').type === 'text');
  toggle.click();
  check('le bouton masque le mot de passe', doc.getElementById('signup-password').type === 'password');

  /* ---------------- Inscription ---------------- */
  console.log('\n\u001b[1m4. Inscription depuis la page\u001b[0m');
  const email = randomEmail('page');
  const password = 'MotDePassePage!2026';

  setValue(win, 'signup-email', email);
  setValue(win, 'signup-password', password);
  setValue(win, 'signup-name', 'Compte de test');
  submit(win, 'panel-signup');
  await sleep(2500);

  check('une session est ouverte après l’inscription', browser.cookieJar.has('vn_session'), [...browser.cookieJar.keys()].join(','));
  check('l’application est ouverte (navigation tentée)', browser.navigations.length >= 1);
  check('aucune erreur d’inscription affichée', !/vn-alert-error/.test(doc.getElementById('alert-slot').innerHTML));

  /* ---------------- Connexion refusée puis acceptée ---------------- */
  console.log('\n\u001b[1m5. Connexion depuis la page\u001b[0m');
  const second = new Browser();
  const loginDoc = await second.open('/login');
  const win2 = loginDoc.window;
  const doc2 = win2.document;

  // La session existante fait rediriger la page : on repart donc d'un navigateur
  // neuf, mais l'onglet « Connexion » doit rester utilisable.
  setValue(win2, 'login-email', email);
  setValue(win2, 'login-password', 'MauvaisMotDePasse!1');
  submit(win2, 'panel-login');
  await sleep(2200);
  const errorHtml = doc2.getElementById('alert-slot').textContent || '';
  check('un mot de passe erroné affiche un message', /incorrect/i.test(errorHtml), errorHtml.trim().slice(0, 90));
  check('aucune session ouverte avec un mauvais mot de passe', !second.cookieJar.has('vn_session'));

  setValue(win2, 'login-password', password);
  submit(win2, 'panel-login');
  await sleep(2500);
  check('la connexion réussie ouvre une session', second.cookieJar.has('vn_session'));
  check('la connexion réussie déclenche l’ouverture de l’app', second.navigations.length >= 1);

  /* ---------------- Page de réinitialisation ---------------- */
  console.log('\n\u001b[1m6. Page /reset\u001b[0m');
  const resetBrowser = new Browser();
  const resetDoc = await resetBrowser.open('/reset');
  const resetText = resetDoc.window.document.getElementById('alert-slot').textContent || '';
  check('sans jeton, un message d’erreur est affiché', /incomplet|invalide/i.test(resetText), resetText.trim().slice(0, 90));
  check('le formulaire est masqué sans jeton', resetDoc.window.document.getElementById('panel-reset').hidden === true);

  /* ---------------- Changement de mot de passe ---------------- */
  console.log('\n\u001b[1m7. Changement de mot de passe (/login?changepassword=1)\u001b[0m');

  // Sans session : un message explique qu'il faut d'abord se connecter.
  const anonymousBrowser = new Browser();
  const anonymousDoc = await anonymousBrowser.open('/login?changepassword=1', { settle: 1500 });
  const anonymousDom = anonymousDoc.window.document;
  check(
    'sans session, le formulaire de changement est masqué',
    anonymousDom.getElementById('panel-changepassword').hidden === true
  );
  check(
    'sans session, un message invite à se connecter',
    /Connectez-vous d’abord|Connectez-vous d'abord/.test(anonymousDom.getElementById('alert-slot').textContent || ''),
    (anonymousDom.getElementById('alert-slot').textContent || '').trim().slice(0, 80)
  );
  anonymousDoc.window.close();

  // Avec la session du compte créé plus haut : le panneau s'ouvre directement.
  const changeBrowser = new Browser();
  changeBrowser.cookieJar = new Map(second.cookieJar);
  const changeDoc = await changeBrowser.open('/login?changepassword=1', { settle: 2200 });
  const changeDom = changeDoc.window.document;
  check(
    'avec une session, le panneau de changement s’affiche',
    changeDom.getElementById('panel-changepassword').hidden === false
  );
  check('les onglets sont masqués', changeDom.getElementById('tabs').hidden === true);

  const oldPassword = password; // défini à l'inscription (section 4)
  const newPassword = 'MotDePasseChange!2027';

  // Une seconde session (autre navigateur) avec l'ancien mot de passe : elle devra
  // être déconnectée par le changement de mot de passe.
  const otherBrowser = new Browser();
  const otherLogin = await otherBrowser.api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email, password: await prehashFor(oldPassword), kdf: 'v1' })
  });
  check('une seconde session est ouverte avant le changement', otherLogin.status === 200, `reçu ${otherLogin.status}`);

  setValue(changeDoc.window, 'cp-current', oldPassword);
  setValue(changeDoc.window, 'cp-new', newPassword);
  setValue(changeDoc.window, 'cp-confirm', 'autre-chose');
  submit(changeDoc.window, 'panel-changepassword');
  await sleep(900);
  check(
    'une confirmation différente est refusée',
    /ne correspondent pas/.test(changeDom.getElementById('alert-slot').textContent || '')
  );

  setValue(changeDoc.window, 'cp-current', 'mauvais-mot-de-passe');
  setValue(changeDoc.window, 'cp-new', newPassword);
  setValue(changeDoc.window, 'cp-confirm', newPassword);
  submit(changeDoc.window, 'panel-changepassword');
  await sleep(2500);
  check(
    'un mot de passe actuel erroné est refusé',
    /incorrect|erroné|refus/i.test(changeDom.getElementById('alert-slot').textContent || ''),
    (changeDom.getElementById('alert-slot').textContent || '').trim().slice(0, 90)
  );

  // Cette fois avec le bon mot de passe actuel.
  setValue(changeDoc.window, 'cp-current', oldPassword);
  setValue(changeDoc.window, 'cp-new', newPassword);
  setValue(changeDoc.window, 'cp-confirm', newPassword);
  submit(changeDoc.window, 'panel-changepassword');
  const changed = await (async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(500);
      if (/enregistré|enregistre/i.test(changeDom.getElementById('alert-slot').textContent || '')) return true;
    }
    return false;
  })();
  check('le mot de passe est enregistré', changed, (changeDom.getElementById('alert-slot').textContent || '').trim().slice(0, 90));

  // Vérification côté API : l'ancien mot de passe ne fonctionne plus, le nouveau oui.
  const verifyBrowser = new Browser();
  const oldLogin = await verifyBrowser.api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email, password: await prehashFor(oldPassword), kdf: 'v1' })
  });
  check('l’ancien mot de passe ne fonctionne plus', oldLogin.status === 401, `reçu ${oldLogin.status}`);

  const newLogin = await verifyBrowser.api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email, password: await prehashFor(newPassword), kdf: 'v1' })
  });
  check('le nouveau mot de passe fonctionne', newLogin.status === 200, `reçu ${newLogin.status}`);

  const stillValid = await verifyBrowser.api('/api/auth/me');
  check(
    'le compte connecté après le changement est bien celui-ci',
    stillValid.status === 200 && stillValid.json.authenticated === true && stillValid.json.user.email === email,
    `${stillValid.status} ${stillValid.text.slice(0, 120)}`
  );

  // Le changement de mot de passe révoque les AUTRES sessions, pas la sienne.
  const revokedCheck = await otherBrowser.api('/api/auth/me');
  check('les autres sessions ont été déconnectées', revokedCheck.status === 401, `reçu ${revokedCheck.status}`);

  const ownSession = await changeBrowser.api('/api/auth/me');
  check('la session utilisée pour le changement reste ouverte', ownSession.status === 200, `reçu ${ownSession.status}`);

  changeDoc.window.close();

  /* ---------------- Console d'administration ---------------- */
  console.log('\n\u001b[1m8. Page /admin\u001b[0m');

  // Rôle réel du compte créé via la page (dépend de l'état de la base)
  const meCheck = await second.api('/api/auth/me');
  const pageAccountIsRoot = !!(meCheck.json && meCheck.json.authenticated && meCheck.json.user.role === 'root');
  console.log(`  (le compte de la page est ${pageAccountIsRoot ? 'ROOT' : 'un compte simple'})`);

  // Pour tester la console de façon déterministe, on crée un vrai compte ROOT
  // via l'API d'amorçage si le jeton est disponible.
  const bootstrapToken = process.env.ROOT_BOOTSTRAP_TOKEN || '';
  let adminSessionBrowser = second;
  let expectedRoot = pageAccountIsRoot;

  if (bootstrapToken) {
    const rootBrowser = new Browser();
    const rootEmail = randomEmail('root-page');
    const rootPassword = 'RootPage!2026';
    const created = await rootBrowser.fetch('/api/setup/root', {
      method: 'POST',
      headers: { 'X-Setup-Token': bootstrapToken },
      body: JSON.stringify({ email: rootEmail, name: 'ROOT page', password: await prehashFor(rootPassword) })
    });
    if (created.status === 201) {
      const login = await rootBrowser.fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: rootEmail, password: await prehashFor(rootPassword), kdf: 'v1' })
      });
      if (login.status === 200) {
        adminSessionBrowser = rootBrowser;
        expectedRoot = true;
        console.log(`  Compte ROOT de test : ${rootEmail}`);
      }
    } else {
      console.log(`  (création du ROOT impossible : ${created.status})`);
    }
  }

  const adminBrowser = new Browser();
  adminBrowser.cookieJar = new Map(adminSessionBrowser.cookieJar);
  const adminDoc = await adminBrowser.open('/admin', { settle: 3200 });
  const adminWin = adminDoc.window;
  const adminDom = adminWin.document;

  check('la page d’administration se charge', adminDom.readyState === 'complete');
  check('aucune erreur JavaScript', adminBrowser.jsdomErrors.length === 0, adminBrowser.jsdomErrors.join(' | '));

  if (expectedRoot) {
    check('le rôle ROOT est affiché', /ROOT/.test(adminDom.getElementById('role-badge').textContent || ''));
    check(
      'le compte connecté est indiqué',
      (adminDom.getElementById('who').textContent || '').includes('@'),
      adminDom.getElementById('who').textContent
    );
    const usersHtml = adminDom.getElementById('users-body').textContent || '';
    check('la liste des comptes se remplit', usersHtml.includes('@'), usersHtml.trim().slice(0, 80));
    check(
      'les statistiques sont affichées',
      Number(adminDom.getElementById('stat-users').textContent) >= 1,
      adminDom.getElementById('stat-users').textContent
    );
    check('le journal d’audit se charge', /auth\.|admin\.|setup\./.test(adminDom.getElementById('audit-log').textContent || ''));
    check('la configuration du serveur est listée', /PBKDF2/i.test(adminDom.getElementById('config-list').textContent || ''));
  } else {
    // Un compte qui n'est pas ROOT doit être renvoyé vers l'application.
    check('un compte non-ROOT est refusé sur /admin', adminBrowser.navigations.length >= 1);
  }

  /* ---------------- Bilan ---------------- */
  console.log(`\n\u001b[1mRésultat\u001b[0m : ${passed} réussite(s), ${failed} échec(s)`);
  if (failed) {
    console.log('\u001b[31mÉchecs :\u001b[0m');
    for (const name of failures) console.log(`  • ${name}`);
    process.exit(1);
  }
  console.log('\u001b[32mPages : tous les tests sont passés.\u001b[0m');
}

main().catch((error) => {
  console.error('\n\u001b[31mErreur inattendue :\u001b[0m', error);
  process.exit(1);
});
