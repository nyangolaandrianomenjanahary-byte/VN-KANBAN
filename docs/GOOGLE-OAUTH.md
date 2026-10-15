# Connexion Google — guide pas à pas

Vous n'avez **rien à installer** : Google fournit gratuitement les identifiants nécessaires.
Comptez 5 minutes. L'application fonctionne déjà sans Google (e-mail + mot de passe) ;
ce guide ajoute simplement le bouton « Continuer avec Google ».

---

## Ce que vous allez obtenir

Un **identifiant client** (public) et un **secret** (privé) :

```
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
```

---

## Étape 1 — Créer un projet Google Cloud

1. Allez sur <https://console.cloud.google.com/>.
2. Connectez-vous avec votre compte Google.
3. En haut, cliquez sur le sélecteur de projet → **Nouveau projet**.
4. Nom : `VN Kanban` → **Créer** (patientez quelques secondes).
5. Vérifiez que le projet sélectionné en haut est bien **VN Kanban**.

---

## Étape 2 — Configurer l'écran de consentement

1. Menu ☰ → **API et services** → **Écran de consentement OAuth**.
2. Type d'utilisateur : **Externe** → **Créer**.
3. Remplissez :
   * **Nom de l'application** : `VN Kanban`
   * **E-mail d'assistance** : votre adresse
   * **Coordonnées du développeur** : votre adresse
4. **Enregistrer et continuer** → sur les écrans *Autorisations* et *Utilisateurs tests*,
   cliquez à nouveau **Enregistrer et continuer** (rien à remplir).
5. Pour publier l'application (nécessaire au-delà de 100 utilisateurs) : retournez sur
   l'écran de consentement → **Publier l'application** → **Confirmer**.
   * En mode « Test », seules les adresses listées dans *Utilisateurs tests* peuvent se
     connecter. Pour un usage personnel : ajoutez simplement votre adresse et sautez
     la publication.

---

## Étape 3 — Créer les identifiants

1. Menu ☰ → **API et services** → **Identifiants**.
2. **Créer des identifiants** → **ID client OAuth**.
3. **Type d'application** : **Application Web**.
4. **Nom** : `VN Kanban Web`.
5. **URI de redirection autorisés** — cliquez sur **Ajouter un URI** et collez, en
   remplaçant `votre-app.workers.dev` par votre adresse réelle :

   ```
   https://vn-kanban.votre-app.workers.dev/api/auth/google/callback
   ```

   Pour tester aussi en local, ajoutez une seconde ligne :

   ```
   http://localhost:8787/api/auth/google/callback
   ```

   > L'adresse doit correspondre **au caractère près** : `https`, le chemin
   > `/api/auth/google/callback`, pas de `/` final.

6. **Créer**. Une fenêtre affiche vos deux identifiants → **copiez la valeur du secret
   immédiatement** (elle ne sera plus affichée en entier).

---

## Étape 4 — Enregistrer les identifiants dans Cloudflare

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
# collez l'identifiant, validez avec Entrée

npx wrangler secret put GOOGLE_CLIENT_SECRET
# collez le secret, validez avec Entrée
```

Pour le développement local, créez un fichier `.dev.vars` à la racine :

```ini
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
```

*(`.dev.vars` est ignoré par Git : vos secrets ne partiront jamais sur GitHub.)*

---

## Étape 5 — Redéployer et vérifier

```bash
npx wrangler deploy
```

Ouvrez la page de connexion : le bouton **Continuer avec Google** doit apparaître en noir.

L'état est visible à tout moment sans se connecter :

```bash
curl https://vn-kanban.votre-app.workers.dev/api/setup/status
```

```json
{ "installed": true, "userCount": 3, "googleConfigured": true, ... }
```

`googleConfigured` doit passer à `true`.

---

## Erreurs fréquentes

| Message | Cause | Solution |
|---|---|---|
| `Erreur 400 : redirect_uri_mismatch` | L'adresse de retour ne correspond pas | Recopiez exactement `https://VOTRE-ADRESSE/api/auth/google/callback` dans Google Cloud → Identifiants → votre ID client |
| `Erreur 403 : access_denied` | Application en mode « Test » | Ajoutez votre adresse dans *Utilisateurs tests*, ou publiez l'application |
| `google_not_configured` | Secrets absents | Reprenez l'étape 4, puis redéployez |
| `invalid_client` | Secret incorrect ou révoqué | Régénérez le secret dans Google Cloud et reposez-le |
| Le bouton n'apparaît pas | La page est en cache | Rechargez avec **Ctrl+Maj+R** |
| `state_mismatch` | Cookies bloqués / onglet resté ouvert trop longtemps | Autorisez les cookies pour le site et recommencez la connexion |

---

## Fonctionnement (pour information)

1. **Clic sur le bouton** → le Worker génère un `state` aléatoire (anti-CSRF) et un
   `code_verifier` (PKCE S256), les place dans un cookie `HttpOnly` de 10 minutes, puis
   redirige vers Google.
2. **Google authentifie l'utilisateur** et renvoie un code sur
   `/api/auth/google/callback`.
3. **Le Worker** vérifie le `state`, échange le code contre un `id_token` (avec le secret
   et le `code_verifier` — aucun secret ne transite par le navigateur), puis **valide la
   signature RS256** de l'`id_token` contre les clés publiques de Google
   (`https://www.googleapis.com/oauth2/v3/certs`).
4. **Contrôles** : `aud` = votre identifiant client, `iss` = Google, `exp` non expiré,
   **`email_verified` = true**.
5. **Compte** : s'il existe déjà avec cette adresse, les deux méthodes de connexion sont
   fusionnées (Google ne remplace jamais un mot de passe existant) ; sinon le compte est
   créé. Une session `HttpOnly` est ouverte et l'utilisateur revient sur l'application.

Aucun mot de passe Google ne nous parvient, et nous ne demandons aucun accès à Gmail,
Drive ou Agenda : uniquement `openid email profile`.
