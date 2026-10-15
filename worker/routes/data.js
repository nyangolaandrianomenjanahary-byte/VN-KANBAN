/**
 * Synchronisation de la base Kanban de l'utilisateur connecté.
 *   GET /api/data   → version serveur (données + archive + révision)
 *   PUT /api/data   → enregistrement avec verrou optimiste
 *   GET /api/data/history?limit=10  → dernières sauvegardes (journal)
 */

import { HttpError, clientIp, json, readJson } from '../lib/utils.js';
import { audit, getBoard, saveBoard } from '../lib/db.js';
import { currentSession } from '../lib/session.js';

const MAX_CARDS = 5000;
const MAX_NOTES = 2000;

function validatePayload(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_payload', `Données ${label} invalides.`);
  }
  return value;
}

function sanitizeBoardData(data) {
  const clean = validatePayload(data, 'du tableau');
  if (!Array.isArray(clean.columns)) clean.columns = [];
  if (!Array.isArray(clean.cards)) clean.cards = [];
  if (!Array.isArray(clean.notes)) clean.notes = [];
  if (clean.cards.length > MAX_CARDS) {
    throw new HttpError(413, 'too_many_cards', `Trop de tâches (${MAX_CARDS} maximum) pour la synchronisation.`);
  }
  if (clean.notes.length > MAX_NOTES) {
    throw new HttpError(413, 'too_many_notes', `Trop de notes (${MAX_NOTES} maximum) pour la synchronisation.`);
  }
  return clean;
}

function sanitizeArchive(archive) {
  if (archive === undefined || archive === null) return [];
  if (!Array.isArray(archive)) throw new HttpError(400, 'invalid_payload', 'Archive invalide.');
  return archive.slice(0, 2000);
}

export async function getData(env, request) {
  const session = await currentSession(env, request);
  if (!session) throw new HttpError(401, 'unauthenticated', 'Vous devez être connecté.');

  const board = await getBoard(env, session.user.id);
  if (!board) {
    return json({
      exists: false,
      revision: 0,
      data: null,
      archive: [],
      updatedAt: null,
      user: { id: session.user.id, email: session.user.email }
    });
  }

  let data = null;
  try {
    data = JSON.parse(board.data);
  } catch {
    data = null;
  }

  return json({
    exists: true,
    revision: board.revision,
    updatedAt: board.updated_at,
    size: board.size_bytes,
    data,
    archive: safeParseArray(board.archive),
    user: { id: session.user.id, email: session.user.email }
  });
}

function safeParseArray(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function putData(env, request) {
  const session = await currentSession(env, request);
  if (!session) throw new HttpError(401, 'unauthenticated', 'Vous devez être connecté.');

  const body = await readJson(request, 2_500_000);
  const data = sanitizeBoardData(body.data);
  const archive = sanitizeArchive(body.archive);
  const baseRevision = body.revision === undefined || body.revision === null ? null : Number(body.revision);

  const result = await saveBoard(env, session.user.id, {
    data,
    archive,
    baseRevision,
    updatedBy: session.user.id
  });

  if (result.conflict) {
    // Un autre appareil a écrit entre-temps : le client reçoit la version
    // serveur et décide de fusionner plutôt que d'écraser.
    return json(
      {
        error: 'conflict',
        message: 'Une version plus récente existe sur le serveur.',
        revision: result.revision,
        updatedAt: result.updatedAt,
        data: JSON.parse(result.data),
        archive: safeParseArray(result.archive)
      },
      409
    );
  }

  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'data.save',
    target: session.user.id,
    details: `révision ${result.revision} — ${data.cards.length} tâche(s)`,
    ip: clientIp(request)
  });

  return json({ ok: true, revision: result.revision, updatedAt: result.updatedAt });
}

export async function deleteData(env, request) {
  const session = await currentSession(env, request);
  if (!session) throw new HttpError(401, 'unauthenticated', 'Vous devez être connecté.');

  const emptyBoard = {
    version: 8,
    columns: [
      { id: 1, title: 'Hier', color: '#FF9500' },
      { id: 2, title: "Aujourd'hui", color: '#0071E3' },
      { id: 3, title: 'Dans la semaine', color: '#5856D6' },
      { id: 4, title: 'Mois prochain', color: '#AF52DE' },
      { id: 5, title: 'Terminé', color: '#34C759' }
    ],
    cards: [],
    notes: [],
    nextNoteId: 1,
    nextColumnId: 6,
    nextCardId: 1
  };

  await saveBoard(env, session.user.id, { data: emptyBoard, archive: [], baseRevision: null, updatedBy: session.user.id });
  await audit(env, {
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: 'data.reset',
    target: session.user.id,
    ip: clientIp(request)
  });
  return json({ ok: true });
}
