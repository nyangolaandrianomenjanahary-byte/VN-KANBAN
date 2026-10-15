# Déploiement sur Cloudflare — pas à pas

Objectif : mettre VN Kanban en ligne sur votre propre compte Cloudflare, avec sa base de
données, **sans rien payer** (offres gratuites Workers + D1).

Durée : environ 10 minutes.

---

## Prérequis

* Un compte Cloudflare (gratuit) : <https://dash.cloudflare.com/sign-up>
* Node.js 20 ou plus récent : `node --version`
* Le dépôt cloné sur votre machine

---

## Étape 1 — Se connecter à Cloudflare

```bash
npx wrangler login
```

Une page s'ouvre dans le navigateur : cliquez sur **Allow**.
Vérification :

```bash
npx wrangler whoami
```

Vous devez voir votre adresse e-mail.

---

## Étape 2 — Créer la base de données et poser les secrets

```bash
npm run setup
```

Le script enchaîne :

1. **Vérifie** que vous êtes connecté ;
2. **Crée** la base D1 `vn-kanban-db` (ou réutilise celle qui existe) ;
3. **Écrit** son identifiant dans `wrangler.jsonc` (champ `database_id`) ;
4. **Applique** le schéma SQL (tables `users`, `sessions`, `boards`, `audit_log`…) ;
5. **Génère et pose** deux secrets :
   * `PASSWORD_PEPPER` — protège les empreintes de mots de passe ;
   * `ROOT_BOOTSTRAP_TOKEN` — **notez ce jeton**, il sert à créer le compte ROOT.

> Vous pouvez relancer `npm run setup` sans risque : il ne recrée pas ce qui existe déjà.

<details>
<summary>Faire ces étapes à la main (déploiement manuel)</summary>

```bash
npx wrangler d1 create vn-kanban-db
# copiez le database_id affiché dans wrangler.jsonc
npx wrangler d1 migrations apply vn-kanban-db --remote
npx wrangler secret put PASSWORD_PEPPER           # collez une valeur aléatoire de 32+ caractères
npx wrangler secret put ROOT_BOOTSTRAP_TOKEN      # collez un jeton aléatoire
```
</details>

---

## Étape 3 — Mettre en ligne

```bash
npx wrangler deploy
```

À la fin, Wrangler affiche l'adresse de votre application :

```
https://vn-kanban.votre-sous-domaine.workers.dev
```

Ouvrez-la : vous arrivez sur la **page de connexion**.

---

## Étape 4 — Créer le compte ROOT

### Méthode A — depuis le navigateur (la plus simple)

Sur la page de connexion, l'encart bleu indique : « Première installation : le premier
compte créé devient automatiquement le compte ROOT ». Cliquez sur **Créer un compte**,
remplissez le formulaire, validez : vous êtes administrateur et l'application s'ouvre.

### Méthode B — en ligne de commande

Utile pour promouvoir un compte existant ou créer un compte sans passer par le navigateur :

```bash
npm run root:create -- \
  --url https://vn-kanban.votre-sous-domaine.workers.dev \
  --email vous@exemple.com \
  --name "Votre nom"
```

Le script demande le mot de passe (saisie masquée), le transforme localement, puis envoie
le tout avec le jeton d'amorçage. Pensez à passer `ROOT_BOOTSTRAP_TOKEN` :

```bash
export ROOT_BOOTSTRAP_TOKEN=le-jeton-affiché-par-npm-run-setup
# ou : npm run root:create -- --url … --email … --token le-jeton
```

---

## Étape 5 — Verrouiller l'inscription (recommandé)

Une fois votre compte ROOT créé, deux réglages dans `wrangler.jsonc` :

```jsonc
"vars": {
  "FIRST_USER_IS_ROOT": "false",   // plus personne ne devient ROOT en s'inscrivant
  "ALLOW_SIGNUP": "false"          // (facultatif) ferme les inscriptions
}
```

Puis :

```bash
npx wrangler deploy
```

Si vous fermez les inscriptions, créez les comptes suivants depuis la console
d'administration (`/admin` → **+ Nouveau compte**), puis transmettez à chacun un
**lien de réinitialisation** pour qu'il choisisse son mot de passe.

---

## Étape 6 — (Facultatif) La connexion Google

Voir [`GOOGLE-OAUTH.md`](GOOGLE-OAUTH.md). Comptez 5 minutes dans la console Google Cloud.

---

## Étape 7 — (Facultatif) Votre propre nom de domaine

1. Dans le tableau de bord Cloudflare : **Workers & Pages** → votre Worker → **Settings**
   → **Domains & Routes** → **Add** → **Custom domain**.
2. Indiquez par exemple `kanban.mondomaine.com` (le domaine doit être géré par votre
   compte Cloudflare).
3. Mettez à jour la variable `APP_URL` dans `wrangler.jsonc` :

   ```jsonc
   "vars": { "APP_URL": "https://kanban.mondomaine.com" }
   ```
4. Redéployez : `npx wrangler deploy`.
5. Si vous utilisez Google, ajoutez la nouvelle adresse de retour dans Google Cloud :
   `https://kanban.mondomaine.com/api/auth/google/callback`.

---

## Mises à jour ultérieures

```bash
git pull                 # récupérer les nouveautés
npm install              # si des dépendances ont changé
npm run db:migrate:remote  # si de nouvelles migrations sont apparues
npx wrangler deploy
```

---

## Déploiement automatique depuis GitHub (facultatif)

Le dépôt contient `.github/workflows/deploy.yml` : chaque `push` sur `main` peut déployer
automatiquement. Pour l'activer, ajoutez deux secrets dans
**GitHub → Settings → Secrets and variables → Actions** :

| Secret | Où le trouver |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → **My Profile** → **API Tokens** → *Create Token* → modèle « **Edit Cloudflare Workers** » |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages → *Account ID* (colonne de droite) |

Sans ces secrets, le workflow ne fait rien (il ne casse pas vos builds).

---

## Suivre ce qui se passe en production

```bash
npm run logs        # console en direct (wrangler tail)
```

Dans la console d'administration `/admin` :

* **Vue d'ensemble** : nombre de comptes, de tableaux, sessions actives ;
* **Journal** : chaque connexion, échec, inscription et action d'administration.

---

## Coûts

Avec les offres gratuites :

| Ressource | Offre gratuite Cloudflare | Consommation typique de VN Kanban |
|---|---|---|
| Requêtes Worker | 100 000 / jour | quelques dizaines par utilisateur et par jour |
| Temps CPU | 10 ms / requête | ~1 ms (hors hachage : ~4 ms à la connexion) |
| Base D1 | 5 Go, 5 M lignes lues/jour | quelques Ko par utilisateur |
| Fichiers statiques | illimités, non facturés | l'application elle-même |

Autrement dit : **0 €** pour un usage personnel ou une petite équipe. Le seul réglage à
surveiller est `PBKDF2_ITERATIONS` (voir « Dépannage » du README) : à 25 000, la connexion
consomme environ 4 ms de CPU, largement dans la limite des 10 ms.
