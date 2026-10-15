/* ============================================================================
   VN — Logique de la page de connexion / inscription
   ========================================================================== */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const nextPath = (() => {
    const value = params.get('next') || '';
    return value.startsWith('/') && !value.startsWith('//') ? value : '/';
  })();

  const alertSlot = $('alert-slot');
  const loading = $('loading');
  const loadingText = $('loading-text');
  let lastCredentials = null; // conservé en mémoire pour le changement imposé

  /* ------------------------------------------------------------------ */
  /*  Affichage                                                          */
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
    alertSlot.innerHTML = `<div class="vn-alert vn-alert-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${
      ICONS[kind] || ICONS.info
    }<span></span></div>`;
    alertSlot.querySelector('span').textContent = message;
  }

  function clearAlert() {
    alertSlot.innerHTML = '';
  }

  function setLoading(on, text = 'Connexion…') {
    loadingText.textContent = text;
    loading.classList.toggle('on', on);
  }

  function showPanel(name) {
    for (const panel of ['panel-login', 'panel-signup', 'panel-forgot', 'panel-mustreset', 'panel-changepassword']) {
      const el = $(panel);
      if (el) el.hidden = panel !== `panel-${name}`;
    }
    const tabs = $('tabs');
    const googleBlock = $('google-block');
    const isAuthForm = name === 'login' || name === 'signup';

    tabs.hidden = !isAuthForm;
    googleBlock.hidden = !isAuthForm;
    $('card-title').textContent =
      name === 'signup' ? 'Créer un compte'
      : name === 'forgot' ? 'Mot de passe oublié'
      : name === 'mustreset' ? 'Nouveau mot de passe'
      : name === 'changepassword' ? 'Changer mon mot de passe'
      : 'Bon retour 👋';
    $('card-sub').textContent =
      name === 'signup' ? 'Quelques secondes suffisent — vos données restent synchronisées.'
      : name === 'forgot' ? 'Nous vous enverrons un lien de réinitialisation.'
      : name === 'mustreset' ? 'Votre compte est protégé, il ne reste qu’une étape.'
      : name === 'changepassword' ? 'Choisissez un nouveau mot de passe pour votre compte.'
      : 'Connectez-vous pour accéder à vos tâches.';

    $('tab-login').setAttribute('aria-selected', String(name === 'login'));
    $('tab-signup').setAttribute('aria-selected', String(name === 'signup'));
  }

  function goToApp() {
    location.replace(nextPath);
  }

  /* ------------------------------------------------------------------ */
  /*  Messages d'erreur renvoyés par Google                              */
  /* ------------------------------------------------------------------ */

  const OAUTH_ERRORS = {
    google_not_configured:
      'La connexion Google n’est pas encore configurée sur ce serveur. Utilisez l’adresse e-mail et le mot de passe.',
    oauth_state: 'La session Google a expiré. Réessayez.',
    google_failed: 'Google a refusé la connexion. Réessayez dans un instant.',
    google_no_email: 'Ce compte Google ne fournit pas d’adresse e-mail exploitable.',
    account_suspended: 'Ce compte est suspendu. Contactez l’administrateur.',
    access_denied: 'Vous avez annulé la connexion Google.'
  };

  /* ------------------------------------------------------------------ */
  /*  Onglets et bascules                                                */
  /* ------------------------------------------------------------------ */

  $('tab-login').addEventListener('click', () => {
    clearAlert();
    showPanel('login');
    $('login-email').focus();
  });
  $('tab-signup').addEventListener('click', () => {
    clearAlert();
    showPanel('signup');
    $('signup-email').focus();
  });
  $('link-forgot').addEventListener('click', (event) => {
    event.preventDefault();
    clearAlert();
    showPanel('forgot');
    $('forgot-email').value = $('login-email').value.trim();
    $('forgot-email').focus();
  });
  $('forgot-back').addEventListener('click', () => {
    clearAlert();
    showPanel('login');
  });

  for (const button of document.querySelectorAll('[data-toggle-password]')) {
    button.addEventListener('click', () => {
      const input = $(button.dataset.togglePassword);
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
    });
  }

  // Avertissement Verr. Maj
  const capsLock = $('caps-lock');
  for (const id of ['login-password', 'signup-password', 'mustreset-password']) {
    const input = $(id);
    if (!input) continue;
    const update = (event) => {
      if (typeof event.getModifierState === 'function' && event.getModifierState('CapsLock')) {
        capsLock.hidden = false;
      } else {
        capsLock.hidden = true;
      }
    };
    input.addEventListener('keyup', update);
    input.addEventListener('keydown', update);
    input.addEventListener('blur', () => {
      capsLock.hidden = true;
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Robustesse du mot de passe                                         */
  /* ------------------------------------------------------------------ */

  function bindStrength(inputId, containerId, labelId) {
    const input = $(inputId);
    const container = $(containerId);
    const label = $(labelId);
    if (!input || !container) return;
    input.addEventListener('input', () => {
      const result = VNAuth.passwordScore(input.value);
      container.dataset.score = String(result.score);
      if (label) {
        label.textContent = input.value
          ? `${result.label}${result.valid ? '' : ' — 8 caractères minimum'}`
          : '8 caractères minimum';
      }
    });
  }

  bindStrength('signup-password', 'signup-strength', 'signup-strength-label');
  bindStrength('mustreset-password', 'mustreset-strength', 'mustreset-strength-label');
  bindStrength('cp-new', 'cp-strength', 'cp-strength-label');

  /* ------------------------------------------------------------------ */
  /*  Connexion                                                          */
  /* ------------------------------------------------------------------ */

  $('panel-login').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    if (!email || !password) {
      showAlert('error', 'Renseignez votre adresse e-mail et votre mot de passe.');
      return;
    }

    $('login-submit').disabled = true;
    setLoading(true, 'Vérification sécurisée…');
    try {
      const result = await VNAuth.login({ email, password });
      lastCredentials = { email, password };

      if (result.mustReset) {
        setLoading(false);
        showAlert('warn', 'Mot de passe temporaire : choisissez-en un nouveau.');
        showPanel('mustreset');
        $('mustreset-password').focus();
        return;
      }

      setLoading(true, 'Chargement de votre tableau…');
      goToApp();
    } catch (error) {
      setLoading(false);
      $('login-submit').disabled = false;
      if (error.code === 'google_only') {
        showAlert('info', error.message);
      } else if (error.code === 'too_many_requests' || error.code === 'account_locked') {
        showAlert('warn', error.message);
      } else {
        showAlert('error', error.message);
      }
      $('login-password').select();
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Inscription                                                        */
  /* ------------------------------------------------------------------ */

  $('panel-signup').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    const name = $('signup-name').value.trim();
    const email = $('signup-email').value.trim();
    const password = $('signup-password').value;
    const terms = $('signup-terms').checked;

    if (!email || !password) {
      showAlert('error', 'Renseignez une adresse e-mail et un mot de passe.');
      return;
    }
    const score = VNAuth.passwordScore(password);
    if (!score.valid) {
      showAlert('error', 'Le mot de passe doit contenir au moins 8 caractères.');
      $('signup-password').focus();
      return;
    }
    if (!terms) {
      showAlert('error', 'Veuillez accepter le stockage de vos tâches sur ce serveur.');
      return;
    }

    $('signup-submit').disabled = true;
    setLoading(true, 'Création du compte…');
    try {
      const result = await VNAuth.register({ email, name, password });
      lastCredentials = { email, password };
      setLoading(true, result.root ? 'Compte ROOT créé — ouverture…' : 'Compte créé — ouverture…');
      goToApp();
    } catch (error) {
      setLoading(false);
      $('signup-submit').disabled = false;
      showAlert('error', error.message);
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Changement de mot de passe imposé                                  */
  /* ------------------------------------------------------------------ */

  $('panel-mustreset').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    const newPassword = $('mustreset-password').value;
    if (!VNAuth.passwordScore(newPassword).valid) {
      showAlert('error', 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!lastCredentials) {
      showAlert('error', 'Session expirée : reconnectez-vous.');
      showPanel('login');
      return;
    }

    $('mustreset-submit').disabled = true;
    setLoading(true, 'Mise à jour du mot de passe…');
    try {
      await VNAuth.changePassword({
        currentPassword: lastCredentials.password,
        newPassword
      });
      setLoading(true, 'Mot de passe mis à jour — ouverture…');
      goToApp();
    } catch (error) {
      setLoading(false);
      $('mustreset-submit').disabled = false;
      showAlert('error', error.message);
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Mot de passe oublié                                                */
  /* ------------------------------------------------------------------ */

  $('panel-forgot').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    const email = $('forgot-email').value.trim();
    if (!email) {
      showAlert('error', 'Indiquez l’adresse e-mail de votre compte.');
      return;
    }

    $('forgot-submit').disabled = true;
    setLoading(true, 'Envoi de la demande…');
    try {
      const result = await VNAuth.forgot(email);
      setLoading(false);
      $('forgot-submit').disabled = false;
      showAlert('success', result.message || 'Demande envoyée.');
      showPanel('login');
      $('login-email').value = email;
    } catch (error) {
      setLoading(false);
      $('forgot-submit').disabled = false;
      showAlert('error', error.message);
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Changement de mot de passe (/login?changepassword=1)               */
  /* ------------------------------------------------------------------ */

  $('panel-changepassword').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    const current = $('cp-current').value;
    const next = $('cp-new').value;
    const confirmation = $('cp-confirm').value;

    if (!current || !next) {
      showAlert('error', 'Renseignez votre mot de passe actuel et le nouveau.');
      return;
    }
    if (next !== confirmation) {
      showAlert('error', 'Les deux nouveaux mots de passe ne correspondent pas.');
      $('cp-confirm').focus();
      return;
    }
    if (!VNAuth.passwordScore(next).valid) {
      showAlert('error', 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      $('cp-new').focus();
      return;
    }
    if (current === next) {
      showAlert('error', 'Le nouveau mot de passe doit être différent de l’ancien.');
      return;
    }

    $('cp-submit').disabled = true;
    setLoading(true, 'Enregistrement…');
    try {
      await VNAuth.changePassword({ currentPassword: current, newPassword: next });
      setLoading(false);
      showAlert('success', 'Mot de passe enregistré. Vos autres appareils ont été déconnectés.');
      setTimeout(() => goToApp(), 1400);
    } catch (error) {
      setLoading(false);
      $('cp-submit').disabled = false;
      showAlert(error.code === 'invalid_credentials' ? 'error' : 'warn', error.message);
      $('cp-current').select();
    }
  });

  $('cp-back').addEventListener('click', () => goToApp());

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                     */
  /* ------------------------------------------------------------------ */

  (async function init() {
    // Réinitialisation réussie (retour depuis /reset)
    if (params.get('reset')) {
      showAlert('success', 'Votre mot de passe a été modifié. Connectez-vous avec le nouveau.');
      window.history.replaceState({}, '', location.pathname + (params.get('next') ? `?next=${encodeURIComponent(nextPath)}` : ''));
    }

    // Erreur renvoyée par le retour Google
    const error = params.get('error');
    if (error) {
      showAlert(error === 'oauth_state' ? 'warn' : 'error', OAUTH_ERRORS[error] || `Connexion refusée (${error}).`);
      window.history.replaceState({}, '', location.pathname + (params.get('next') ? `?next=${encodeURIComponent(nextPath)}` : ''));
    }

    // Déjà connecté ? Direction l'application — sauf si l'on demande
    // explicitement à changer de mot de passe (menu de la pastille de compte).
    try {
      const session = await VNAuth.me();
      if (session && session.authenticated) {
        if (session.mustReset) {
          showPanel('mustreset');
        } else if (params.get('changepassword')) {
          showPanel('changepassword');
          setTimeout(() => $('cp-current').focus(), 60);
          return;
        } else {
          goToApp();
          return;
        }
      } else if (params.get('changepassword')) {
        showAlert('info', 'Connectez-vous d’abord : vous pourrez ensuite changer votre mot de passe.');
      }
    } catch (error) {
      /* serveur injoignable : on laisse le formulaire s'afficher */
    }

    // Configuration publique
    const config = await VNAuth.loadConfig();
    if (config && config.auth) {
      if (config.auth.allowSignup === false) {
        $('tab-signup').hidden = true;
        $('tabs').style.gridTemplateColumns = '1fr';
        showPanel('login');
      }

      if (config.auth.google === false) {
        const button = $('google-btn');
        button.setAttribute('aria-disabled', 'true');
        button.addEventListener('click', (event) => {
          event.preventDefault();
          showAlert(
            'info',
            'La connexion Google n’est pas encore activée sur ce serveur : l’administrateur doit renseigner GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET (voir docs/GOOGLE-OAUTH.md). En attendant, utilisez votre e-mail et votre mot de passe.'
          );
        });
        button.style.opacity = '0.62';
        $('google-hint').textContent = 'Google non configuré sur ce serveur — voir la documentation.';
      } else {
        const link = $('google-btn');
        link.href = `/api/auth/google/start?next=${encodeURIComponent(nextPath)}`;
      }

      if (config.auth.firstUserIsRoot) {
        $('setup-notice').innerHTML = `
          <div class="vn-alert vn-alert-info" role="status">
            ${ICONS.info}
            <span><strong>Première installation :</strong> le premier compte créé devient automatiquement le compte <strong>ROOT</strong> (administrateur). Créez-le dès maintenant.</span>
          </div>`;
        showPanel('signup');
      }

      if (config.auth.hasRoot === false && !config.auth.firstUserIsRoot) {
        $('setup-notice').innerHTML = `
          <div class="vn-alert vn-alert-warn" role="status">
            ${ICONS.warn}
            <span>Aucun compte ROOT n’existe. Créez un compte puis promouvez-le en ROOT avec <code>npm run root:create</code>.</span>
          </div>`;
      }
    }
  })();
})();
