# VN — Gestion de tâches (Vercel + Supabase)

Application web de gestion de tâches personnelles et professionnelles (**Kanban**, **Calendrier**, **Vue Jour**, **Notes liées** et **Mode Focus / Maintenant**), synchronisée en temps réel via **Supabase** et déployée sur **Vercel**.

## Architecture

- **Application (`index.html` / `public/index.html`)** : interface complète (charte Apple Design System, mode clair/sombre, chronomètres camembert, récurrences, sous-tâches, notes liées).
- **Module Cloud (`src/vn-cloud.js`)** :
  - Authentification **Supabase Auth** (connexion, création de compte, mot de passe oublié, changement de mot de passe).
  - Synchronisation automatique et temps réel (**Supabase Realtime** + `public.workspaces`) des colonnes, cartes, notes et archives par utilisateur.
  - Pastille de compte et indicateur d'état de synchronisation (`Synchronisé`, `Synchronisation…`, `Hors ligne`) dans l'en-tête.
- **Base de données (`supabase/schema.sql`)** :
  - `public.profiles` : profil de chaque utilisateur.
  - `public.workspaces` : état JSONB (`data`, `archive`, `revision`, `initialized`, `device_label`).
  - `public.workspace_events` : historique des événements de synchronisation.
  - Sécurité **Row Level Security (RLS)** stricte (`auth.uid() = user_id`).

## Développement & Build

```bash
# Générer index.html et public/index.html à partir de src/
npm run build
```

Variables d'environnement optionnelles lors du build Vercel :
- `SUPABASE_URL` (par défaut : `https://unqfifaiywxuoqqtunya.supabase.co`)
- `SUPABASE_ANON_KEY` (clé publique `anon` du projet Supabase)
