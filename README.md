# VN — Gestionnaire de tâches

Interface issue de `VN-Gestionnaire-taches.html`, conservant le Kanban, le calendrier,
les notes, les récurrences et les chronomètres. L'ancien prototype React reste dans
`src/` pour référence ; le point d'entrée actif est `src/cloud.js` et le moteur
historique est `src/legacy/app.js`.

## Nouveautés

- Connexion, inscription et récupération du mot de passe via le service d'authentification.
- Espace privé par utilisateur : tâches, colonnes, notes et archives dans
  `public.vn_workspaces` (RLS). Les anciennes tables ne sont pas supprimées.
- Sauvegarde automatique avec indicateur, reprise réseau et copie locale des
  modifications en attente, isolée par compte. Un conflit de versions ne remplace
  pas silencieusement les données : exporter la copie locale puis recharger.
- Actualisation depuis le serveur toutes les 10 secondes hors édition de formulaire.
- Jusqu'à 12 photos dans la description (JPEG, PNG, WebP, 9 Mo par fichier).
  Upload depuis la création/modification, aperçu sur la carte et dans le détail,
  ouverture grand format. Bucket **privé** `vn-task-images`, accès par URL signée.
- Les photos retirées d'une tâche ou envoyées dans un formulaire annulé restent
  dans le bucket (pas de suppression physique automatique, pour éviter de casser
  une autre référence). Prévoir un nettoyage des fichiers orphelins à terme.

Les archives personnelles intégrées au fichier fourni ne sont pas publiées dans
le bundle et ne sont pas copiées dans les comptes nouvellement créés. L'ancien
stockage local non authentifié et le dossier Root ne sont pas importés automatiquement.
Utiliser l'import de l'application pour reprendre un export JSON de ses données.

## Configuration

La migration `db/migrations/0002_workspace.sql` a été appliquée au projet distant.
Elle ajoute seulement la nouvelle table et le bucket privé.
La migration 0001 concerne l'ancien prototype, pas le nouveau modèle.

La configuration du backend n'est plus écrite dans le code : elle est lue dans
`VITE_BACKEND_URL` et `VITE_BACKEND_KEY` (copiez `.env.example` vers `.env` en
local, et renseignez ces deux variables dans les réglages du projet Vercel).
Ne jamais exposer une clé secrète dans une variable `VITE_*`.

Le service d'authentification doit autoriser le domaine de production dans ses
Redirect URLs.
L'authentification e-mail est déjà active. La configuration existante confirme
immédiatement les inscriptions (pas de validation e-mail imposée). Pour une mise
à disposition publique, activer la confirmation des e-mails et configurer un SMTP.
Les liens de récupération utilisent le domaine courant.

## Développement et vérifications

```sh
npm ci
npm test
npm run build
npm run dev -- --host 0.0.0.0
```

Le test DOM vérifie le démarrage de l'interface fournie, la création d'une tâche
avec métadonnées photo et le formulaire d'édition. Il ne remplace pas les tests
Auth/Storage dans un navigateur connecté : le réseau du sandbox ne permet pas
l'accès direct au domaine du backend. La compilation et l'audit npm sont exécutés.

## Vercel

Projet Vite, build `npm run build`, dossier de sortie `dist`.
La connexion Vercel de cette session ne retourne aucun projet accessible et
refuse la consultation des équipes. Le déploiement de production nécessite une
connexion Vercel autorisée pour l'équipe/projet existant. Aucun nouveau projet
Vercel n'a été créé pour contourner ce blocage.
