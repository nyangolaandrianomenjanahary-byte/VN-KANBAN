#!/usr/bin/env node
/**
 * Création (ou promotion) du compte ROOT sur une installation déjà déployée.
 *
 *   node scripts/create-root.mjs --url https://vn-kanban.xxx.workers.dev \
 *        --email moi@exemple.com --name "Mon nom"
 *
 * Le mot de passe est demandé de façon masquée, transformé dans ce script
 * (PBKDF2 210 000 itérations, exactement comme dans le navigateur) puis envoyé
 * avec le jeton d'amorçage. Aucun mot de passe en clair ne quitte la machine.
 *
 * Options :
 *   --url <adresse>        adresse de l'application (ou variable APP_URL)
 *   --email <adresse>      compte à créer/promouvoir
 *   --password <mdp>       évite la saisie interactive (déconseillé : visible
 *                          dans l'historique du shell)
 *   --name <nom>           nom affiché
 *   --token <jeton>        ROOT_BOOTSTRAP_TOKEN (ou variable du même nom)
 *   --promote              promeut un compte existant sans changer le mot de passe
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { prehashFor } from './lib/prehash.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : true;
};

const url = String(flag('url') || process.env.APP_URL || '').replace(/\/+$/, '');
const promoteOnly = !!flag('promote');

function fail(message, hint) {
  console.error(`\n\u001b[31m${message}\u001b[0m`);
  if (hint) console.error(hint);
  process.exit(1);
}

async function askHidden(question) {
  // Saisie masquée simple, sans dépendance externe.
  if (!stdin.isTTY) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(`${question} (visible, entrée non interactive) : `);
    rl.close();
    return answer.trim();
  }
  stdout.write(`${question} : `);
  return new Promise((resolve) => {
    let value = '';
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (chunk) => {
      const text = chunk.toString('utf8');
      for (const char of text) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(wasRaw);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
      stdout.write('\u001b[2K\r' + question + ' : ' + '*'.repeat(value.length));
    };
    stdin.on('data', onData);
  });
}

async function main() {
  console.log('\u001b[1mVN Kanban — création du compte ROOT\u001b[0m\n');

  if (!url) {
    fail(
      'Adresse de l’application manquante.',
      'Indiquez-la avec --url https://votre-app.workers.dev (ou la variable APP_URL).'
    );
  }

  let email = flag('email') || process.env.ROOT_EMAIL;
  let name = flag('name');
  let password = typeof flag('password') === 'string' ? flag('password') : undefined;
  let token = flag('token') || process.env.ROOT_BOOTSTRAP_TOKEN;

  const rl = createInterface({ input: stdin, output: stdout });

  // État de l'installation
  let status;
  try {
    const response = await fetch(`${url}/api/setup/status`);
    status = await response.json();
  } catch (error) {
    fail(`Impossible de joindre ${url} : ${error.message}`, 'Vérifiez l’adresse et que le déploiement est terminé.');
  }

  console.log(`Application      : ${status.appName} (${url})`);
  console.log(`Comptes existants: ${status.userCount} — comptes ROOT : ${status.rootCount}`);
  console.log(`Amorçage         : ${status.bootstrapEnabled ? 'activé ✓' : 'DÉSACTIVÉ ✗'}`);
  if (!status.bootstrapEnabled) {
    console.log(
      '\n\u001b[33mPour activer l’amorçage sur le serveur :\u001b[0m\n' +
        '  npx wrangler secret put ROOT_BOOTSTRAP_TOKEN\n' +
        'puis relancez ce script avec le même jeton (--token ou ROOT_BOOTSTRAP_TOKEN).\n'
    );
    rl.close();
    process.exit(1);
  }

  if (!token) {
    token = (await askHidden('Jeton d’amorçage (ROOT_BOOTSTRAP_TOKEN)')).trim();
  }
  if (!email) {
    email = (await rl.question('Adresse e-mail du compte ROOT : ')).trim();
  }
  if (!name) {
    name = (await rl.question('Nom affiché (facultatif) : ')).trim();
  }

  if (!promoteOnly && !password) {
    password = (await askHidden('Mot de passe (8 caractères minimum)')).trim();
    const confirmation = (await askHidden('Confirmez le mot de passe')).trim();
    if (password !== confirmation) fail('Les deux mots de passe ne correspondent pas.');
  }

  if (!email) fail('Adresse e-mail obligatoire.');
  if (!promoteOnly && (!password || password.length < 8)) fail('Le mot de passe doit contenir au moins 8 caractères.');

  rl.close();

  console.log('\nTransformation du mot de passe (PBKDF2, 210 000 itérations)…');
  const body = { email, name: name || undefined, promoteOnly };
  if (password) {
    // prehashFor() renvoie directement l'empreinte base64url attendue par l'API,
    // exactement comme le fait le navigateur.
    body.password = await prehashFor(password);
  }

  console.log('Envoi au serveur…');
  let result;
  try {
    const response = await fetch(`${url}/api/setup/root`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VN-Client': 'cli',
        'X-Setup-Token': token
      },
      body: JSON.stringify(body)
    });
    result = await response.json();
    if (!response.ok) {
      fail(`Échec (${response.status}) : ${result.message || 'erreur inconnue'}`);
    }
  } catch (error) {
    fail(`Envoi impossible : ${error.message}`);
  }

  console.log(`\n\u001b[32m${result.message}\u001b[0m`);
  console.log(`  Compte : ${result.user.email}`);
  console.log(`  Rôle   : ${result.user.role}`);
  console.log(`\nConnectez-vous sur ${url}/login`);
  console.log('Pensez ensuite à passer FIRST_USER_IS_ROOT à « false » dans wrangler.jsonc.\n');
}

main().catch((error) => {
  console.error('\u001b[31mErreur inattendue :\u001b[0m', error);
  process.exit(1);
});
