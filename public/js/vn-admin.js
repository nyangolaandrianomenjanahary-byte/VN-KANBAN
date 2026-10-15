/* ============================================================================
   VN — Console d'administration (compte ROOT)
   ----------------------------------------------------------------------------
   • ROOT  : contrôle total (comptes, rôles, tableaux, sauvegardes)
   • ADMIN : consultation seule (statistiques, comptes, journal)
   ========================================================================== */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let session = null;
  let isRoot = false;
  let page = 1;
  let pages = 1;
  let filters = { q: '', role: '', status: '' };
  let currentUsers = [];

  /* ------------------------------------------------------------------ */
  /*  Helpers d'interface                                                */
  /* ------------------------------------------------------------------ */

  const ICONS = {
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    warn:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'
  };

  function showAlert(kind, message) {
    const slot = $('alert-slot');
    slot.innerHTML = `<div class="vn-alert vn-alert-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${
      ICONS[kind] || ICONS.info
    }<span></span></div>`;
    slot.querySelector('span').textContent = message;
    if (kind === 'success') {
      setTimeout(() => {
        if (slot.firstChild) slot.innerHTML = '';
      }, 6000);
    }
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('on'), 4200);
  }

  function setLoading(on, text = 'Chargement…') {
    $('loading-text').textContent = text;
    $('loading').classList.toggle('on', on);
  }

  function formatDate(ms) {
    if (!ms) return '—';
    try {
      return new Date(Number(ms)).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} o`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
    return `${(value / (1024 * 1024)).toFixed(2)} Mo`;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Fenêtre modale : renvoie une promesse résolue avec la valeur de confirmation. */
  function modal({ title, text, body = '', confirmLabel = 'Confirmer', danger = false }) {
    return new Promise((resolve) => {
      $('modal-title').textContent = title;
      $('modal-text').innerHTML = text || '';
      $('modal-body').innerHTML = body;
      const confirm = $('modal-confirm');
      confirm.textContent = confirmLabel;
      confirm.className = `vn-btn vn-btn-sm ${danger ? 'vn-btn-danger' : 'vn-btn-primary'}`;
      $('modal').classList.add('on');

      const close = (value) => {
        $('modal').classList.remove('on');
        confirm.removeEventListener('click', onConfirm);
        $('modal-cancel').removeEventListener('click', onCancel);
        resolve(value);
      };
      const onConfirm = () => close(true);
      const onCancel = () => close(false);
      confirm.addEventListener('click', onConfirm);
      $('modal-cancel').addEventListener('click', onCancel);
    });
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copié dans le presse-papiers');
      return true;
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Données                                                            */
  /* ------------------------------------------------------------------ */

  async function loadStats() {
    const stats = await VNAuth.api('/api/admin/stats');
    $('stat-users').textContent = stats.users.total;
    $('stat-users-sub').textContent = `${stats.users.roots} ROOT · ${stats.users.google} Google · ${stats.users.newLast7Days} nouveaux (7 j)`;
    $('stat-boards').textContent = stats.boards.total;
    $('stat-boards-sub').textContent = `${stats.boards.cards} tâches · ${formatBytes(stats.boards.bytes)}`;
    $('stat-sessions').textContent = stats.sessions.active;
    $('stat-audit').textContent = stats.audit.entries;

    const c = stats.config;
    const rows = [
      ['Adresse de l’application', c.appUrl || location.origin],
      ['Itérations PBKDF2 (serveur)', `${c.pbkdf2Iterations}${c.pbkdf2Iterations > 50000 ? ' — coûteux : peut dépasser la limite CPU de l’offre gratuite' : ''}`],
      ['Poivre des mots de passe', c.pepperConfigured ? 'Configuré ✓' : 'Absent — recommandé : npx wrangler secret put PASSWORD_PEPPER'],
      ['Connexion Google', c.googleConfigured ? 'Configurée ✓' : 'Non configurée (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)'],
      ['E-mails de réinitialisation', c.mailerConfigured ? 'Configurés ✓' : 'Non configurés — utilisez « Générer un lien »'],
      ['Inscriptions ouvertes', c.allowSignup ? 'Oui' : 'Non (ALLOW_SIGNUP=false)'],
      ['Premier compte = ROOT', c.firstUserIsRoot ? 'Oui (à passer à false après installation)' : 'Non']
    ];
    $('config-list').innerHTML = rows
      .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
      .join('');
  }

  async function loadUsers() {
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    if (filters.q) query.set('q', filters.q);
    if (filters.role) query.set('role', filters.role);
    if (filters.status) query.set('status', filters.status);

    const body = $('users-body');
    body.innerHTML = '<tr><td colspan="6" class="vn-empty">Chargement…</td></tr>';

    const result = await VNAuth.api(`/api/admin/users?${query.toString()}`);
    currentUsers = result.users;
    pages = result.pages;

    if (!result.users.length) {
      body.innerHTML = '<tr><td colspan="6" class="vn-empty">Aucun compte ne correspond à cette recherche.</td></tr>';
    } else {
      body.innerHTML = result.users
        .map((user) => {
          const roleBadge = `<span class="vn-badge vn-badge-${escapeHtml(user.role)}">${
            user.role === 'root' ? 'ROOT' : user.role === 'admin' ? 'Admin' : 'Utilisateur'
          }</span>`;
          const statusBadge = `<span class="vn-badge vn-badge-${user.status}">${
            user.status === 'active' ? 'Actif' : 'Suspendu'
          }</span>`;
          const provider =
            user.provider === 'email' ? 'E-mail'
            : user.provider === 'google' ? 'Google'
            : 'E-mail + Google';
          const actions = isRoot
            ? `<button class="vn-btn vn-btn-ghost vn-btn-sm" data-action="edit" data-id="${user.id}">Modifier</button>
               <button class="vn-btn vn-btn-ghost vn-btn-sm" data-action="reset-link" data-id="${user.id}">Lien de réinitialisation</button>
               <button class="vn-btn vn-btn-ghost vn-btn-sm" data-action="board" data-id="${user.id}">Tableau</button>
               <button class="vn-btn vn-btn-ghost vn-btn-sm" data-action="revoke" data-id="${user.id}">Déconnecter</button>
               <button class="vn-btn vn-btn-danger vn-btn-sm" data-action="delete" data-id="${user.id}">Supprimer</button>`
            : '<span style="font-size:12.5px;color:var(--text-faint)">lecture seule</span>';

          return `<tr>
            <td class="who">${escapeHtml(user.name || '—')}
              <small>${escapeHtml(user.email)} · ${provider}${user.mustReset ? ' · mot de passe à changer' : ''}</small>
            </td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${formatDate(user.lastLoginAt)}<br><small style="color:var(--text-faint)">${escapeHtml(user.lastLoginIp || '')}</small></td>
            <td>${user.cardCount === null || user.cardCount === undefined ? '—' : `${user.cardCount} tâche(s)`}
              <br><small style="color:var(--text-faint)">${user.boardUpdatedAt ? formatDate(user.boardUpdatedAt) : 'jamais synchronisé'}</small></td>
            <td><div class="actions">${actions}</div></td>
          </tr>`;
        })
        .join('');
    }

    $('users-count').textContent = `${result.total} compte(s)`;
    $('page-label').textContent = `Page ${result.page} / ${result.pages}`;
    $('page-prev').disabled = result.page <= 1;
    $('page-next').disabled = result.page >= result.pages;
  }

  async function loadAudit() {
    const filter = $('audit-filter').value;
    const query = new URLSearchParams({ limit: '200' });
    if (filter) query.set('action', filter);
    const log = $('audit-log');
    log.innerHTML = '<div class="vn-empty">Chargement…</div>';
    const result = await VNAuth.api(`/api/admin/audit?${query.toString()}`);
    if (!result.entries.length) {
      log.innerHTML = '<div class="vn-empty">Aucune entrée pour le moment.</div>';
      return;
    }
    log.innerHTML = result.entries
      .map(
        (entry) => `<div class="vn-log-entry">
          <span class="t">${formatDate(entry.at)}</span>
          <span class="a">${escapeHtml(entry.action)}</span>
          <span class="d">${escapeHtml(entry.actor_email || '—')}${entry.details ? ` — ${escapeHtml(entry.details)}` : ''}${
            entry.ip ? ` <span style="color:var(--text-faint)">(${escapeHtml(entry.ip)})</span>` : ''
          }</span>
        </div>`
      )
      .join('');
  }

  function userById(id) {
    return currentUsers.find((user) => user.id === id);
  }

  /* ------------------------------------------------------------------ */
  /*  Actions sur les comptes                                            */
  /* ------------------------------------------------------------------ */

  async function editUser(user) {
    const confirmed = await modal({
      title: `Modifier ${user.email}`,
      text: 'Les changements prennent effet immédiatement.',
      confirmLabel: 'Enregistrer',
      body: `
        <div class="vn-field"><label for="m-name">Nom</label>
          <input class="vn-input" id="m-name" value="${escapeHtml(user.name || '')}"></div>
        <div class="vn-field"><label for="m-email">Adresse e-mail</label>
          <input class="vn-input" id="m-email" type="email" value="${escapeHtml(user.email)}"></div>
        <div class="vn-field"><label for="m-role">Rôle</label>
          <select class="vn-input" id="m-role">
            ${['root', 'admin', 'user']
              .map(
                (role) =>
                  `<option value="${role}" ${role === user.role ? 'selected' : ''}>${
                    role === 'root' ? 'ROOT — contrôle total' : role === 'admin' ? 'Admin — lecture seule' : 'Utilisateur'
                  }</option>`
              )
              .join('')}
          </select></div>
        <div class="vn-field"><label for="m-status">Statut</label>
          <select class="vn-input" id="m-status">
            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Actif</option>
            <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>Suspendu</option>
          </select></div>
        <div class="vn-field"><label for="m-password">Nouveau mot de passe temporaire (facultatif)</label>
          <input class="vn-input" id="m-password" type="text" placeholder="8 caractères minimum">
          <div class="vn-hint">Le mot de passe est transformé dans votre navigateur avant l'envoi, puis l'utilisateur devra le changer à sa prochaine connexion.</div></div>`
    });
    if (!confirmed) return;

    const role = $('m-role').value;
    const status = $('m-status').value;
    const name = $('m-name').value.trim();
    const email = $('m-email').value.trim();
    const plainPassword = $('m-password').value;

    const patch = {};
    if (name !== (user.name || '')) patch.name = name;
    if (email !== user.email) patch.email = email;
    if (role !== user.role) patch.role = role;
    if (status !== user.status) patch.status = status;
    if (plainPassword) {
      if (!VNAuth.passwordScore(plainPassword).valid) {
        showAlert('error', 'Le mot de passe temporaire doit contenir au moins 8 caractères.');
        return;
      }
      setLoading(true, 'Préparation du mot de passe…');
      const stretched = await VNAuth.prehash(plainPassword);
      patch.password = stretched.value;
      setLoading(false);
    }

    if (!Object.keys(patch).length) {
      toast('Aucune modification');
      return;
    }

    setLoading(true, 'Enregistrement…');
    try {
      await VNAuth.api(`/api/admin/users/${user.id}`, { method: 'PATCH', body: patch });
      setLoading(false);
      showAlert('success', `Compte ${user.email} mis à jour.`);
      await loadUsers();
      await loadStats();
    } catch (error) {
      setLoading(false);
      showAlert('error', error.message);
    }
  }

  async function resetLink(user) {
    const confirmed = await modal({
      title: 'Générer un lien de réinitialisation',
      text: `Un lien à usage unique (valable 24 h) sera créé pour ${user.email}. Transmettez-le par un canal sûr : l'utilisateur choisira lui-même son mot de passe.`,
      confirmLabel: 'Générer le lien'
    });
    if (!confirmed) return;

    setLoading(true, 'Génération…');
    try {
      const result = await VNAuth.api(`/api/admin/users/${user.id}/reset-link`, { method: 'POST', body: {} });
      setLoading(false);
      await modal({
        title: 'Lien de réinitialisation',
        text: `À transmettre à ${escapeHtml(user.email)}. Il expire dans 24 heures et ne fonctionne qu'une fois.`,
        confirmLabel: 'Fermer',
        body: `<div class="vn-code" id="reset-link-text">${escapeHtml(result.link)}</div>
               <button class="vn-btn vn-btn-ghost vn-btn-sm" id="copy-link" style="margin-top:10px">Copier le lien</button>`
      });
      const copy = $('copy-link');
      if (copy) copy.addEventListener('click', () => copyToClipboard(result.link));
    } catch (error) {
      setLoading(false);
      showAlert('error', error.message);
    }
  }

  async function openBoard(user) {
    setLoading(true, 'Lecture du tableau…');
    try {
      const board = await VNAuth.api(`/api/admin/users/${user.id}/board`);
      setLoading(false);
      if (!board.exists) {
        showAlert('info', `Aucun tableau enregistré sur le serveur pour ${user.email}.`);
        return;
      }
      const cards = (board.data && board.data.cards) || [];
      const columns = (board.data && board.data.columns) || [];
      const notes = (board.data && board.data.notes) || [];
      const summary = `
        <dl class="vn-kv">
          <dt>Révision</dt><dd>${board.revision}</dd>
          <dt>Dernière synchronisation</dt><dd>${formatDate(board.updatedAt)}</dd>
          <dt>Taille</dt><dd>${formatBytes(board.size)}</dd>
          <dt>Colonnes</dt><dd>${columns.map((c) => escapeHtml(c.title)).join(' · ') || '—'}</dd>
          <dt>Tâches</dt><dd>${cards.length}</dd>
          <dt>Notes</dt><dd>${notes.length}</dd>
          <dt>Archive</dt><dd>${Array.isArray(board.archive) ? board.archive.length : 0} journée(s)</dd>
        </dl>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="vn-btn vn-btn-ghost vn-btn-sm" id="dl-board">⬇︎ Télécharger le JSON</button>
          <button class="vn-btn vn-btn-danger vn-btn-sm" id="restore-board">⬆︎ Restaurer un fichier</button>
        </div>`;

      await modal({
        title: `Tableau de ${user.email}`,
        text: 'Contenu actuellement stocké dans la base du serveur.',
        confirmLabel: 'Fermer',
        body: summary
      });

      const download = $('dl-board');
      if (download) {
        download.addEventListener('click', () => {
          const blob = new Blob([JSON.stringify({ data: board.data, archive: board.archive }, null, 2)], {
            type: 'application/json'
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `vn-tableau-${user.email}.json`;
          link.click();
          URL.revokeObjectURL(url);
        });
      }

      const restoreBtn = $('restore-board');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/json,.json';
          input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
              const parsed = JSON.parse(await file.text());
              const data = parsed.data || parsed;
              await VNAuth.api(`/api/admin/users/${user.id}/board`, { method: 'PUT', body: { data, archive: parsed.archive || [] } });
              toast('Tableau restauré');
              $('modal').classList.remove('on');
            } catch (error) {
              showAlert('error', `Restauration impossible : ${error.message}`);
            }
          });
          input.click();
        });
      }
    } catch (error) {
      setLoading(false);
      showAlert('error', error.message);
    }
  }

  async function revokeSessions(user) {
    const confirmed = await modal({
      title: 'Déconnecter cet utilisateur',
      text: `Toutes les sessions de ${user.email} seront immédiatement révoquées.`,
      confirmLabel: 'Déconnecter',
      danger: true
    });
    if (!confirmed) return;
    try {
      await VNAuth.api(`/api/admin/users/${user.id}/revoke-sessions`, { method: 'POST', body: {} });
      showAlert('success', 'Sessions révoquées.');
      await loadUsers();
    } catch (error) {
      showAlert('error', error.message);
    }
  }

  async function deleteUser(user) {
    const confirmed = await modal({
      title: 'Supprimer ce compte',
      text: `Le compte ${escapeHtml(user.email)} et TOUTES ses tâches seront définitivement supprimés. Cette action est irréversible — pensez à exporter une sauvegarde avant.`,
      confirmLabel: 'Supprimer définitivement',
      danger: true,
      body: `<div class="vn-field"><label for="confirm-email">Saisissez l'e-mail du compte pour confirmer</label>
             <input class="vn-input" id="confirm-email" placeholder="${escapeHtml(user.email)}"></div>`
    });
    if (!confirmed) return;
    if ($('confirm-email').value.trim().toLowerCase() !== user.email.toLowerCase()) {
      showAlert('error', 'Suppression annulée : l’e-mail saisi ne correspond pas.');
      return;
    }
    try {
      await VNAuth.api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      showAlert('success', `Compte ${user.email} supprimé.`);
      await loadUsers();
      await loadStats();
    } catch (error) {
      showAlert('error', error.message);
    }
  }

  async function newUser() {
    const confirmed = await modal({
      title: 'Nouveau compte',
      text: 'Créez un compte et transmettez les identifiants, ou générez ensuite un lien de réinitialisation.',
      confirmLabel: 'Créer le compte',
      body: `
        <div class="vn-field"><label for="n-email">Adresse e-mail</label>
          <input class="vn-input" id="n-email" type="email" placeholder="personne@exemple.com"></div>
        <div class="vn-field"><label for="n-name">Nom (facultatif)</label>
          <input class="vn-input" id="n-name"></div>
        <div class="vn-field"><label for="n-role">Rôle</label>
          <select class="vn-input" id="n-role">
            <option value="user">Utilisateur</option>
            <option value="admin">Admin — lecture seule</option>
            <option value="root">ROOT — contrôle total</option>
          </select></div>
        <div class="vn-field"><label for="n-password">Mot de passe temporaire (facultatif)</label>
          <input class="vn-input" id="n-password" type="text" placeholder="laisser vide pour un lien de réinitialisation">
          <div class="vn-hint">S'il est renseigné, l'utilisateur devra le changer à sa première connexion.</div></div>`
    });
    if (!confirmed) return;

    const email = $('n-email').value.trim();
    const name = $('n-name').value.trim();
    const role = $('n-role').value;
    const plain = $('n-password').value;

    if (!email) {
      showAlert('error', 'L’adresse e-mail est obligatoire.');
      return;
    }

    const body = { email, name, role };
    if (plain) {
      setLoading(true, 'Préparation du mot de passe…');
      const stretched = await VNAuth.prehash(plain);
      body.password = stretched.value;
      body.mustReset = true;
      setLoading(false);
    }

    setLoading(true, 'Création…');
    try {
      await VNAuth.api('/api/admin/users', { method: 'POST', body });
      setLoading(false);
      showAlert('success', `Compte ${email} créé.`);
      await loadUsers();
      await loadStats();
    } catch (error) {
      setLoading(false);
      showAlert('error', error.message);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Sauvegarde / restauration                                          */
  /* ------------------------------------------------------------------ */

  async function restoreBackup(file) {
    setLoading(true, 'Lecture du fichier…');
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      setLoading(false);
      showAlert('error', 'Fichier illisible : JSON invalide.');
      return;
    }
    setLoading(false);

    const confirmed = await modal({
      title: 'Restaurer cette sauvegarde',
      text: `Le fichier contient ${(parsed.users || []).length} compte(s) et ${(parsed.boards || []).length} tableau(x) du ${escapeHtml(parsed.exportedAt || '—')}. Les tableaux existants seront remplacés.`,
      confirmLabel: 'Restaurer',
      danger: true
    });
    if (!confirmed) return;

    setLoading(true, 'Restauration…');
    try {
      const result = await VNAuth.api('/api/admin/restore', { method: 'POST', body: parsed, timeout: 120000 });
      setLoading(false);
      showAlert(
        'success',
        `${result.message} (${result.restoredBoards} tableau(x), ${result.createdUsers.length} compte(s) recréé(s))`
      );
      await loadUsers();
      await loadStats();
      await loadAudit();
    } catch (error) {
      setLoading(false);
      showAlert('error', error.message);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Écouteurs                                                          */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    $('logout').addEventListener('click', async () => {
      try {
        await VNAuth.logout();
      } catch (error) {
        /* on quitte quand même */
      }
      location.replace('/login');
    });

    let searchTimer = null;
    $('user-search').addEventListener('input', (event) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        filters.q = event.target.value.trim();
        page = 1;
        loadUsers().catch((error) => showAlert('error', error.message));
      }, 320);
    });

    $('user-role').addEventListener('change', (event) => {
      filters.role = event.target.value;
      page = 1;
      loadUsers().catch((error) => showAlert('error', error.message));
    });

    $('user-status').addEventListener('change', (event) => {
      filters.status = event.target.value;
      page = 1;
      loadUsers().catch((error) => showAlert('error', error.message));
    });

    $('page-prev').addEventListener('click', () => {
      if (page > 1) {
        page -= 1;
        loadUsers().catch((error) => showAlert('error', error.message));
      }
    });

    $('page-next').addEventListener('click', () => {
      if (page < pages) {
        page += 1;
        loadUsers().catch((error) => showAlert('error', error.message));
      }
    });

    $('btn-new-user').addEventListener('click', () => newUser());

    $('users-body').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const user = userById(button.dataset.id);
      if (!user) return;
      const actions = {
        edit: () => editUser(user),
        'reset-link': () => resetLink(user),
        board: () => openBoard(user),
        revoke: () => revokeSessions(user),
        delete: () => deleteUser(user)
      };
      const action = actions[button.dataset.action];
      if (action) action();
    });

    $('btn-restore').addEventListener('click', () => $('restore-file').click());
    $('restore-file').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) restoreBackup(file);
      event.target.value = '';
    });

    $('btn-audit-refresh').addEventListener('click', () => loadAudit().catch((error) => showAlert('error', error.message)));
    $('audit-filter').addEventListener('change', () => loadAudit().catch((error) => showAlert('error', error.message)));
  }

  /* ------------------------------------------------------------------ */
  /*  Démarrage                                                          */
  /* ------------------------------------------------------------------ */

  (async function init() {
    try {
      session = await VNAuth.requireRoot();
      if (!session) return;

      isRoot = session.user.role === 'root';
      $('role-badge').textContent = isRoot ? 'ROOT' : 'ADMIN (lecture seule)';
      $('role-badge').className = `vn-badge vn-badge-${isRoot ? 'root' : 'admin'}`;
      $('who').textContent = `${session.user.name || ''} ${session.user.email}`.trim();

      if (!isRoot) {
        $('btn-new-user').disabled = true;
        $('btn-restore').disabled = true;
        $('btn-backup').style.pointerEvents = 'none';
        $('btn-backup').style.opacity = '0.5';
        showAlert('info', 'Votre rôle « admin » donne accès à la consultation seulement.');
      }

      bindEvents();
      await Promise.all([loadStats(), loadUsers(), loadAudit()]);
    } catch (error) {
      showAlert('error', error.message || 'Chargement impossible.');
      setLoading(false);
    }
  })();
})();
