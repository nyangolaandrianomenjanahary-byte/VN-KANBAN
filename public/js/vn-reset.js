/* ============================================================================
   VN — Page « nouveau mot de passe » (lien de réinitialisation)
   ========================================================================== */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';

  const alertSlot = $('alert-slot');
  const loading = $('loading');

  const ICONS = {
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
  };

  function showAlert(kind, message) {
    alertSlot.innerHTML = `<div class="vn-alert vn-alert-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${
      ICONS[kind] || ICONS.info
    }<span></span></div>`;
    alertSlot.querySelector('span').textContent = message;
  }

  function setLoading(on, text = 'Enregistrement…') {
    $('loading-text').textContent = text;
    loading.classList.toggle('on', on);
  }

  // Bouton afficher/masquer
  for (const button of document.querySelectorAll('[data-toggle-password]')) {
    button.addEventListener('click', () => {
      const input = $(button.dataset.togglePassword);
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
    });
  }

  // Robustesse en direct
  const password = $('reset-password');
  password.addEventListener('input', () => {
    const result = VNAuth.passwordScore(password.value);
    const container = $('reset-strength');
    container.dataset.score = String(result.score);
    $('reset-strength-label').textContent = password.value
      ? `${result.label}${result.valid ? '' : ' — 8 caractères minimum'}`
      : '8 caractères minimum';
    checkMatch();
  });

  const confirm = $('reset-confirm');
  confirm.addEventListener('input', checkMatch);

  function checkMatch() {
    const mismatch = $('mismatch');
    if (!confirm.value) {
      mismatch.hidden = true;
      confirm.setAttribute('aria-invalid', 'false');
      return true;
    }
    const same = confirm.value === password.value;
    mismatch.hidden = same;
    confirm.setAttribute('aria-invalid', String(!same));
    return same;
  }

  if (!token) {
    showAlert('error', 'Ce lien est incomplet. Demandez un nouveau lien de réinitialisation.');
    $('panel-reset').hidden = true;
  }

  $('panel-reset').addEventListener('submit', async (event) => {
    event.preventDefault();
    alertSlot.innerHTML = '';

    if (!VNAuth.passwordScore(password.value).valid) {
      showAlert('error', 'Le mot de passe doit contenir au moins 8 caractères.');
      password.focus();
      return;
    }
    if (!checkMatch() || !confirm.value) {
      showAlert('error', 'Les deux mots de passe ne correspondent pas.');
      confirm.focus();
      return;
    }

    $('reset-submit').disabled = true;
    setLoading(true, 'Enregistrement sécurisé…');
    try {
      await VNAuth.resetPassword({ token, password: password.value });
      setLoading(false);
      showAlert('success', 'Mot de passe enregistré. Redirection vers la connexion…');
      $('panel-reset').hidden = true;
      setTimeout(() => location.replace('/login?reset=1'), 1400);
    } catch (error) {
      setLoading(false);
      $('reset-submit').disabled = false;
      showAlert('error', error.message);
    }
  });
})();
