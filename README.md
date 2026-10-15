# VN — Kanban avec comptes, Google et base de données ☁️

Application de gestion de tâches **VN** (celle de `VN-Gestionnaire-taches.html`), désormais
équipée d'une **authentification**, d'une **base de données en ligne** et d'une **console
d'administration ROOT**. Tout tourne chez Cloudflare (Worker + D1 = SQLite hébergée),
sur l'offre **gratuite**.

| | |
|---|---|
| **Connexion** | E-mail + mot de passe **et** Google (OAuth 2.0 + PKCE) |
| **Base de données** | Cloudflare D1 (SQLite) — comptes, sessions, tâches, journal d'audit |
| **Rôle ROOT** | Console complète : comptes, rôles, suspensions, tableaux, sauvegardes, journal |
| **Synchronisation** | Automatique (1,5 s après une modification) + récupération multi-appareil |
| **Hors ligne** | Toujours possible (dossier Root local ou localStorage, comme avant) |
| **Tests** | 208 vérifications automatiques, dont le flux Google complet |

---

## 1. Démarrage en 5 minutes (sur votre ordinateur)

```bash
npm install                 # installe Wrangler
npm run db:migrate          # crée la base SQLite locale
npm run dev                 # démarre sur http://localhost:8787
```

Ouvrez **http://localhost:8787** → vous êtes redirigé vers la page de connexion.
Comme la base est vide, le message « **le premier compte créé devient ROOT** » s'affiche :
créez votre compte, il sera automatiquement administrateur.

> 💡 En local, la connexion Google est facultative : l'e-mail + mot de passe suffit.
> Pour la tester aussi, voir `docs/GOOGLE-OAUTH.md` (les adresses `http://localhost`
> sont acceptées par Google).

---

## 2. Mettre en ligne sur Cloudflare (≈ 10 minutes)

```bash
npx wrangler login          # ouvre le navigateur pour autoriser Wrangler
npm run setup               # crée la base D1, applique le schéma, pose les secrets
npx wrangler deploy         # met l'application en ligne
```

`npm run setup` vous affiche à la fin :

* l'adresse de votre application (`https://vn-kanban.<votre-sous-domaine>.workers.dev`) ;
* un **jeton d'amorçage** (`ROOT_BOOTSTRAP_TOKEN`) à conserver pour créer le compte ROOT.

Ensuite, deux façons de créer le compte ROOT :

1. **Le plus simple** — ouvrez votre application et créez le premier compte depuis la page
   d'inscription : il devient ROOT automatiquement.
2. **En ligne de commande** (si un compte existe déjà et que vous voulez le promouvoir) :

   ```bash
   npm run root:create -- --url https://vn-kanban.xxx.workers.dev --email vous@exemple.com
   ```

> ⚠️ Après la création du compte ROOT, passez `FIRST_USER_IS_ROOT` à `"false"` dans
> `wrangler.jsonc` puis relancez `npx wrangler deploy` : ainsi, plus personne ne peut
> devenir administrateur en s'inscrivant.

📖 **Guide détaillé, écran par écran : [`docs/DEPLOIEMENT-CLOUDFLARE.md`](docs/DEPLOIEMENT-CLOUDFLARE.md)**
📖 **Google OAuth pas à pas : [`docs/GOOGLE-OAUTH.md`](docs/GOOGLE-OAUTH.md)**

---

## 3. Ce que fait l'application

### Connexion

* **E-mail + mot de passe** : 8 caractères minimum, indicateur de robustesse, « Verr. Maj »
  détecté, message d'erreur explicite.
* **Google** : bouton « Continuer avec Google ». Si un compte existe déjà avec la même
  adresse, les deux méthodes sont **fusionnées automatiquement** (pas de doublon).
* **Sessions** : cookie `HttpOnly` (inaccessible au JavaScript), 30 jours, prolongation
  automatique, révocation immédiate à la déconnexion ou à la suspension d'un compte.
* **Mot de passe oublié** : soit par e-mail (si `RESEND_API_KEY` est configuré), soit via un
  **lien de réinitialisation** généré par le ROOT depuis la console (fonctionne sans
  service d'e-mail). Le lien est à usage unique et expire en 24 h.

### Le compte ROOT (console `/admin`)

| Onglet | Contenu |
|---|---|
| **Vue d'ensemble** | Nombre de comptes, de tableaux, de sessions actives, état de la configuration (Google, poivre, e-mails) |
| **Comptes** | Recherche, filtres, création, modification (nom, e-mail, rôle, statut), mot de passe temporaire, lien de réinitialisation, déconnexion forcée, suppression |
| **Sauvegarde** | Export complet en JSON (comptes + tableaux, **sans les mots de passe**) et restauration |
| **Journal** | Toutes les connexions, échecs, inscriptions, actions d'administration, avec IP et date |

Deux niveaux de droits :

* **ROOT** — contrôle total ;
* **Admin** — consultation seule (statistiques, comptes, journal).

### Synchronisation des tâches

* Chaque utilisateur possède **son tableau** dans la table `boards` (JSON complet v8 :
  colonnes, tâches, notes, archive).
* Toute modification de l'application est envoyée **1,5 s après la dernière frappe**.
* Les changements faits sur un autre appareil sont récupérés automatiquement
  (toutes les 25 s, au retour sur l'onglet, à la reconnexion réseau).
* **Conflit** (deux appareils modifient en même temps) : les deux versions sont **fusionnées**
  par identifiant de tâche — aucune tâche n'est perdue — et une copie de sécurité reste dans
  le navigateur. Voir `docs/SYNCHRONISATION.md`.
* **Mode hors ligne conservé** : si l'API n'est pas joignable (ou si vous ouvrez le fichier
  HTML directement), l'application démarre exactement comme avant, avec le dossier Root ou
  le stockage local.

---

## 4. Architecture

```
                     ┌──────────────────────────────────────────┐
   Navigateur  ───▶  │  Cloudflare Worker « vn-kanban »          │
                     │                                          │
   index.html        │   /api/auth/*    connexion, Google, …     │
   login  ─────────▶ │   /api/data      synchronisation Kanban   │
   admin             │   /api/admin/*   console ROOT             │
                     │   /api/setup/*   amorçage du compte ROOT  │
                     │              │                            │
                     └──────────────┼────────────────────────────┘
                                    ▼
                            ┌──────────────┐
                            │  D1 (SQLite) │  users · sessions · boards
                            └──────────────┘  audit_log · password_resets
```

* Les fichiers statiques (`index.html`, `login.html`, `admin.html`…) sont servis
  **directement par Cloudflare** : ils ne consomment aucun temps CPU du Worker
  (`assets.run_worker_first = ["/api/*"]`).
* Seules les routes `/api/*` exécutent du code.

### Structure du dépôt

```
public/                 application servie par Cloudflare
  index.html            l'application Kanban (votre fichier d'origine + intégration)
  login.html  reset.html  admin.html
  js/vn-auth.js         bibliothèque cliente (pré-hachage, appels API)
  js/vn-cloud.js        pont application ↔ serveur (session, sync, pastille de compte)
  js/vn-login.js  js/vn-reset.js  js/vn-admin.js
  css/vn-auth.css       styles des écrans d'authentification et de la console
  _headers              en-têtes de sécurité
worker/
  index.js              routeur de l'API
  lib/{crypto,session,db,utils,google}.js
  routes/{auth,data,admin,setup}.js
migrations/0001_init.sql  schéma de la base
scripts/                setup-cloudflare, create-root, db-reset
tests/                  smoke, client-lib, pages, app-integration, google-oauth
docs/                   déploiement, Google, sécurité, synchronisation
```

---

## 5. Tests

```bash
npm test              # 177 vérifications (API + bibliothèque client + pages + intégration)
npm run test:google   # 31 vérifications du flux Google (avec un Google simulé)
```

| Suite | Ce qui est vérifié |
|---|---|
| `tests/smoke.mjs` | Inscription, connexion, sessions, verrouillage anti-force brute, CSRF, synchronisation, conflits, console ROOT, sauvegarde/restauration, réinitialisation, amorçage |
| `tests/client-lib.mjs` | La **vraie** bibliothèque du navigateur : pré-hachage PBKDF2, gestion des erreurs, redirections |
| `tests/pages.mjs` | Les pages réelles dans jsdom (DOM) : formulaires, onglets, messages d'erreur, changement de mot de passe, console d'administration |
| `tests/app-integration.mjs` | L'application complète : démarrage avec session, chargement de la base serveur, envoi automatique, récupération distante, résolution de conflit |
| `tests/google-oauth.mjs` | Flux Google complet avec un faux serveur Google : PKCE, état anti-CSRF, vérification RS256, création/liaison de compte, rejet des jetons falsifiés |

Les tests supposent que `npm run dev` tourne dans un autre terminal.
`npm test` vide d'abord la base **locale** (jamais la base distante).

---

## 6. Sécurité (résumé)

* **Le mot de passe n'est jamais transmis.** Il est transformé dans le navigateur
  (PBKDF2-SHA256, 210 000 itérations) ; le serveur ne reçoit qu'une empreinte.
* **Côté serveur**, cette empreinte est « poivrée » avec un secret (`PASSWORD_PEPPER`)
  puis hachée à nouveau avec un **sel aléatoire par utilisateur**. Une fuite de la base
  ne permet donc pas de tester des mots de passe hors ligne.
* **Sessions** stockées hachées (SHA-256) : un vol de la base ne permet pas de rejouer une
  session. Cookie `HttpOnly` + `SameSite=Lax` + `Secure` en HTTPS.
* **CSRF** : en-tête `Origin` vérifié + en-tête personnalisé exigé sur toute écriture,
  aucune origine tierce autorisée en CORS.
* **Limitation de débit** : par compte et par adresse IP (connexions, inscriptions,
  réinitialisations, amorçage) ; verrouillage temporaire après 8 échecs.
* **Jetons** de réinitialisation : aléatoires (256 bits), stockés hachés, à usage unique.
* **Pas d'énumération de comptes** : les messages d'erreur et les temps de réponse sont
  identiques, que le compte existe ou non.
* **Journal d'audit** de toutes les actions sensibles.

Détails et limites : [`docs/SECURITE.md`](docs/SECURITE.md).

---

## 7. Commandes utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement local (http://localhost:8787) |
| `npm run setup` | Installation guidée Cloudflare (base, schéma, secrets) |
| `npm run deploy` | Mise en production |
| `npm run db:migrate` / `db:migrate:remote` | Applique le schéma en local / en production |
| `npm run db:users` | Liste les comptes de la base locale |
| `npm run db:reset` | Vide la base **locale** (développement) |
| `npm run root:create -- --url … --email …` | Crée ou promeut le compte ROOT |
| `npm run logs` | Journal en direct du Worker en production (`wrangler tail`) |
| `npm test` / `npm run test:google` | Suites de tests |

---

## 8. Dépannage

**« Erreur 1102 : Worker exceeded CPU time limit »**
Votre compte est sur l'offre gratuite (10 ms de CPU par requête). Baissez
`PBKDF2_ITERATIONS` (par exemple `"10000"`) dans `wrangler.jsonc` et redéployez. Le
navigateur continue d'appliquer ses 210 000 itérations : la protection reste solide.

**Le bouton Google affiche « Google non configuré »**
Les secrets `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` ne sont pas posés :
`npx wrangler secret put GOOGLE_CLIENT_ID` (voir `docs/GOOGLE-OAUTH.md`).

**`redirect_uri_mismatch` chez Google**
L'adresse de retour déclarée dans Google Cloud doit correspondre **exactement** à
`https://votre-app.workers.dev/api/auth/google/callback`.

**« Aucun compte ROOT n'existe »**
À la première installation, le premier compte créé devient ROOT. Si un autre compte a été
créé avant le vôtre, utilisez `npm run root:create` avec le jeton d'amorçage.

**Les tâches ne se synchronisent pas**
Ouvrez le menu de la pastille de compte (en haut à droite) : il indique « Synchronisé »,
« Enregistrement en cours… », « Hors ligne » ou l'erreur exacte. Le bouton
« Synchroniser maintenant » force un aller-retour.

**Je veux repartir de zéro**
`npm run db:reset` (local). Pour la production, utilisez la sauvegarde de la console ROOT
avant toute opération destructive.

---

## 9. Reprendre le fichier HTML seul

`public/index.html` reste une application autonome : ouvert directement depuis votre
disque (`file://`), il fonctionne comme avant, avec le dossier Root et le stockage local.
La couche Cloud s'active uniquement lorsque la page est servie par le Worker.

---

## Licence et données

Vos données restent chez vous : elles sont stockées dans **votre** base Cloudflare D1.
Aucun service tiers n'est appelé, hormis Google (si vous activez la connexion Google) et,
si vous le configurez, votre service d'envoi d'e-mails.
