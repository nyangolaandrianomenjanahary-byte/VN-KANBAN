# Feuille de route

État au 15 octobre 2026. Ce document dit **ce qui est fait, ce qui reste, et dans quel
ordre** — sans promettre de fonctionnalité non testée.

---

## ✅ Étape 0 — État des lieux (fait)

* Inventaire de l'application existante : 923 Ko, 18 500 lignes, stockage local + dossier
  Root, aucune authentification, aucun serveur.
* Décisions actées : **tout chez Cloudflare**, base **D1**, le serveur sert l'application,
  les données locales existantes ne sont **jamais** supprimées.

## ✅ Étape 1 — Serveur et base de données (fait)

| Livrable | État |
|---|---|
| Worker Cloudflare (`worker/`) + fichiers statiques (`public/`) | ✅ |
| Schéma D1 versionné : `users`, `sessions`, `boards`, `audit_log`, `password_resets`, `rate_limits`, `settings` | ✅ |
| Routeur d'API, erreurs JSON normalisées, CORS fermé, CSRF (Origin + `X-VN-Client`) | ✅ |
| Limitation de débit par compte et par IP, verrouillage après 8 échecs | ✅ |
| Journal d'audit de toutes les actions sensibles | ✅ |

## ✅ Étape 2 — Connexion e-mail + mot de passe (fait)

* Page `/login` (connexion + inscription), `/reset` (nouveau mot de passe).
* Pré-hachage PBKDF2 210 000 itérations dans le navigateur ; **aucun mot de passe en clair
  ne transite**.
* Côté serveur : HMAC + PBKDF2 (sel par compte), migration transparente des paramètres.
* Sessions `HttpOnly` de 30 jours, prolongation automatique, révocation immédiate.
* Mot de passe oublié : par e-mail (si configuré) **ou** lien généré par le ROOT.
* Verrouillage des pages : `/` exige une session, `/admin` exige le rôle ROOT ou Admin.

## ✅ Étape 3 — Connexion Google (fait)

* OAuth 2.0 + **PKCE S256**, `state` anti-CSRF en cookie `HttpOnly` de 10 minutes.
* Vérification **RS256** de l'`id_token` contre les clés publiques Google (JWKS en cache),
  contrôle `aud`, `iss`, `exp`, `email_verified`.
* Liaison automatique au compte existant de même adresse vérifiée ; jamais de doublon,
  jamais de remplacement de mot de passe.
* Fonctionne sans configuration Google : le bouton est alors remplacé par un message
  explicite (« Google n'est pas encore configuré »).

## ✅ Étape 4 — Synchronisation des tableaux (fait)

* `GET/PUT/DELETE /api/data` avec **numéro de révision** et réponse `409` en cas de conflit.
* Fusion **par identifiant de tâche**, copie de sécurité locale, message à l'utilisateur.
* Envoi regroupé (1,5 s), récupération périodique (25 s) + au retour sur l'onglet/réseau.
* Pastille d'état et menu de compte intégrés à l'application d'origine.
* Limites de taille et de nombre d'éléments contrôlées côté serveur.

## ✅ Étape 5 — Console ROOT (fait)

* Vue d'ensemble (comptes, tableaux, sessions, état de la configuration).
* Comptes : recherche, filtres, création, modification, rôles, suspension, mot de passe
  temporaire, lien de réinitialisation, déconnexion forcée, suppression.
* Tableaux : consultation, téléchargement, remplacement.
* Sauvegarde / restauration complète (sans les mots de passe).
* Journal d'audit filtrable.
* Rôles hiérarchiques : **ROOT** (tout) et **Admin** (lecture seule).

## ✅ Étape 6 — Déploiement et documentation (fait)

* `npm run setup` : base D1, schéma, secrets, en une commande.
* `npm run root:create` : création/promotion du compte ROOT en ligne de commande.
* Documents : `README.md`, `docs/DEPLOIEMENT-CLOUDFLARE.md`, `docs/GOOGLE-OAUTH.md`,
  `docs/ARCHITECTURE.md`, `docs/SECURITE.md`, `docs/SYNCHRONISATION.md`.
* Déploiement automatique GitHub → Cloudflare (facultatif, désactivé sans secrets).
* **211 vérifications automatiques** (180 sans Google, 31 pour le flux Google complet contre un Google simulé).

---

## 🔜 Ce qui peut venir ensuite

Par ordre d'intérêt décroissant, chacune testée avant d'être annoncée :

### 1. Réglages dynamiques (½ journée)
La table `settings` existe déjà mais n'est pas encore éditable. Objectif : depuis la console
ROOT, modifier **sans redéployer** le nom de l'application, l'ouverture des inscriptions, la
durée des sessions, la rétention du journal, le message d'accueil. Techniquement : lire les
réglages au démarrage du Worker, exposer `PUT /api/admin/settings`, ajouter l'onglet
correspondant.

### 2. Deuxième facteur (TOTP) (1 journée)
QR code + vérification à 6 chiffres, codes de secours. Uniquement des primitives WebCrypto,
aucune dépendance. Le champ `must_reset` et la révocation de sessions serviront de base.

### 3. Équipes et partage de tableaux (2–3 jours)
Aujourd'hui un tableau appartient à une personne. Suite logique : table `teams`,
`team_members`, `boards.team_id`, invitation par e-mail, droits lecture/écriture. Les
réponses `409` et la fusion par identifiant sont déjà en place : la base technique est saine.

### 4. Application installable hors ligne (PWA) (½ journée)
Manifeste + service worker : installation comme application, démarrage sans réseau, file
d'attente d'écritures. Le mode local existant rend cette étape simple.

### 5. Pièces jointes (1–2 jours)
R2 (stockage d'objets Cloudflare, offre gratuite : 10 Go) pour joindre des fichiers aux
tâches, avec URL signée et quota par compte. Nécessite une adaptation de l'affichage des
tâches.

### 6. Import / export enrichi (½ journée)
Import CSV/Trello, export PDF du tableau, sauvegarde planifiée (Cron Trigger) qui envoie
l'export dans R2 ou par e-mail.

### 7. Notifications (1 journée)
E-mail « tâches du jour » ou rappel d'échéance via un Cron Trigger et un service d'envoi
(Resend, MailChannels). Nécessite une clé externe, donc hors du périmètre actuel.

---

## Ce qui restera volontairement de côté

| Idée | Pourquoi |
|---|---|
| Vérification d'e-mail à l'inscription | Suppose un service d'envoi payant et alourdit la première expérience. Google fournit déjà une adresse vérifiée pour ceux qui en ont besoin. |
| Chiffrement de bout en bout | Éliminerait la console ROOT (le ROOT ne pourrait plus consulter les tableaux) — contraire à la demande. Peut être proposé **par tableau** plus tard. |
| Application mobile native | La version web est déjà responsive ; une PWA (point 4) couvre 90 % du besoin pour un coût sans commune mesure. |
| Migration vers un serveur dédié | Cloudflare couvre l'usage visé à coût nul. Aucun besoin identifié justifiant de changer. |

---

## Méthode

Chaque étape suit la même règle : **écrire d'abord la vérification automatique, puis le
code**, et ne rien annoncer qui ne soit constaté. Les suites existantes servent de
non-régression :

```bash
npm test              # API + client + pages + intégration (180 vérifications)
npm run test:google   # flux Google (31 vérifications)
```

Un test qui échoue est corrigé — jamais désactivé.
