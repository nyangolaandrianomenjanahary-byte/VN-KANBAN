# Synchronisation : comment vos tâches circulent

L'application VN existait en version « un seul appareil » : les données vivaient dans un
**dossier Root** (File System Access) ou dans le **stockage local** du navigateur. Cette
version ajoute une **base de données en ligne** — sans rien retirer de l'existant.

---

## Les trois modes, dans l'ordre de priorité

| Situation | Comportement |
|---|---|
| **Connecté, servie par Cloudflare** | Les données viennent de la base D1 ; chaque modification est envoyée automatiquement ; les autres appareils se synchronisent tout seuls |
| **Non connecté** | Redirection vers `/login`. Une fois la session ouverte, retour à l'application |
| **Fichier ouvert directement (`file://`) ou API injoignable** | Mode historique : dossier Root ou stockage local, exactement comme avant |

> Rien n'est effacé localement : le navigateur conserve toujours sa copie
> (`kanban-data`, `kanban-archive`). Si le serveur disparaît, vos tâches restent lisibles.

---

## Ce qui déclenche un envoi

| Événement | Délai |
|---|---|
| Modification d'une tâche, d'une note, d'une colonne, d'un déplacement | 1,5 s après la dernière action (regroupement) |
| Changement d'onglet, fermeture de page | Envoi immédiat (si des modifications sont en attente) |
| Bouton « Synchroniser maintenant » | Immédiat |

## Ce qui déclenche une récupération

| Événement | Délai |
|---|---|
| Périodique | Toutes les 25 s |
| Retour sur l'onglet | Immédiat |
| Retour du réseau (`online`) | Immédiat |
| Après un conflit | Immédiat |

Chaque réponse contient un **numéro de révision**. Si le serveur annonce une révision
différente de celle connue localement, l'application recharge et redessine : vous voyez
donc rapidement les modifications faites ailleurs.

---

## Conflits : deux appareils modifient en même temps

L'envoi transporte le numéro de révision attendu (`PUT /api/data`). Si quelqu'un d'autre a
écrit entre-temps, le serveur répond **`409`** avec sa version.

L'application ne remplace alors **jamais** brutalement vos données : elle **fusionne**.

1. Pour chaque tâche, note, colonne et archive, la comparaison se fait **par identifiant**.
2. S'il n'y a pas de doublon : union des deux ensembles (rien n'est perdu).
3. Si l'identifiant existe des deux côtés : la version dont la date de modification est la
   plus récente gagne ; à date égale, celle du serveur.
4. La fusion est immédiatement renvoyée au serveur.
5. Une copie de la version locale est conservée dans le navigateur sous
   `vn-cloud-conflict-backup` (récupérable depuis la console du navigateur en cas de doute).
6. Un message vous informe : « Conflit résolu : les modifications des deux appareils ont
   été conservées. »

Vous pouvez vérifier l'état à tout moment dans la console du navigateur :

```js
VNCloud.status      // 'idle' | 'saving' | 'syncing' | 'offline' | 'error'
VNCloud.revision    // numéro de révision connu
VNCloud.stats       // { saves, pulls, conflicts, errors }
```

---

## La pastille de compte (en haut à droite)

| Couleur | Signification |
|---|---|
| 🟢 **Synchronisé** | Tout est enregistré sur le serveur |
| 🔵 **Enregistrement…** | Modification en cours d'envoi |
| 🟠 **Hors ligne** | Le serveur n'est pas joignable ; vos modifications restent locales et partiront au retour du réseau |
| 🔴 **Erreur** | Un problème persiste (message affiché) ; utilisez « Synchroniser maintenant » |

Le menu de la pastille donne accès à :

* l'adresse du compte connecté et son rôle ;
* **Synchroniser maintenant** — force un aller-retour ;
* **Mon dossier Root…** — reprend le mode local/dossier (les deux fonctionnent en parallèle) ;
* **Console d'administration** — visible seulement pour ROOT et Admin ;
* **Changer mon mot de passe** ;
* **Se déconnecter**.

---

## Import et export

* **Export local** : les fonctions d'origine de l'application (export JSON, sauvegarde du
  dossier Root) restent disponibles dans ses menus.
* **Export serveur** : console ROOT → onglet **Sauvegarde** → télécharge un JSON contenant
  les comptes (sans les mots de passe) et **tous** les tableaux.
* **Restauration serveur** : même onglet, sélection du fichier JSON. Les comptes existants
  ne sont pas écrasés, les tableaux sont fusionnés.
* **Récupérer un tableau isolé** : console ROOT → **Comptes** → icône « tableau » →
  télécharger / remplacer le tableau d'un utilisateur.

---

## Détails techniques utiles

* Limite de taille : 2,5 Mo par envoi (au-delà : message d'erreur explicite, pas de perte).
* L'octet de révision est incrémenté côté serveur à chaque écriture acceptée.
* Les écritures sont sérialisées dans l'application (`fileIOQueue`) : deux enregistrements
  concurrents ne partent jamais en même temps.
* Le serveur ne connaît que le JSON du tableau ; il ne l'interprète pas, il le stocke.
* Aucune donnée n'est envoyée à un tiers : uniquement vers votre Worker Cloudflare.
