#!/usr/bin/env node
/**
 * Test d'intégration de l'APPLICATION complète (public/index.html).
 *
 * Charge la vraie application Kanban dans jsdom avec une session valide et
 * vérifie la chaîne complète :
 *   1. la page démarre sans demander de dossier Root ;
 *   2. la base serveur est chargée dans l'application ;
 *   3. une modification locale est envoyée automatiquement au serveur ;
 *   4. une modification faite « ailleurs » est récupérée ;
 *   5. la pastille de compte est présente dans l'en-tête.
 *
 * Prérequis : npx wrangler dev --port 8787
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { webcrypto } from 'node:crypto';
import { prehashFor } from '../scripts/lib/prehash.mjs';
import { resetLocalDatabase } from './helpers/db.mjs';

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

async function waitFor(predicate, { timeout = 25000, interval = 250, label = '' } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      // On renvoie la valeur obtenue (et non simplement « true ») : certains
      // appels attendent un objet renvoyé par l'API.
      const value = await predicate();
      if (value) return value;
    } catch {
      /* on réessaie */
    }
    await sleep(interval);
  }
  if (label) console.log(`  (délai dépassé en attendant : ${label})`);
  return false;
}

/* ------------------------------------------------------------------ */
/*  Client API (côté test)                                             */
/* ------------------------------------------------------------------ */

class ApiClient {
  constructor() {
    this.cookies = new Map();
  }

  async fetch(path, { method = 'GET', body } = {}) {
    const headers = { 'X-VN-Client': 'web' };
    if (this.cookies.size) headers.Cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual'
    });
    for (const cookie of response.headers.getSetCookie ? response.headers.getSetCookie() : []) {
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
    return { status: response.status, json, text };
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

const BOARD = {
  version: 8,
  columns: [
    { id: 1, title: 'Hier', color: '#FF9500' },
    { id: 2, title: "Aujourd'hui", color: '#0071E3' },
    { id: 3, title: 'Dans la semaine', color: '#5856D6' }
  ],
  cards: [{ id: 1, title: 'Tâche venue du serveur', columnId: 2, priority: 'high', totalTimeSpent: 0 }],
  notes: [],
  nextColumnId: 4,
  nextCardId: 2,
  nextNoteId: 1
};

/* ------------------------------------------------------------------ */

/**
 * Charge l'application dans un navigateur simulé avec une session donnée.
 * Utilisé par les deux scénarios (tableau existant, compte tout neuf).
 */
async function loadApp(cookieHeader, errors) {
  const dom = await JSDOM.fromURL(`${BASE}/`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: (() => {
      const virtualConsole = new VirtualConsole();
      virtualConsole.on('jsdomError', (error) => {
        if (!/Not implemented: navigation/.test(error.message)) errors.push(error.message);
      });
      virtualConsole.on('error', (message) => {
        const text = String(message);
        if (/jsdelivr|fonts\.googleapis|fonts\.gstatic|Could not load/.test(text)) return;
        errors.push(text);
      });
      if (process.env.VN_DEBUG) {
        virtualConsole.on('warn', (message) => console.log('    [page warn]', String(message).slice(0, 240)));
        virtualConsole.on('info', (message) => console.log('    [page info]', String(message).slice(0, 240)));
      }
      return virtualConsole;
    })(),
    beforeParse: (window) => {
      try {
        Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
      } catch {
        Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
      }
      window.fetch = async (input, options = {}) => {
        const url = typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : String(input);
        const headers = new Headers(options.headers || {});
        if (cookieHeader) headers.set('Cookie', cookieHeader);
        return globalThis.fetch(url, { ...options, headers, redirect: 'manual' });
      };
      window.AbortController = AbortController;
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.Headers = Headers;
      window.Response = Response;
      window.Request = Request;
      Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
      if (typeof window.matchMedia !== 'function') {
        window.matchMedia = (query) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() {
            return false;
          }
        });
      }
    }
  });
  const win = dom.window;
  await waitFor(() => win.document.readyState === 'complete', { timeout: 30000, label: 'chargement du document' });
  return win;
}

/* ------------------------------------------------------------------ */

async function main() {
  resetLocalDatabase();
  console.log(`\u001b[1mVN Kanban — intégration de l'application\u001b[0m  (${BASE})`);

  /* ---------------- Préparation du compte ---------------- */
  const email = `app-${Date.now().toString(36)}@exemple.test`;
  const password = 'MotDePasseApp!2026';
  const api = new ApiClient();

  const register = await api.fetch('/api/auth/register', {
    method: 'POST',
    body: { email, name: 'Compte Application', password: await prehashFor(password), kdf: 'v1' }
  });
  if (register.status !== 201) {
    console.error('\u001b[31mCréation du compte de test impossible :\u001b[0m', register.text.slice(0, 200));
    process.exit(1);
  }
  console.log(`  Compte de test : ${email}`);

  // Un tableau existe déjà côté serveur (comme si un autre appareil l'avait créé)
  const seed = await api.fetch('/api/data', { method: 'PUT', body: { revision: 0, data: BOARD, archive: [] } });
  if (seed.status !== 200) {
    console.error('\u001b[31mPréparation du tableau impossible :\u001b[0m', seed.text.slice(0, 200));
    process.exit(1);
  }

  /* ---------------- Chargement de l'application ---------------- */
  console.log('\n\u001b[1m1. Démarrage de l\u2019application\u001b[0m');
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (!/Not implemented: navigation/.test(error.message)) errors.push(error.message);
  });
  virtualConsole.on('error', (message) => {
    const text = String(message);
    // Le CDN Sortable et les polices Google ne sont pas joignables dans le
    // bac à sable : ce n'est pas une erreur de l'application.
    if (/jsdelivr|fonts\.googleapis|fonts\.gstatic|Could not load/.test(text)) return;
    errors.push(text);
  });

  const cookieHeader = api.cookieHeader();
  const dom = await JSDOM.fromURL(`${BASE}/`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse: (window) => {
      try {
        Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
      } catch {
        Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
      }
      // Le navigateur simulé porte la session du compte de test.
      window.fetch = async (input, options = {}) => {
        const url = typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : String(input);
        const headers = new Headers(options.headers || {});
        if (cookieHeader) headers.set('Cookie', cookieHeader);
        return globalThis.fetch(url, { ...options, headers, redirect: 'manual' });
      };
      window.AbortController = AbortController;
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.Headers = Headers;
      window.Response = Response;
      window.Request = Request;
      Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
      // jsdom n'implémente pas matchMedia : l'application l'utilise pour le thème.
      if (typeof window.matchMedia !== 'function') {
        window.matchMedia = (query) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() {
            return false;
          }
        });
      }
    }
  });

  const win = dom.window;
  // Les variables globales « let » de l'application (state, archive, bootSource…)
  // ne sont pas des propriétés de window : on y accède par eval dans le realm
  // de la page, exactement comme le ferait du code chargé par la page.
  const appEval = (code) => win.eval(code);
  const cardTitles = () => appEval('state.cards.map(function (c) { return c.title; })');

  await waitFor(() => win.document.readyState === 'complete', { timeout: 30000, label: 'chargement du document' });

  const booted = await waitFor(() => win.VNCloud && win.VNCloud.dataLoaded === true, {
    timeout: 40000,
    label: 'démarrage du module cloud'
  });
  check('le module cloud démarre avec la session existante', booted);

  const started = await waitFor(() => win.document.querySelectorAll('.card, .kanban-card, [data-card-id]').length > 0, {
    timeout: 20000,
    interval: 300,
    label: 'affichage des tâches'
  });
  check('l’application affiche des tâches', started);

  /* ---------------- Données serveur chargées ---------------- */
  console.log('\n\u001b[1m2. Base serveur chargée dans l\u2019application\u001b[0m');
  const titlesAfterBoot = cardTitles();
  check('la tâche du serveur est présente', titlesAfterBoot.includes('Tâche venue du serveur'), titlesAfterBoot.join(' | '));
  check(
    'le libellé de la source indique le serveur',
    String(appEval('bootSource') || '').includes('serveur'),
    String(appEval('bootSource'))
  );
  check('aucune demande de dossier Root', (win.document.getElementById('sync-overlay') || {}).style?.display === 'none');

  /* ---------------- Pastille de compte ---------------- */
  console.log('\n\u001b[1m3. Pastille de compte\u001b[0m');
  const chipPresent = await waitFor(() => !!win.document.getElementById('vn-cloud-chip'), { timeout: 8000, interval: 200 });
  check('la pastille de compte est ajoutée à l’en-tête', chipPresent);
  const chipText = (win.document.getElementById('vn-cloud-chip') || {}).textContent || '';
  check('la pastille indique le compte connecté', chipText.includes(email), chipText.trim().slice(0, 60));

  /* ---------------- Envoi automatique ---------------- */
  console.log('\n\u001b[1m4. Envoi automatique vers le serveur\u001b[0m');
  appEval(
    "state.cards.push({ id: 999, title: 'Tâche créée localement', columnId: 2, priority: 'low', totalTimeSpent: 0 }); state.nextCardId = 1000; saveState();"
  );

  const pushed = await waitFor(
    async () => {
      const server = await api.fetch('/api/data');
      return (server.json.data.cards || []).some((card) => card.title === 'Tâche créée localement');
    },
    { timeout: 20000, interval: 700, label: 'envoi automatique' }
  );
  check('la modification locale atteint la base serveur', pushed);

  const afterPush = await api.fetch('/api/data');
  check('la révision serveur a augmenté', afterPush.json.revision >= 2, `révision ${afterPush.json.revision}`);

  /* ---------------- Récupération ---------------- */
  console.log('\n\u001b[1m5. Récupération d\u2019une modification distante\u001b[0m');
  const remote = JSON.parse(JSON.stringify(afterPush.json.data));
  remote.cards.push({ id: 5000, title: 'Tâche modifiée sur un autre appareil', columnId: 3, priority: 'medium', totalTimeSpent: 0 });
  const remoteSave = await api.fetch('/api/data', {
    method: 'PUT',
    body: { revision: afterPush.json.revision, data: remote, archive: afterPush.json.archive || [] }
  });
  check('le « second appareil » a enregistré', remoteSave.status === 200, remoteSave.text.slice(0, 150));

  await win.VNCloud.pull({ force: true });
  await sleep(600);
  const afterPull = cardTitles();
  check(
    'la modification distante est appliquée localement',
    afterPull.includes('Tâche modifiée sur un autre appareil'),
    afterPull.join(' | ')
  );
  check(
    'aucune tâche locale n’a été perdue',
    afterPull.includes('Tâche créée localement') && afterPull.includes('Tâche venue du serveur'),
    afterPull.join(' | ')
  );

  /* ---------------- Conflit ---------------- */
  console.log('\n\u001b[1m6. Résolution de conflit\u001b[0m');
  const staleRevision = (await api.fetch('/api/data')).json.revision;
  // Un autre appareil écrit, puis nous écrivons avec une révision périmée.
  const otherDevice = JSON.parse(JSON.stringify(BOARD));
  otherDevice.cards.push({ id: 7000, title: 'Tâche du second appareil', columnId: 2, totalTimeSpent: 0 });
  await api.fetch('/api/data', { method: 'PUT', body: { revision: staleRevision, data: otherDevice, archive: [] } });

  appEval("state.cards.push({ id: 8000, title: 'Tâche locale en conflit', columnId: 2, totalTimeSpent: 0 });");
  win.VNCloud.revision = staleRevision; // l'application pense être à jour
  appEval('saveState();');
  await sleep(5000);

  const afterConflict = await api.fetch('/api/data');
  const titles = (afterConflict.json.data.cards || []).map((card) => card.title);
  check('aucune tâche perdue lors du conflit', titles.includes('Tâche locale en conflit'), titles.join(' | '));
  check(
    'les tâches de l’autre appareil sont conservées',
    titles.includes('Tâche du second appareil'),
    titles.join(' | ')
  );
  check('le conflit est comptabilisé', win.VNCloud.stats.conflicts >= 1, String(win.VNCloud.stats.conflicts));

  /* ---------------- Compte tout neuf ---------------- */
  console.log('\n\u001b[9m\u001b[1m9. Nouveau compte : tableau vierge\u001b[0m');

  const freshEmail = `app-neuf-${Date.now().toString(36)}@exemple.test`;
  const freshApi = new ApiClient();
  const freshRegister = await freshApi.fetch('/api/auth/register', {
    method: 'POST',
    body: { email: freshEmail, name: 'Compte Neuf', password: await prehashFor('MotDePasseNeuf!2026'), kdf: 'v1' }
  });
  check('création d’un compte vierge', freshRegister.status === 201, freshRegister.text.slice(0, 120));

  // Aucune donnée n'a été préparée sur le serveur : ce compte n'a pas de tableau.
  const emptyBefore = await freshApi.fetch('/api/data');
  check('aucun tableau sur le serveur au départ', emptyBefore.status === 200 && emptyBefore.json.exists === false);

  const freshErrors = [];
  const freshWin = await loadApp(freshApi.cookieHeader(), freshErrors);
  const freshEval = (code) => freshWin.eval(code);

  const freshBooted = await waitFor(() => freshWin.VNCloud && freshWin.VNCloud.dataLoaded === true, {
    timeout: 40000,
    label: 'démarrage du module cloud (compte neuf)'
  });
  check('l’application démarre pour un compte neuf', freshBooted);

  const freshStarted = await waitFor(() => freshEval('typeof state === "object" && state !== null'), {
    timeout: 30000,
    label: 'initialisation de l\u2019état'
  });
  check('l’état de l’application est initialisé', freshStarted);

  check(
    'aucune tâche de démonstration n’est importée',
    freshEval('state.cards.length') === 0,
    String(freshEval('state.cards.length'))
  );
  check(
    'aucune archive de démonstration n’est importée',
    freshEval('archive.length') === 0,
    String(freshEval('archive.length'))
  );
  check(
    'les colonnes par défaut sont présentes',
    freshEval('state.columns.length') >= 3,
    String(freshEval('state.columns.length'))
  );
  check(
    'la base affichée vient bien du serveur',
    String(freshEval('bootSource')).includes('nouveau tableau'),
    String(freshEval('bootSource'))
  );

  // Le tableau vierge doit être créé côté serveur (envoi automatique)
  const created = await waitFor(
    async () => {
      const response = await freshApi.fetch('/api/data');
      return response.status === 200 && response.json.exists === true ? response.json : false;
    },
    { timeout: 20000, interval: 700, label: 'création du tableau côté serveur' }
  );
  if (!created) {
    console.log(
      '    état du client :',
      JSON.stringify({
        status: freshWin.VNCloud.status,
        revision: freshWin.VNCloud.revision,
        stats: freshWin.VNCloud.stats,
        error: freshWin.VNCloud.lastError,
        seeding: freshWin.VNCloud.seeding,
        fresh: freshWin.VNCloud.freshBoard,
        dataLoaded: freshWin.VNCloud.dataLoaded
      })
    );
    console.log('    API :', (await freshApi.fetch('/api/data')).text.slice(0, 200));
  }
  check('le tableau vierge est créé sur le serveur', !!created && created.exists === true);
  if (created && created.data) {
    check(
      'le tableau serveur est vide lui aussi',
      created.data.cards.length === 0 && created.data.columns.length >= 3,
      `${created.data.cards.length} tâche(s)`
    );
  }

  check(
    'aucune erreur JavaScript bloquante (compte neuf)',
    freshErrors.filter((message) => !/Sortable|fonts|Failed to load resource|resource/i.test(message)).length === 0,
    freshErrors.slice(0, 2).join(' | ')
  );
  freshWin.close();

  /* ---------------- Erreurs JavaScript ---------------- */
  const realErrors = errors.filter((message) => !/Sortable|fonts|Failed to load resource|resource/i.test(message));
  check('aucune erreur JavaScript bloquante', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));

  win.close();

  console.log(`\n\u001b[1mRésultat\u001b[0m : ${passed} réussite(s), ${failed} échec(s)`);
  if (failed) {
    console.log('\u001b[31mÉchecs :\u001b[0m');
    for (const name of failures) console.log(`  • ${name}`);
    process.exit(1);
  }
  console.log('\u001b[32mIntégration de l\u2019application : tous les tests sont passés.\u001b[0m');
  process.exit(0);
}

main().catch((error) => {
  console.error('\n\u001b[31mErreur inattendue :\u001b[0m', error);
  process.exit(1);
});
