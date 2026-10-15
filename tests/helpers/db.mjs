/**
 * Outils communs aux suites de tests.
 *
 * Les tests créent beaucoup de comptes : sans réinitialisation, la limitation
 * de débit (10 inscriptions par heure et par IP) finit par les bloquer. Chaque
 * suite remet donc à zéro les compteurs de la base LOCALE au démarrage.
 *
 * ⚠️ Agit uniquement sur la base locale de développement (--local), jamais sur
 *    la base de production.
 */

import { spawnSync } from 'node:child_process';

const DB_NAME = 'vn-kanban-db';

export function resetRateLimits({ quiet = true } = {}) {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--command', 'DELETE FROM rate_limits;'],
    { encoding: 'utf8', shell: process.platform === 'win32', stdio: quiet ? 'pipe' : 'inherit' }
  );

  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    if (!quiet) console.error(output.slice(0, 400));
    return false;
  }
  return true;
}

/** Vrai si la base locale répond (sinon : migrations non appliquées). */
export function databaseReady() {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--command', 'SELECT COUNT(*) AS n FROM users;'],
    { encoding: 'utf8', shell: process.platform === 'win32', stdio: 'pipe' }
  );
  return result.status === 0;
}
