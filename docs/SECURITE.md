# Sécurité — choix techniques et limites

Ce document explique **pourquoi** l'application est construite ainsi, et ce qu'elle ne
couvre pas. Il s'adresse autant à l'utilisateur qui déploie qu'à un relecteur technique.

---

## 1. Les mots de passe ne circulent jamais en clair

Le navigateur applique **avant tout envoi** :

```
empreinte = base64( PBKDF2-SHA256( motDePasse, sel = "vn-kanban-auth-v1|prehash", 210 000 itérations ) )
```

Le corps de la requête ne contient que cette empreinte (`kdf: "v1"` accompagne la valeur
pour permettre les évolutions futures).

**Conséquences :**

* Le mot de passe réel n'existe ni dans les journaux du Worker, ni dans la base, ni dans
  un éventuel accès réseau compromis.
* Un attaquant qui volerait la base **ne peut pas** tester directement « azerty123 » : il
  doit d'abord recalculer l'empreinte PBKDF2 (210 000 itérations) de chaque candidat.
  Le coût par tentative est donc **au moins** celui du navigateur, en plus du coût serveur.

**Pourquoi un pré-hachage ?** Cloudflare Workers plafonne PBKDF2 à 100 000 itérations et
l'offre gratuite limite chaque requête à 10 ms de CPU : le coût maximal acceptable côté
serveur (~25 000 itérations ≈ 4 ms) serait trop faible seul. En déplaçant l'essentiel du
calcul dans le navigateur et en ajoutant une seconde couche côté serveur, on obtient
**235 000 itérations cumulées** sans dépasser les limites de l'offre gratuite.

Références : [limite PBKDF2 des Workers](https://community.cloudflare.com/t/long-running-webcrypto-api/90953),
[modèle sel + poivre](https://flaviocopes.com/native-email-password-authentication-cloudflare-workers/).

---

## 2. Stockage des empreintes côté serveur

```
verifier = pbkdf2-sha256$v1$<itérations>$<sel aléatoire 16 o>$<hash 32 o>
```

1. L'empreinte reçue est d'abord transformée par **HMAC-SHA256** avec le secret
   `PASSWORD_PEPPER` (le « poivre ») ;
2. puis hachée par **PBKDF2-SHA256** (25 000 itérations) avec un **sel aléatoire propre à
   chaque compte**.

Le poivre est un secret Cloudflare (`wrangler secret`), absent de la base : même avec un
export complet de D1, un attaquant ne peut pas casser les empreintes sans lui. Le numéro
de version (`v1`) et le nombre d'itérations sont stockés avec l'empreinte, ce qui permet
de renforcer les paramètres plus tard **sans invalider les comptes existants** : à la
prochaine connexion réussie, l'empreinte est recalculée automatiquement avec les
paramètres courants (migration transparente).

Comparaison en **temps constant** pour éviter les attaques par mesure de durée.

---

## 3. Sessions

| | |
|---|---|
| Jeton | 32 octets aléatoires (CSPRNG), base64url |
| Stockage | **SHA-256 du jeton** uniquement — le jeton en clair n'est jamais écrit |
| Transport | Cookie `vn_session` : `HttpOnly`, `SameSite=Lax`, `Secure`, `Path=/`, 30 jours |
| Révocation | Déconnexion, changement de mot de passe, « Déconnecter partout », suppression ou suspension du compte |
| Empreinte | Adresse IP et navigateur enregistrés pour la traçabilité (pas de blocage) |

Un vol de la base ne permet donc **pas** de rejouer une session. Le cookie `HttpOnly`
n'est pas lisible par JavaScript : une faille XSS ne peut pas l'exfiltrer.

---

## 4. Protection CSRF

L'application n'accepte de requêtes que si :

1. l'en-tête `Origin` correspond à l'origine de la requête ou à `APP_URL` ;
2. l'en-tête `X-VN-Client: web` (ou `cli`) est présent — en-tête personnalisé qu'un
   formulaire HTML ou une balise `<img>` d'un site tiers ne peut pas produire ;
3. **CORS n'autorise aucune origine tierce** : nous ne renvoyons pas
   `Access-Control-Allow-Origin: *`.

Les requêtes `OPTIONS` reçoivent une réponse minimale. Les cookies sont `SameSite=Lax`,
ce qui bloque déjà l'envoi lors d'une requête POST inter-site.

---

## 5. Limitation de débit et anti-force brute

| Action | Limite | Portée |
|---|---|---|
| Inscription | 10 / heure | IP |
| Connexion | 30 / 15 min | IP |
| Connexion | 10 / 15 min | compte |
| Mot de passe oublié | 8 / heure | IP |
| Réinitialisation | 20 / heure | IP |
| Amorçage ROOT | 10 / heure | IP |

La limitation intervient **avant** tout calcul de hachage, pour qu'un attaquant ne puisse
pas utiliser l'endpoint comme un amplificateur de calcul. Après 8 échecs consécutifs, le
compte est verrouillé 15 minutes (réponse `423`), et un échec ne révèle jamais si l'adresse
existe : le même message et le même temps de réponse sont renvoyés dans tous les cas.

*Limite connue* : les compteurs sont stockés dans D1, donc partagés par tous les nœuds —
ce qui est correct — mais l'écriture d'un compteur consomme une requête D1. C'est le prix
d'une limitation exacte sans service payant.

---

## 6. Jetons à usage unique

* **Réinitialisation de mot de passe** : 32 octets aléatoires, stockés **hachés**,
  valables 24 h, invalidés dès la première utilisation. Toutes les sessions du compte sont
  révoquées après le changement de mot de passe.
* **État OAuth (`state`)** et **PKCE (`code_verifier`)** : aléatoires, conservés 10 minutes
  dans un cookie `HttpOnly`, vérifiés en temps constant au retour de Google.
* **Jeton d'amorçage ROOT** (`ROOT_BOOTSTRAP_TOKEN`) : secret Cloudflare, jamais stocké en
  base, comparé en temps constant, limité à 10 tentatives par heure et par IP. S'il n'est
  pas configuré, l'endpoint `/api/setup/root` répond `403 bootstrap_disabled` — donc
  aucune porte dérobée sur une installation qui ne l'a pas explicitement activée.
* **Première installation** : le premier compte créé devient ROOT (comportement documenté,
  désactivable par `FIRST_USER_IS_ROOT=false`). Créez ce compte immédiatement après le
  déploiement, puis passez le réglage à `false` et redéployez.

---

## 7. Validation des données

* **E-mails** : format vérifié côté serveur, normalisés en minuscules, longueur bornée ;
* **Corps des requêtes** : limite de 2,5 Mo (les tableaux volumineux sont refusés avec un
  message explicite plutôt que de saturer la base) ;
* **JSON** : taille et structure contrôlées (`columns`, `cards`, `notes`, `archive`) avant
  écriture ; les chaînes ne sont jamais interprétées comme du HTML côté serveur ;
* **Affichage** : l'application échappe les contenus utilisateur ; la console ROOT
  construit le DOM par `textContent`, jamais par `innerHTML` avec des données distantes ;
* **Injection SQL** : impossible, toutes les requêtes utilisent des requêtes préparées
  (`prepare().bind()`).

---

## 8. Google OAuth

* `id_token` vérifié cryptographiquement (RS256) contre les clés publiques de Google,
  mises en cache ; `aud`, `iss`, `exp` contrôlés ; l'adresse doit être **vérifiée** par
  Google (`email_verified = true`) ;
* le `client_secret` ne quitte jamais le Worker ;
* scope minimal : `openid email profile` (aucun accès aux e-mails, fichiers ou agenda) ;
* la liaison de comptes se fait **par adresse vérifiée** : un compte existant est fusionné,
  jamais dupliqué, et Google ne peut pas remplacer un mot de passe existant.

---

## 9. Journal d'audit

Chaque action sensible est enregistrée dans `audit_log` : inscription, connexion réussie ou
refusée, déconnexion, changement de mot de passe, création/suspension/suppression de
compte, modification de rôle, génération de lien de réinitialisation, export et
restauration de sauvegarde, amorçage ROOT. Sont conservés : date, acteur, action, cible,
détails et IP. Le journal est consultable par le ROOT, et **exportable** dans la sauvegarde.

---

## 10. Ce que cette application ne fait pas

Par honnêteté, voici les limites assumées :

* **Pas de second facteur (2FA)** — non demandé, et les offres gratuites Cloudflare
  n'embarquent pas de TOTP ; l'ajout est possible plus tard (TOTP en pur JS).
* **Pas de vérification d'e-mail à l'inscription** — l'application fait confiance à
  l'adresse saisie ; elle devient un moyen d'identification, pas une preuve d'identité.
  La connexion Google, elle, exige une adresse **vérifiée par Google**.
* **Pas de chiffrement de bout en bout** — les données sont lisibles par Cloudflare (comme
  tout hébergeur) et par le ROOT, qui peut consulter les tableaux.
* **Pas de protection anti-DDoS au niveau applicatif** — Cloudflare en assure une partie
  automatiquement ; les limites applicatives décrites plus haut couvrent le reste.
* **Pas de récupération de compte sans ROOT ni e-mail** — sans `RESEND_API_KEY`, seul le
  ROOT peut générer un lien de réinitialisation. C'est un choix volontaire : mieux vaut
  aucun mécanisme qu'un mécanisme faux.
* **Aucun secret dans le dépôt** — `.dev.vars`, `.env` et `.wrangler/` sont ignorés par Git.
  Les secrets de production vivent dans Cloudflare (`wrangler secret`).

---

## 11. Vérifier soi-même

```bash
npm test                # 177 vérifications, dont force brute, CSRF, conflits, ROOT
npm run test:google     # 31 vérifications : PKCE, état, signature RS256, jetons falsifiés
```

Les tests couvrent notamment :

* un mot de passe erroné ne révèle pas l'existence du compte ;
* un jeton de session volé **ne peut pas** être forgé (comparaison en temps constant) ;
* un `id_token` Google dont la signature est modifiée est **rejeté** ;
* un `state` OAuth non reçu est **rejeté** ;
* un compte non-ROOT est **refusé** sur les routes d'administration ;
* un compte suspendu est **déconnecté** immédiatement ;
* une écriture avec un numéro de révision périmé **ne détruit pas** les données ;
* un compte tout neuf démarre sur un **tableau vierge** (aucune donnée de démonstration recopiée) ;
* après un changement de mot de passe, **les autres sessions sont révoquées**, la sienne reste ouverte.
