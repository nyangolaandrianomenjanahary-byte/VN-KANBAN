# VN Kanban

Application Kanban de gestion de tâches — React + Vite, données et photos sur **Supabase**,
hébergée sur **Vercel**.

## Fonctionnalités

- Authentification e-mail / mot de passe (Supabase Auth).
- Tableau Kanban : colonnes renommables, ajout/suppression, glisser-déposer des cartes.
- Tâches : titre, description, priorité, échéance, étiquettes.
- **Photos dans la description** : jusqu'à 12 photos par tâche, glisser-déposer,
  coller (Ctrl+V) ou appareil photo sur mobile. Photo de couverture, légendes,
  aperçu plein écran (flèches clavier), suppression.
- Recherche plein texte, statistiques, interface responsive (mobile → desktop).

## Base de données

Le schéma complet est versionné dans [`supabase/migrations/0001_kanban_with_photos.sql`](supabase/migrations/0001_kanban_with_photos.sql).

| Table | Rôle |
| --- | --- |
| `board_columns` | Colonnes du tableau (par utilisateur) |
| `tasks` | Tâches (description, priorité, échéance, étiquettes, `cover_photo_id`) |
| `task_photos` | Métadonnées des photos : `storage_path`, `url`, dimensions, taille, légende |

Chaque table est protégée par **RLS** (`auth.uid() = user_id`).
Les fichiers sont stockés dans le bucket Storage public `task-photos`,
dans un dossier par utilisateur (`<user_id>/<task_id>/<uuid>.jpg`), avec des
politiques d'écriture limitées au dossier de l'utilisateur.

Les images sont compressées côté navigateur (max 1800 px, JPEG qualité 82)
avant l'envoi, pour rester rapides sur réseau mobile.

## Variables d'environnement

```bash
VITE_SUPABASE_URL=https://unqfifaiywxuoqqtunya.supabase.co
VITE_SUPABASE_ANON_KEY=<clé anon / publishable>
```

En local : copier `.env.example` vers `.env.local`.
Sur Vercel : Project → Settings → Environment Variables (Production + Preview).

## Développement

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
```

## Déploiement Vercel

1. Ouvrir <https://vercel.com/new> et importer le dépôt
   `nyangolaandrianomenjanahary-byte/VN-KANBAN`.
2. Framework détecté : **Vite** — Build `npm run build`, Output `dist`.
3. Ajouter les variables d'environnement (Production + Preview + Development) :

   | Nom | Valeur |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://unqfifaiywxuoqqtunya.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | clé **publishable** du projet Supabase (Settings → API Keys) |

4. Déployer : chaque `git push` sur `main` redéploie automatiquement.

Sans interface Vercel, en ligne de commande :

```bash
npm i -g vercel
vercel link          # crée/associe le projet
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod
```

Une fois l'URL de production connue, l'ajouter dans Supabase
(Authentication → URL Configuration → Redirect URLs) si elle ne finit pas par
`*.vercel.app`.
