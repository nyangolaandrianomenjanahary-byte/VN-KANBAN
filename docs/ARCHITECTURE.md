# Architecture et base de données

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────┐
│  NAVIGATEUR                                                          │
│                                                                      │
│  login.html / reset.html / admin.html / index.html                   │
│      │            │              │             │                     │
│      └────────────┴──────┬───────┴─────────────┘                     │
│                          │                                           │
│                  js/vn-auth.js   (pré-hachage PBKDF2, appels API)    │
│                  js/vn-cloud.js  (session, synchro, pastille compte) │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ HTTPS · cookies HttpOnly · JSON
┌──────────────────────────▼───────────────────────────────────────────┐
│  CLOUDFLARE                                                          │
│                                                                      │
│  ┌── Fichiers statiques (gratuits, sans CPU) ─────────────────────┐  │
│  │  index.html · login.html · admin.html · css · js · favicon     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌── Worker « vn-kanban » (uniquement /api/*) ────────────────────┐  │
│  │                                                                 │  │
│  │  index.js      routeur, CORS/CSRF, sécurité, erreurs JSON       │  │
│  │  routes/auth   register · login · logout · me · google · reset  │  │
│  │  routes/data   GET/PUT/DELETE /api/data  (tableau Kanban)       │  │
│  │  routes/admin  stats · comptes · tableaux · sauvegarde · journal│  │
│  │  routes/setup  état d'installation · amorçage ROOT              │  │
│  │                                                                 │  │
│  │  lib/crypto    PBKDF2, HMAC, SHA-256, comparaison temps constant│  │
│  │  lib/session   création/vérification/révocation des sessions    │  │
│  │  lib/db        requêtes D1 préparées                            │  │
│  │  lib/google    OAuth 2.0 + PKCE, vérification RS256 de l'id_token│ │
│  └────────┬────────────────────────────────────────────────────────┘  │
│           │                                                          │
│  ┌────────▼──────────────┐        ┌──────────────────────────────┐   │
│  │  D1 « vn-kanban-db »  │        │  Secrets Cloudflare          │   │
│  │  (SQLite hébergée)    │        │  PASSWORD_PEPPER             │   │
│  │  users · sessions     │        │  ROOT_BOOTSTRAP_TOKEN        │   │
│  │  boards · audit_log   │        │  GOOGLE_CLIENT_ID/SECRET     │   │
│  │  password_resets      │        │  RESEND_API_KEY              │   │
│  └───────────────────────┘        └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Pourquoi cette forme ?

* **Un seul Worker sert l'application et l'API** → même origine, donc cookies `HttpOnly`
  utilisables directement, aucun problème de CORS, et une seule adresse à retenir.
* **Les fichiers statiques ne consomment pas de CPU** (`assets.run_worker_first = ["/api/*"]`)
  → l'application reste dans l'offre gratuite même avec beaucoup de visites.
* **D1 (SQLite)** → base relationnelle, transactions, aucune facturation à la connexion,
  sauvegarde en un `SELECT` (l'export de la console ROOT).
* **Aucune dépendance externe** dans le code serveur : WebCrypto pour les hachages, `fetch`
  pour Google. Rien à mettre à jour, aucune faille transitive.

---

## Base de données

### `users` — les comptes

| Colonne | Type | Rôle |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `email` | TEXT UNIQUE | identifiant de connexion (minuscules) |
| `email_verified` | INTEGER | 1 si vérifié par Google |
| `name` | TEXT | nom affiché |
| `password_hash` | TEXT | `pbkdf2-sha256$v1$itérations$sel$hash`, **NULL** si compte Google seul |
| `google_sub` | TEXT UNIQUE | identifiant Google (`sub`), **NULL** sinon |
| `picture` | TEXT | photo de profil (URL Google) |
| `role` | TEXT | `root` \| `admin` \| `user` |
| `status` | TEXT | `active` \| `suspended` |
| `created_at`, `updated_at`, `last_login_at` | INTEGER | horodatages (ms) |
| `failed_attempts`, `locked_until` | INTEGER | anti-force brute |
| `must_reset` | INTEGER | 1 → changement de mot de passe demandé |

### `sessions` — les connexions ouvertes

| Colonne | Rôle |
|---|---|
| `id` | **SHA-256 du jeton** (le jeton en clair n'est jamais stocké) |
| `user_id` | compte concerné (`ON DELETE CASCADE`) |
| `created_at`, `expires_at`, `renewed_at` | durée de vie (30 j, prolongée à l'usage) |
| `ip`, `user_agent` | traçabilité |
| `revoked_at` | révocation immédiate (déconnexion, suspension…) |

### `boards` — les tableaux Kanban

| Colonne | Rôle |
|---|---|
| `user_id` | PK, propriétaire (`ON DELETE CASCADE`) |
| `data` | JSON v8 complet : `{ columns, cards, notes, nextColumnId, nextCardId, nextNoteId }` |
| `archive` | JSON des tâches archivées |
| `revision` | compteur incrémenté à chaque écriture → détection de conflit |
| `updated_at` | date de dernière modification |

### `audit_log` — le journal

`id`, `at`, `actor_id`, `actor_email`, `action`, `target`, `details`, `ip`.
Indexé par date et par action. Jamais modifié, seulement ajouté et purgé par le ROOT.

### `password_resets` — jetons de réinitialisation

`token_hash` (PK), `user_id`, `expires_at` (24 h), `used_at`, `created_at`, `ip`.

### `rate_limits` — compteurs anti-abus

`key` (ex. `login:ip:1.2.3.4`, `register:ip:…`), `count`, `window_start`, `expires_at`.

### `settings` — réglages du ROOT

`key`, `value`, `updated_at`, `updated_by`. Réserve pour les réglages modifiables à chaud
(nom de l'application, fermeture des inscriptions, rétention du journal) — voir la feuille
de route, étape « réglages dynamiques ».

### Relations

```
users 1 ──── n sessions        (suppression du compte → sessions supprimées)
users 1 ──── 1 boards          (un tableau par personne)
users 1 ──── n password_resets
users 1 ──── n audit_log       (par actor_id, sans contrainte : le journal survit)
```

---

## Flux d'une connexion e-mail

```
1. L'utilisateur saisit e-mail + mot de passe
2. vn-auth.js : PBKDF2-SHA256(mot de passe, 210 000)      ~150–400 ms (navigateur)
3. POST /api/auth/login  { email, password: <empreinte>, kdf: "v1" }
4. Worker : limite de débit (compte + IP)                  avant tout calcul
5. Worker : HMAC-SHA256(empreinte, PASSWORD_PEPPER) → PBKDF2(25 000, sel du compte)
6. Comparaison en temps constant  →  succès / échec générique
7. Succès : session créée (jeton aléatoire, stocké haché), cookie HttpOnly posé
           empreinte recalculée si les paramètres ont changé, journal mis à jour
8. Le navigateur suit la redirection vers /                ~300 ms au total
```

## Flux d'une synchronisation

```
Modification dans l'application
   → saveState()  (identique à avant : dossier Root ou localStorage)
   → VNCloud.planifier()  (regroupement de 1,5 s)
   → PUT /api/data { revision, data, archive }
        ├─ 200 : nouveau numéro de révision
        └─ 409 : le serveur renvoie sa version → fusion par identifiant de tâche
                 (la plus récente gagne), renvoi immédiat, copie de sécurité locale

Toutes les 25 s, au retour sur l'onglet, au retour du réseau :
   → GET /api/data  → si la révision a changé, recharge et redessine
```

---

## Fichiers et responsabilités

| Fichier | Rôle |
|---|---|
| `worker/index.js` | Routeur : table de routes, gestion CORS/CSRF, format d'erreur JSON unique |
| `worker/lib/utils.js` | Réponses JSON, cookies, lecture de corps bornée, validation e-mail |
| `worker/lib/crypto.js` | PBKDF2, HMAC, SHA-256, base64url, comparaison en temps constant |
| `worker/lib/db.js` | Toutes les requêtes D1 (aucune requête dans les routes) |
| `worker/lib/session.js` | Création/vérification/prolongation/révocation des sessions |
| `worker/lib/google.js` | URL d'autorisation, échange de code, vérification RS256 + JWKS |
| `public/js/vn-auth.js` | Bibliothèque cliente : pré-hachage, appels, redirections |
| `public/js/vn-cloud.js` | Pont avec l'application d'origine : session, synchro, pastille |
| `migrations/*.sql` | Schéma versionné, appliqué par `wrangler d1 migrations apply` |
