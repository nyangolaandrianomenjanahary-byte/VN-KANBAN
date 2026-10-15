#!/usr/bin/env node
/**
 * Vide la base D1 LOCALE (développement et tests uniquement).
 *
 *   node scripts/db-reset.mjs            → vide tout sauf les réglages
 *   node scripts/db-reset.mjs --remote   → ⚠️ vide aussi la base de PRODUCTION
 *
 * Sans argument, la commande n'agit que sur la base locale de développement.
 */

import { spawnSync } from 'node:child_process';

const remote = process.argv.includes('--remote');

if (remote) {
  console.error('\u001b[31mRefus d’agir sur la base distante sans confirmation explicite.\u001b[0m');
  console.error('Pour vider la base de PRODUCTION, utilisez directement :');
  console.error('  npx wrangler d1 execute vn-kanban-db --remote --command "DELETE FROM users;"');
  process.exit(1);
}

const statements = [
  'DELETE FROM sessions;',
  'DELETE FROM password_resets;',
  'DELETE FROM boards;',
  'DELETE FROM audit_log;',
  'DELETE FROM rate_limits;',
  'DELETE FROM users;'
].join(' ');

const args = ['wrangler', 'd1', 'execute', 'vn-kanban-db', '--local', '--command', statements];

console.log('Vidage de la base D1 locale…');
const result = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });

if (result.status !== 0) {
  console.error('\u001b[31mLe vidage de la base a échoué.\u001b[0m');
  process.exit(result.status ?? 1);
}
console.log('\u001b[32mBase locale vidée : aucun compte, aucun tableau.\u001b[0m');
