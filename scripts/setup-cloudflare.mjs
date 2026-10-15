#!/usr/bin/env node
/**
 * Installation guidée sur Cloudflare.
 *
 *   npm run setup
 *
 * Étapes automatisées :
 *   1. vérification de la connexion à Cloudflare (wrangler login) ;
 *   2. création de la base D1 « vn-kanban-db » si nécessaire ;
 *   3. écriture du database_id dans wrangler.jsonc ;
 *   4. application du schéma SQL sur la base distante ;
 *   5. génération et pose des secrets PASSWORD_PEPPER et ROOT_BOOTSTRAP_TOKEN ;
 *   6. rappel des étapes restantes (déploiement, compte ROOT, Google).
 *
 * Le script ne déploie rien : il ne touche à votre compte Cloudflare qu'après
 * vous avoir dit ce qu'il fait.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

const DB_NAME = 'vn-kanban-db';
const CONFIG = 'wrangler.jsonc';

const c = {
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`
};

function step(number, title) {
  console.log(`\n${c.bold(`${number}. ${title}`)}`);
}

function run(args, options = {}) {
  return spawnSync('npx', args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options
  });
}

function fail(message, hint) {
  console.error(`\n${c.red(message)}`);
  if (hint) console.error(hint);
  process.exit(1);
}

function readConfig() {
  return readFileSync(CONFIG, 'utf8');
}

function writeDatabaseId(id) {
  const text = readConfig();
  const updated = text.replace(/("database_id"\s*:\s*")[^"]*(")/, `$1${id}$2`);
  if (updated === text) fail(`Impossible d’écrire database_id dans ${CONFIG}.`);
  writeFileSync(CONFIG, updated, 'utf8');
}

function currentDatabaseId() {
  const match = readConfig().match(/"database_id"\s*:\s*"([^"]+)"/);
  return match ? match[1] : '';
}

function isPlaceholder(id) {
  return !id || /REMPLACER|PLACEHOLDER|VOTRE/i.test(id);
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(c.bold('\nVN Kanban — installation sur Cloudflare\n'));

  /* ---------------- 1. Connexion ---------------- */
  step(1, 'Vérification de la connexion Cloudflare');
  const whoami = run(['wrangler', 'whoami']);
  const output = `${whoami.stdout || ''}${whoami.stderr || ''}`;
  if (whoami.status !== 0 || /not authenticated/i.test(output)) {
    fail(
      'Vous n’êtes pas connecté à Cloudflare.',
      `Lancez d’abord :\n  npx wrangler login\n\n${c.dim('(ouvre votre navigateur pour autoriser Wrangler)')}`
    );
  }
  const account = (output.match(/associated with the email\s+(\S+)/i) || output.match(/^\s*([^\s]+@[^\s]+)\s*$/m) || [])[1];
  console.log(`  Connecté${account ? ` en tant que ${c.green(account)}` : ''}.`);

  /* ---------------- 2. Base D1 ---------------- */
  step(2, `Base de données D1 « ${DB_NAME} »`);
  let databaseId = currentDatabaseId();
  const alreadyConfigured = !isPlaceholder(databaseId);

  if (alreadyConfigured) {
    console.log(`  Déjà configurée dans ${CONFIG} : ${c.dim(databaseId)}`);
  } else {
    const list = run(['wrangler', 'd1', 'list', '--json']);
    let found = null;
    if (list.status === 0 && list.stdout) {
      try {
        const databases = JSON.parse(list.stdout);
        found = databases.find((db) => db.name === DB_NAME) || null;
      } catch {
        /* la sortie n'est pas du JSON : on continue avec la création */
      }
    }

    if (found && found.uuid) {
      databaseId = found.uuid;
      console.log(`  Base existante trouvée : ${c.dim(databaseId)}`);
    } else {
      console.log(`  Création de la base…`);
      const create = run(['wrangler', 'd1', 'create', DB_NAME]);
      const createOutput = `${create.stdout || ''}${create.stderr || ''}`;
      if (create.status !== 0) {
        fail('Création de la base impossible.', createOutput.slice(0, 600));
      }
      const uuid = (createOutput.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0];
      if (!uuid) {
        fail(
          'Identifiant de base introuvable dans la réponse de Wrangler.',
          `Copiez l’identifiant manuellement dans ${CONFIG} (champ database_id).\n\n${createOutput.slice(0, 600)}`
        );
      }
      databaseId = uuid;
      console.log(`  Base créée : ${c.dim(databaseId)}`);
    }

    writeDatabaseId(databaseId);
    console.log(`  ${c.green('✓')} database_id écrit dans ${CONFIG}`);
  }

  /* ---------------- 3. Schéma ---------------- */
  step(3, 'Application du schéma (tables users, sessions, boards…)');
  const migrate = run(['wrangler', 'd1', 'migrations', 'apply', DB_NAME, '--remote'], { stdio: 'inherit' });
  if (migrate.status !== 0) {
    fail(
      'Application du schéma impossible.',
      'Vérifiez les droits de votre compte et relancez « npx wrangler d1 migrations apply ' + DB_NAME + ' --remote ».'
    );
  }
  console.log(`  ${c.green('✓')} base structurée.`);

  /* ---------------- 4. Secrets ---------------- */
  step(4, 'Secrets de sécurité');
  const pepper = randomBytes(48).toString('base64');
  const bootstrap = randomBytes(24).toString('hex');

  const pepperResult = run(['wrangler', 'secret', 'put', 'PASSWORD_PEPPER'], { input: `${pepper}\n` });
  if (pepperResult.status === 0) console.log(`  ${c.green('✓')} PASSWORD_PEPPER défini (mots de passe « poivrés »).`);
  else console.log(`  ${c.yellow('!')} PASSWORD_PEPPER non défini — relancez : npx wrangler secret put PASSWORD_PEPPER`);

  const bootstrapResult = run(['wrangler', 'secret', 'put', 'ROOT_BOOTSTRAP_TOKEN'], { input: `${bootstrap}\n` });
  if (bootstrapResult.status === 0) {
    console.log(`  ${c.green('✓')} ROOT_BOOTSTRAP_TOKEN défini.`);
    console.log(`\n  ${c.yellow('Jeton d’amorçage (notez-le, il permet de créer le compte ROOT) :')}`);
    console.log(`  ${c.bold(bootstrap)}\n`);
  } else {
    console.log(`  ${c.yellow('!')} ROOT_BOOTSTRAP_TOKEN non défini — relancez : npx wrangler secret put ROOT_BOOTSTRAP_TOKEN`);
  }

  /* ---------------- 5. Suite ---------------- */
  console.log(c.bold('\nTerminé. Étapes suivantes :\n'));
  console.log('  1. Déployer l’application :');
  console.log(`     ${c.dim('npx wrangler deploy')}`);
  console.log('  2. Créer le compte ROOT (deux possibilités) :');
  console.log(`     ${c.dim('• dans le navigateur : le PREMIER compte créé devient ROOT')}`);
  console.log(
    `     ${c.dim('• en ligne de commande : npm run root:create -- --url https://votre-app.workers.dev --email vous@exemple.com')}`
  );
  console.log('  3. Activer la connexion Google (facultatif) : voir docs/GOOGLE-OAUTH.md');
  console.log('  4. Après création du compte ROOT, passer FIRST_USER_IS_ROOT à "false" dans wrangler.jsonc puis redéployer.\n');
}

main().catch((error) => {
  console.error(c.red('\nErreur inattendue :'), error);
  process.exit(1);
});
