-- ============================================================================
--  VN Kanban — Schéma de base de données (Cloudflare D1 / SQLite)
--  Appliqué par : npm run db:migrate            (base locale de développement)
--                 npm run db:migrate:remote     (base Cloudflare de production)
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Utilisateurs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,                 -- UUID v4
  email           TEXT NOT NULL UNIQUE,             -- toujours en minuscules
  name            TEXT,
  picture         TEXT,                             -- avatar (comptes Google)
  role            TEXT NOT NULL DEFAULT 'user',     -- 'root' | 'admin' | 'user'
  status          TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'suspended'
  provider        TEXT NOT NULL DEFAULT 'email',    -- 'email' | 'google' | 'email+google'
  google_sub      TEXT UNIQUE,                      -- identifiant Google (sub)
  email_verified  INTEGER NOT NULL DEFAULT 0,
  password_hash   TEXT,                             -- NULL pour un compte 100 % Google
  password_kdf    TEXT,                             -- version du pré-hachage client ('v1')
  password_at     INTEGER,                          -- date du dernier changement
  must_reset      INTEGER NOT NULL DEFAULT 0,       -- mot de passe imposé au prochain login
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    INTEGER,
  last_login_at   INTEGER,
  last_login_ip   TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- ---------------------------------------------------------------------------
--  Sessions (le jeton est stocké HACHÉ : une fuite de la base ne permet pas
--  de rejouer une session)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                     -- SHA-256 du jeton
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at  INTEGER,
  user_agent  TEXT,
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- ---------------------------------------------------------------------------
--  Tableau Kanban de chaque utilisateur (la « base ROOT » côté serveur)
--  data / archive contiennent le JSON complet au format v8 de l'application.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boards (
  user_id     TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  archive     TEXT NOT NULL DEFAULT '[]',
  revision    INTEGER NOT NULL DEFAULT 1,           -- verrou optimiste anti-écrasement
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT
);

-- ---------------------------------------------------------------------------
--  Journal d'audit (console ROOT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  actor_id    TEXT,
  actor_email TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  details     TEXT,
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at DESC);

-- ---------------------------------------------------------------------------
--  Limitation de débit (connexions et réinitialisations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  key         TEXT PRIMARY KEY,                     -- ex. 'login:ip:1.2.3.4'
  count       INTEGER NOT NULL DEFAULT 0,
  window_at   INTEGER NOT NULL,                     -- début de la fenêtre
  blocked_until INTEGER
);

-- ---------------------------------------------------------------------------
--  Jetons de réinitialisation de mot de passe (stockés hachés)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  requested_ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets (user_id);

-- ---------------------------------------------------------------------------
--  Réglages applicatifs (clé/valeur, pilotés depuis la console ROOT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at INTEGER
);

INSERT INTO settings (key, value, updated_at)
VALUES ('schema_version', '1', strftime('%s','now') * 1000)
ON CONFLICT (key) DO NOTHING;
