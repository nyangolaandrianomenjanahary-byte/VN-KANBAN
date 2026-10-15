/* ============================================================================
   VN — Pont entre l'application Kanban et le serveur (Cloudflare + D1)
   ----------------------------------------------------------------------------
   Ce fichier est chargé AVANT le script principal de l'application. Il :
     • vérifie la session (sinon redirection vers /login) ;
     • charge le tableau depuis la base D1 ;
     • enregistre automatiquement les modifications (1,5 s après la dernière) ;
     • récupère les changements faits sur un autre appareil ;
     • ajoute un indicateur de compte/synchronisation dans l'en-tête.

   L'application garde son mode hors ligne d'origine (dossier Root local ou
   localStorage) : si le serveur n'est pas joignable, rien n'est bloqué.
   ========================================================================== */

(function () {
  'use strict';

  const SAVE_DEBOUNCE_MS = 1500;
  const PULL_INTERVAL_MS = 25000;
  const LS_BACKUP_KEY = 'vn-cloud-conflict-backup';

  const Cloud = {
    enabled: location.protocol === 'http:' || location.protocol === 'https:',
    dataLoaded: false,
    user: null,
    revision: 0,
    status: 'idle', // idle | syncing | saved | offline | error
    lastError: null,
    stats: { pushes: 0, pulls: 0, conflicts: 0, skipped: 0 }
  };

  let saveTimer = null;
  let pushInFlight = null;
  let pullTimer = null;
  let lastPushedSignature = '';
  let pendingSave = false;

  /* ------------------------------------------------------------------ */
  /*  Accès prudemment aux variables globales de l'application           */
  /* ------------------------------------------------------------------ */

  function app() {
    return {
      get state() {
        return typeof state !== 'undefined' ? state : null;
      },
      set state(value) {
        if (typeof state !== 'undefined') state = value;
      },
      get archive() {
        return typeof archive !== 'undefined' ? archive : [];
      },
      set archive(value) {
        if (typeof archive !== 'undefined') archive = value;
      },
      get applyDatabasePayload() {
        return typeof applyDatabasePayload === 'function' ? applyDatabasePayload : null;
      },
      get renderBoard() {
        return typeof renderBoard === 'function' ? renderBoard : null;
      },
      get updateStats() {
        return typeof updateStats === 'function' ? updateStats : null;
      },
      get showToast() {
        return typeof showToast === 'function' ? showToast : null;
      }
    };
  }

  function toast(message) {
    try {
      const fn = app().showToast;
      if (fn) fn(message);
      else console.info('[VN Cloud]', message);
    } catch (error) {
      console.info('[VN Cloud]', message);
    }
  }

  function signature(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 5381;
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    return `${text.length}:${(hash >>> 0).toString(36)}`;
  }

  /* ------------------------------------------------------------------ */
  /*  Interface : pastille de compte + menu                              */
  /* ------------------------------------------------------------------ */

  const STYLE = `
  .vn-cloud-chip{display:flex;align-items:center;gap:8px;background:var(--sys-bg-secondary,#f2f2f4);border:1px solid rgba(0,0,0,.08);
    border-radius:999px;padding:4px 10px 4px 4px;cursor:pointer;font:inherit;color:inherit;position:relative;transition:background .16s ease}
  .vn-cloud-chip:hover{background:rgba(0,113,227,.1)}
  .vn-cloud-avatar{width:26px;height:26px;border-radius:50%;background:#0071E3;color:#fff;display:grid;place-items:center;
    font-size:12.5px;font-weight:700;overflow:hidden}
  .vn-cloud-avatar img{width:100%;height:100%;object-fit:cover}
  .vn-cloud-label{font-size:12.5px;font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .vn-cloud-dot{width:8px;height:8px;border-radius:50%;background:#34C759;flex:0 0 auto}
  .vn-cloud-dot.syncing{background:#FF9500;animation:vnCloudPulse 1s ease-in-out infinite}
  .vn-cloud-dot.offline,.vn-cloud-dot.error{background:#FF3B30}
  @keyframes vnCloudPulse{0%,100%{opacity:1}50%{opacity:.35}}
  .vn-cloud-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:270px;background:#fff;color:#1d1d1f;
    border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.22);border:1px solid rgba(0,0,0,.08);padding:8px;z-index:9999;display:none}
  .vn-cloud-menu.on{display:block}
  .vn-cloud-menu-head{padding:10px 10px 12px;border-bottom:1px solid rgba(0,0,0,.07);margin-bottom:6px}
  .vn-cloud-menu-head strong{display:block;font-size:13.5px}
  .vn-cloud-menu-head span{display:block;font-size:12px;color:#6e6e73;word-break:break-all}
  .vn-cloud-menu button,.vn-cloud-menu a{display:flex;width:100%;align-items:center;gap:9px;background:none;border:0;
    font:inherit;font-size:13.5px;text-align:left;padding:9px 10px;border-radius:9px;cursor:pointer;color:#1d1d1f;text-decoration:none}
  .vn-cloud-menu button:hover,.vn-cloud-menu a:hover{background:#f2f2f4}
  .vn-cloud-menu .sep{height:1px;background:rgba(0,0,0,.07);margin:6px 0}
  .vn-cloud-menu .danger{color:#FF3B30}
  .vn-cloud-menu small{color:#6e6e73;font-size:11.5px;padding:2px 10px 6px;display:block}
  @media (max-width:820px){.vn-cloud-label{display:none}}
  @media (prefers-color-scheme:dark){
    .vn-cloud-menu{background:#1c1c1e;color:#f5f5f7;border-color:rgba(255,255,255,.14)}
    .vn-cloud-menu button,.vn-cloud-menu a{color:#f5f5f7}
    .vn-cloud-menu button:hover,.vn-cloud-menu a:hover{background:#2c2c2e}
    .vn-cloud-menu-head span,.vn-cloud-menu small{color:#a1a1a6}
    .vn-cloud-chip{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.12)}
  }`;

  function injectStyles() {
    if (document.getElementById('vn-cloud-style')) return;
    const style = document.createElement('style');
    style.id = 'vn-cloud-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function initialOf(user) {
    const source = (user && (user.name || user.email)) || '?';
    return source.trim().charAt(0).toUpperCase();
  }

  function buildChip() {
    if (document.getElementById('vn-cloud-chip')) return;
    const container = document.querySelector('.header-actions');
    if (!container || !Cloud.user) return;

    const chip = document.createElement('div');
    chip.className = 'vn-cloud-chip';
    chip.id = 'vn-cloud-chip';
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-haspopup', 'menu');
    chip.setAttribute('aria-expanded', 'false');
    chip.title = 'Compte et synchronisation';
    chip.innerHTML = `
      <span class="vn-cloud-avatar">${
        Cloud.user.picture ? `<img src="${Cloud.user.picture}" alt="" referrerpolicy="no-referrer">` : initialOf(Cloud.user)
      }</span>
      <span class="vn-cloud-label">${Cloud.user.name || Cloud.user.email}</span>
      <span class="vn-cloud-dot" id="vn-cloud-dot"></span>
      <div class="vn-cloud-menu" role="menu" id="vn-cloud-menu">
        <div class="vn-cloud-menu-head">
          <strong>${Cloud.user.name || 'Compte'}</strong>
          <span>${Cloud.user.email}</span>
        </div>
        <button type="button" data-cloud-action="sync">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/></svg>
          Synchroniser maintenant
        </button>
        ${Cloud.user.role === 'root' || Cloud.user.role === 'admin'
          ? `<a href="/admin" role="menuitem">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V7z"/></svg>
               Console d'administration</a>`
          : ''}
        <a href="/login?changepassword=1" role="menuitem">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 118 0v3"/></svg>
          Changer mon mot de passe
        </a>
        <div class="sep"></div>
        <small id="vn-cloud-status-line">Synchronisé</small>
        <button type="button" class="danger" data-cloud-action="logout">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 01-2-2V6a2 2 0 012-2h6"/></svg>
          Se déconnecter
        </button>
      </div>`;

    container.insertBefore(chip, container.firstChild);

    const menu = chip.querySelector('#vn-cloud-menu');
    const toggle = (open) => {
      menu.classList.toggle('on', open);
      chip.setAttribute('aria-expanded', String(open));
    };
    chip.addEventListener('click', (event) => {
      if (event.target.closest('[data-cloud-action]')) return;
      toggle(!menu.classList.contains('on'));
    });
    chip.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle(!menu.classList.contains('on'));
      }
      if (event.key === 'Escape') toggle(false);
    });
    document.addEventListener('click', (event) => {
      if (!chip.contains(event.target)) toggle(false);
    });

    menu.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-cloud-action]');
      if (!action) return;
      toggle(false);
      if (action.dataset.cloudAction === 'sync') {
        await push({ force: true });
        await pull({ force: true });
        toast('Synchronisation terminée');
      }
      if (action.dataset.cloudAction === 'logout') {
        try {
          await VNAuth.logout();
        } catch (error) {
          /* même si l'appel échoue, on sort de l'application */
        }
        location.replace('/login');
      }
    });

    updateChip();
  }

  function updateChip() {
    const dot = document.getElementById('vn-cloud-dot');
    if (dot) {
      dot.className = `vn-cloud-dot ${Cloud.status === 'syncing' ? 'syncing' : Cloud.status === 'saved' ? '' : Cloud.status}`;
    }
    const line = document.getElementById('vn-cloud-status-line');
    if (line) {
      const labels = {
        idle: 'Synchronisé',
        syncing: 'Enregistrement en cours…',
        saved: 'Synchronisé',
        offline: 'Hors ligne — enregistré localement',
        error: `Erreur de synchronisation${Cloud.lastError ? ` : ${Cloud.lastError}` : ''}`
      };
      line.textContent = labels[Cloud.status] || 'Synchronisé';
    }
  }

  function setStatus(status, error = null) {
    Cloud.status = status;
    Cloud.lastError = error;
    updateChip();
  }

  /* ------------------------------------------------------------------ */
  /*  Lecture / écriture côté serveur                                    */
  /* ------------------------------------------------------------------ */

  async function fetchBoard() {
    const payload = await VNAuth.api('/api/data');
    return payload;
  }

  /**
   * Tableau vierge : les colonnes par défaut de l'application, aucune tâche,
   * aucune note, aucune archive.
   *
   * Pourquoi ? Le fichier HTML embarque des données de démonstration
   * (colonnes + archive de statistiques). Elles appartiennent à la personne qui
   * a exporté le fichier : un nouvel utilisateur ne doit pas les recevoir.
   * On réutilise donc uniquement la LISTE DES COLONNES de l'application.
   */
  function blankBoard() {
    let columns = null;
    try {
      if (typeof EMBEDDED_KANBAN_DATA !== 'undefined' && EMBEDDED_KANBAN_DATA && EMBEDDED_KANBAN_DATA.columns) {
        columns = JSON.parse(JSON.stringify(EMBEDDED_KANBAN_DATA.columns));
      }
    } catch (error) {
      columns = null;
    }
    if (!columns || !columns.length) {
      columns = [
        { id: 1, title: 'Hier', color: '#FF9500' },
        { id: 2, title: "Aujourd'hui", color: '#0071E3' },
        { id: 3, title: 'Dans la semaine', color: '#5856D6' },
        { id: 4, title: 'Mois prochain', color: '#AF52DE' },
        { id: 5, title: 'Terminé', color: '#34C759' }
      ];
    }
    const maxId = columns.reduce((max, column) => Math.max(max, Number(column.id) || 0), 0);
    return {
      version: 8,
      columns,
      cards: [],
      notes: [],
      nextNoteId: 1,
      nextColumnId: maxId + 1,
      nextCardId: 1
    };
  }

  /** Sauvegarde de secours avant remplacement par la version du serveur. */
  function backupLocalState(localState, localArchive, remote) {
    try {
      const payload = JSON.stringify({
        at: new Date().toISOString(),
        reason: remote ? 'remplacé par la base du serveur' : 'tableau local',
        data: localState,
        archive: localArchive
      });
      localStorage.setItem(`vn-cloud-backup-${Date.now()}`, payload);
      // On ne conserve que les trois sauvegardes les plus récentes.
      const keys = Object.keys(localStorage).filter((key) => key.startsWith('vn-cloud-backup-')).sort();
      while (keys.length > 3) localStorage.removeItem(keys.shift());
      return true;
    } catch (error) {
      console.warn('[VN Cloud] Sauvegarde locale impossible :', error && error.message);
      return false;
    }
  }

  /** Le navigateur a-t-il déjà enregistré un tableau ? */
  function hasLocalBoard() {
    try {
      return !!localStorage.getItem('kanban-data');
    } catch (error) {
      return false;
    }
  }

  async function push({ force = false } = {}) {
    if (!Cloud.dataLoaded) return;
    const current = app();
    if (!current.state) return;

    const data = current.state;
    const archiveData = current.archive || [];
    const sig = signature(data) + signature(archiveData);
    if (!force && sig === lastPushedSignature) {
      Cloud.stats.skipped += 1;
      return;
    }

    setStatus('syncing');
    try {
      const result = await VNAuth.api('/api/data', {
        method: 'PUT',
        body: { revision: Cloud.revision, data, archive: archiveData },
        timeout: 45000
      });
      Cloud.revision = result.revision;
      lastPushedSignature = sig;
      Cloud.stats.pushes += 1;
      pendingSave = false;
      setStatus('saved');
    } catch (error) {
      if (error.code === 'conflict') {
        Cloud.stats.conflicts += 1;
        await handleConflict(error);
        return;
      }
      if (error.code === 'network' || error.code === 'timeout') {
        setStatus('offline');
        return;
      }
      setStatus('error', error.message);
      console.warn('Synchronisation impossible :', error);
    }
  }

  /**
   * Conflit : un autre appareil a enregistré avant nous.
   * Stratégie : union des tâches/notes par identifiant (rien n'est perdu),
   * en préférant la version la plus récente quand les deux existent, puis
   * renvoi de la fusion au serveur. Une copie de sécurité reste en local.
   */
  async function handleConflict(error) {
    const server = await fetchBoard();
    try {
      localStorage.setItem(
        LS_BACKUP_KEY,
        JSON.stringify({ at: Date.now(), server: server.data, local: app().state })
      );
    } catch (backupError) {
      /* quota local : sans gravité */
    }

    const merged = mergeBoards(server.data, app().state);
    Cloud.revision = server.revision;
    const current = app();
    current.state = merged;
    if (Array.isArray(server.archive)) current.archive = server.archive;
    if (current.renderBoard) current.renderBoard();
    if (current.updateStats) current.updateStats();
    toast('Modifications fusionnées avec un autre appareil');
    await push({ force: true });
  }

  function mergeBoards(serverData, localData) {
    if (!serverData) return localData;
    if (!localData) return serverData;

    const pick = (a, b) => {
      const timeA = Number(a && (a.updatedAt || a.lastModified || a.modifiedAt || 0)) || 0;
      const timeB = Number(b && (b.updatedAt || b.lastModified || b.modifiedAt || 0)) || 0;
      if (timeA || timeB) return timeB > timeA ? b : a;
      return b; // à défaut d'horodatage, la version locale gagne
    };

    const mergeList = (listA, listB) => {
      const map = new Map();
      for (const item of Array.isArray(listA) ? listA : []) {
        if (item && item.id !== undefined) map.set(String(item.id), item);
      }
      for (const item of Array.isArray(listB) ? listB : []) {
        if (!item || item.id === undefined) continue;
        const key = String(item.id);
        map.set(key, map.has(key) ? pick(map.get(key), item) : item);
      }
      return [...map.values()];
    };

    const merged = {
      ...serverData,
      ...localData,
      columns: localData.columns && localData.columns.length ? localData.columns : serverData.columns,
      cards: mergeList(serverData.cards, localData.cards),
      notes: mergeList(serverData.notes, localData.notes)
    };
    merged.nextCardId = Math.max(
      Number(serverData.nextCardId) || 1,
      Number(localData.nextCardId) || 1,
      ...merged.cards.map((card) => (Number(card.id) || 0) + 1)
    );
    merged.nextNoteId = Math.max(
      Number(serverData.nextNoteId) || 1,
      Number(localData.nextNoteId) || 1,
      ...merged.notes.map((note) => (Number(note.id) || 0) + 1)
    );
    merged.nextColumnId = Math.max(
      Number(serverData.nextColumnId) || 1,
      Number(localData.nextColumnId) || 1,
      ...merged.columns.map((column) => (Number(column.id) || 0) + 1)
    );
    return merged;
  }

  async function pull({ force = false } = {}) {
    if (!Cloud.dataLoaded) return;
    if (pendingSave && !force) return; // ne pas écraser des modifications en attente

    try {
      const server = await fetchBoard();
      Cloud.stats.pulls += 1;
      if (!server.exists) return;

      if (server.revision !== Cloud.revision) {
        const currentState = app();
        if (currentState.applyDatabasePayload) {
          currentState.applyDatabasePayload(server.data, 'serveur');
        } else {
          currentState.state = server.data;
        }
        currentState.archive = Array.isArray(server.archive) ? server.archive : [];
        Cloud.revision = server.revision;
        lastPushedSignature = signature(server.data) + signature(currentState.archive);
        if (currentState.renderBoard) currentState.renderBoard();
        if (currentState.updateStats) currentState.updateStats();
        toast('Modifications récupérées depuis un autre appareil');
      }
      if (Cloud.status === 'offline' || Cloud.status === 'error') setStatus('saved');
    } catch (error) {
      if (error.code === 'network' || error.code === 'timeout') setStatus('offline');
    }
  }

  function scheduleSave() {
    if (!Cloud.dataLoaded) return;
    pendingSave = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (pushInFlight) return;
      pushInFlight = push().finally(() => {
        pushInFlight = null;
      });
    }, SAVE_DEBOUNCE_MS);
  }

  /* ------------------------------------------------------------------ */
  /*  Démarrage                                                          */
  /* ------------------------------------------------------------------ */

  async function boot(fallbackInit) {
    injectStyles();

    if (!Cloud.enabled) {
      fallbackInit();
      return;
    }

    let config = null;
    try {
      config = await VNAuth.loadConfig();
    } catch (error) {
      config = null;
    }

    // Serveur sans API (fichier servi en statique) : mode hors ligne complet.
    if (!config || !config.auth) {
      console.info('[VN Cloud] API indisponible : démarrage en mode hors ligne.');
      fallbackInit();
      return;
    }

    let session = null;
    try {
      session = await VNAuth.me();
    } catch (error) {
      console.warn('[VN Cloud] Vérification de session impossible :', error && error.message);
      fallbackInit();
      return;
    }

    if (!session || !session.authenticated) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.replace(`/login?next=${next}`);
      return;
    }

    if (session.mustReset) {
      location.replace(`/login?mustReset=1&next=${encodeURIComponent(location.pathname)}`);
      return;
    }

    Cloud.user = session.user;

    // Chargement de la base serveur
    try {
      const board = await fetchBoard();
      if (board.exists && board.data) {
        // Le serveur fait référence. Si ce navigateur possède un tableau local
        // différent, il est conservé en sauvegarde avant remplacement : aucune
        // donnée n'est perdue silencieusement.
        const localState = app().state;
        const savedLocal = backupLocalState(localState, app().archive, true);
        if (typeof applyDatabasePayload === 'function') {
          applyDatabasePayload(board.data, 'base serveur');
        } else {
          throw new Error('chargeur de données introuvable');
        }
        archive = Array.isArray(board.archive) ? board.archive : [];
        Cloud.revision = board.revision;
        lastPushedSignature = signature(board.data) + signature(archive);
        bootSource = 'base serveur (Cloudflare D1)';
        Cloud.dataLoaded = true;
        if (savedLocal && localState && signature(localState) !== signature(board.data)) {
          Cloud.localBackup = true;
        }
      } else if (hasLocalBoard()) {
        // Aucune donnée côté serveur, mais ce navigateur en possède : on les
        // envoie (première synchronisation d'un utilisateur existant).
        Cloud.dataLoaded = true;
        Cloud.revision = 0;
        Cloud.seeding = true;
        Cloud.freshBoard = false;
      } else {
        // Aucune donnée nulle part : tableau vierge.
        const blank = blankBoard();
        archive = [];
        if (typeof applyDatabasePayload === 'function') {
          applyDatabasePayload(blank, 'nouveau tableau');
        }
        bootSource = 'nouveau tableau (serveur)';
        Cloud.dataLoaded = true;
        Cloud.revision = 0;
        Cloud.seeding = true;
        Cloud.freshBoard = true;
      }
    } catch (error) {
      console.error('[VN Cloud] Chargement de la base serveur impossible :', error);
      setStatus('error', error.message);
      fallbackInit();
      return;
    }

    // L'application démarre (sans demander de dossier Root : voir init())
    fallbackInit();

    // Pastille de compte
    setTimeout(() => {
      buildChip();
      if (Cloud.seeding && Cloud.freshBoard) {
        toast('Nouveau tableau créé : il est enregistré sur le serveur');
        setTimeout(() => push({ force: true }), 800);
      } else if (Cloud.seeding) {
        toast('Première synchronisation : vos tâches locales sont enregistrées sur le serveur');
        setTimeout(() => push({ force: true }), 800);
      } else if (Cloud.localBackup) {
        toast('Base chargée depuis le serveur (copie locale conservée)');
      } else {
        toast('Base chargée depuis le serveur');
      }
    }, 700);

    // Récupération périodique + au retour sur l'onglet
    const schedulePull = () => {
      if (pullTimer) clearInterval(pullTimer);
      pullTimer = setInterval(() => {
        if (!document.hidden) pull();
      }, PULL_INTERVAL_MS);
    };
    schedulePull();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pull();
    });
    window.addEventListener('focus', () => pull());
    window.addEventListener('online', () => pull({ force: true }));
    window.addEventListener('offline', () => setStatus('offline'));

    // Enregistrement final avant fermeture (envoi « au mieux »)
    window.addEventListener('beforeunload', () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        push({ force: true });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                             */
  /* ------------------------------------------------------------------ */

  Cloud.boot = boot;
  Cloud.scheduleSave = scheduleSave;
  Cloud.push = push;
  Cloud.pull = pull;
  Cloud.mergeBoards = mergeBoards;

  window.VNCloud = Cloud;
})();
