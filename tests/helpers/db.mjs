/**
 * Outils communs aux suites de tests.
 *
 * Les tests créent beaucoup de comptes et supposent une base déterministe
 * (par exemple : « le premier compte créé devient ROOT »). Chaque suite remet
 * donc à zéro la base LOCALE de développement avant de commencer.
 *
 * ⚠️ N'agit jamais sur la base de production : seules les commandes `--local`
 *    sont utilisées.
 */

import { spawnSync } from 'node:child_process';

const DB_NAME = 'vn-kanban-db';

const TABLES = [
  'sessions',
  'password_resets',
  'boards',
  'audit_log',
  'rate_limits',
  'users'
];

function execute(statements) {
  return spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--command', statements],
    { encoding: 'utf8', shell: process.platform === 'win32', stdio: 'pipe' }
  );
}

/**
 * Vide la base locale (comptes, sessions, tableaux, journal, compteurs de débit).
 * Renvoie false si la base n'est pas accessible (migrations non appliquées).
 */
export function resetLocalDatabase({ quiet = false } = {}) {
  const statements = TABLES.map((table) => `DELETE FROM ${table};`).join(' ');
  const result = execute(statements);

  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    console.error('\u001b[31mImpossible de réinitialiser la base locale.\u001b[0m');
    console.error(output.slice(0, 500));
    console.error('Appliquez d’abord les migrations :  npm run db:migrate');
    return false;
  }
  if (!quiet) console.log('\u001b[2mBase locale réinitialisée (développement).\u001b[0m');
  return true;
}

/** Compatibilité : ancien nom utilisé par certaines suites. */
export const resetRateLimits = () => execute('DELETE FROM rate_limits;').status === 0;

/** Vrai si la base locale répond. */
export function databaseReady() {
  return execute('SELECT COUNT(*) AS n FROM users;').status === 0;
}
