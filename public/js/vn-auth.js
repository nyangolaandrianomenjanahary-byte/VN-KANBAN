/* ============================================================================
   VN — Bibliothèque d'authentification côté navigateur
   ----------------------------------------------------------------------------
   • Le mot de passe est étiré DANS le navigateur (PBKDF2-SHA256, 210 000
     itérations) avant d'être envoyé : le serveur ne voit jamais le mot de
     passe en clair, et une fuite de la base ne permet pas de tester des mots
     de passe sans refaire tout ce travail pour chaque essai.
   • Le cookie de session est HttpOnly : le JavaScript n'y a pas accès, ce qui
     protège contre le vol de session par XSS.
   • Aucune dépendance externe.
   ========================================================================== */

(function () {
  'use strict';

  const DEFAULT_KDF = { version: 'v1', iterations: 210000, hash: 'SHA-256' };
  // Sel FIXE (et public) du pré-hachage navigateur : il ne dépend pas de
  // l'e-mail, sinon un changement d'adresse ou une réinitialisation par lien
  // rendrait la connexion impossible. La protection contre les attaques
  // hors ligne vient du coût PBKDF2 + du sel aléatoire par utilisateur et du
  // « poivre » secret côté serveur.
  const SALT = 'vn-kanban-auth-v1|prehash';

  /* ------------------------------------------------------------------ */
  /*  Outils                                                             */
  /* ------------------------------------------------------------------ */

  function bytesToB64url(bytes) {
    let binary = '';
    const view = new Uint8Array(bytes);
    for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  class VNAuthError extends Error {
    constructor(message, { code = 'error', status = 0, details = null } = {}) {
      super(message);
      this.name = 'VNAuthError';
      this.code = code;
      this.status = status;
      this.details = details;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  État                                                               */
  /* ------------------------------------------------------------------ */

  let config = null;
  let configPromise = null;

  async function loadConfig(force = false) {
    if (config && !force) return config;
    if (configPromise && !force) return configPromise;
    configPromise = (async () => {
      try {
        const response = await fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' });
        const payload = await response.json();
        config = payload;
      } catch (error) {
        console.warn('Configuration indisponible :', error);
        config = null;
      }
      return config;
    })();
    return configPromise;
  }

  function kdfParams() {
    const fromServer = config && config.auth && config.auth.kdf;
    return {
      version: (fromServer && fromServer.version) || DEFAULT_KDF.version,
      iterations: (fromServer && fromServer.iterations) || DEFAULT_KDF.iterations,
      hash: (fromServer && fromServer.hash) || DEFAULT_KDF.hash
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Pré-hachage PBKDF2 (identique côté serveur de référence)           */
  /* ------------------------------------------------------------------ */

  async function prehash(password) {
    const params = kdfParams();
    if (params.version !== DEFAULT_KDF.version) {
      throw new VNAuthError('Version de chiffrement inattendue : rechargez la page.', { code: 'kdf_outdated' });
    }
    const encoder = new TextEncoder();
    const salt = encoder.encode(SALT);
    const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: params.hash, salt, iterations: params.iterations },
      key,
      256
    );
    return { value: bytesToB64url(bits), version: params.version, iterations: params.iterations };
  }

  /* ------------------------------------------------------------------ */
  /*  Appels API                                                         */
  /* ------------------------------------------------------------------ */

  async function api(path, { method = 'GET', body = null, timeout = 30000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(path, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'X-VN-Client': 'web',
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      let payload = null;
      const text = await response.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { message: text.slice(0, 200) };
        }
      }

      if (!response.ok) {
        throw new VNAuthError((payload && payload.message) || `Erreur ${response.status}`, {
          code: (payload && payload.error) || 'http_error',
          status: response.status,
          details: payload && payload.details
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof VNAuthError) throw error;
      if (error.name === 'AbortError') {
        throw new VNAuthError('Le serveur ne répond pas. Vérifiez votre connexion.', { code: 'timeout' });
      }
      throw new VNAuthError('Connexion au serveur impossible.', { code: 'network' });
    } finally {
      clearTimeout(timer);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  API publique                                                       */
  /* ------------------------------------------------------------------ */

  const VNAuth = {
    VNAuthError,
    get config() {
      return config;
    },
    get ready() {
      return loadConfig().then((value) => VNAuth);
    },
    loadConfig,
    api,
    prehash,

    async register({ email, name, password }) {
      await loadConfig();
      const stretched = await prehash(password);
      return api('/api/auth/register', {
        method: 'POST',
        body: { email, name, password: stretched.value, kdf: stretched.version }
      });
    },

    async login({ email, password }) {
      await loadConfig();
      const stretched = await prehash(password);
      return api('/api/auth/login', {
        method: 'POST',
        body: { email, password: stretched.value, kdf: stretched.version }
      });
    },

    logout() {
      return api('/api/auth/logout', { method: 'POST', body: {} });
    },

    async me() {
      try {
        return await api('/api/auth/me');
      } catch (error) {
        if (error.status === 401) return { authenticated: false };
        throw error;
      }
    },

    async changePassword({ currentPassword, newPassword }) {
      const session = await VNAuth.me();
      if (!session.authenticated) throw new VNAuthError('Session expirée.', { code: 'unauthenticated', status: 401 });
      const current = await prehash(currentPassword);
      const next = await prehash(newPassword);
      return api('/api/auth/password', {
        method: 'POST',
        body: { currentPassword: current.value, newPassword: next.value }
      });
    },

    forgot(email) {
      return api('/api/auth/forgot', { method: 'POST', body: { email } });
    },

    async resetPassword({ token, password }) {
      await loadConfig();
      const stretched = await prehash(password);
      return api('/api/auth/reset', {
        method: 'POST',
        body: { token, password: stretched.value, kdf: stretched.version }
      });
    },

    /** Redirige vers la page de connexion si la session a expiré. */
    async requireSession({ redirect = true } = {}) {
      const session = await VNAuth.me();
      if (!session.authenticated && redirect) {
        const next = encodeURIComponent(location.pathname + location.search);
        location.replace(`/login?next=${next}`);
        return null;
      }
      return session.authenticated ? session : null;
    },

    /** Redirige vers l'accueil si l'utilisateur n'est pas ROOT. */
    async requireRoot() {
      const session = await VNAuth.requireSession();
      if (!session) return null;
      if (!session.root) {
        location.replace('/?refus=root');
        return null;
      }
      return session;
    },

    /* ---------------- Mot de passe : robustesse ---------------- */

    passwordScore(password) {
      const value = String(password || '');
      const checks = {
        length: value.length >= 8,
        long: value.length >= 12,
        lower: /[a-z]/.test(value),
        upper: /[A-Z]/.test(value),
        digit: /\d/.test(value),
        symbol: /[^A-Za-z0-9]/.test(value),
        noRepeat: !/(.)\1{2,}/.test(value)
      };
      let score = 0;
      if (checks.length) score += 1;
      if (checks.lower && checks.upper) score += 1;
      if (checks.digit || checks.symbol) score += 1;
      if (checks.long && (checks.digit || checks.symbol)) score += 1;
      if (value.length >= 16) score += 1;
      if (value.length && !checks.noRepeat) score -= 1;
      score = Math.max(0, Math.min(4, score));
      const labels = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent'];
      return {
        score,
        label: value ? labels[score] : '',
        valid: checks.length && value.length <= 200,
        checks
      };
    }
  };

  window.VNAuth = VNAuth;
})();
