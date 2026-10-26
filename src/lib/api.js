import { PHOTO_BUCKET, supabase } from './supabase'
import { prepareImage } from './images'

/* ============================================================
   BOARD / COLUMNS
   ============================================================ */
export async function fetchColumns(userId) {
  const { data, error } = await supabase
    .from('board_columns')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) throw error

  if (data.length > 0) return data

  // Filet de sécurité si le trigger de création de compte n'a pas tourné.
  const defaults = [
    { user_id: userId, title: 'À faire', accent: 'navy', position: 0, is_done: false },
    { user_id: userId, title: 'En cours', accent: 'amber', position: 1, is_done: false },
    { user_id: userId, title: 'En révision', accent: 'teal', position: 2, is_done: false },
    { user_id: userId, title: 'Terminé', accent: 'green', position: 3, is_done: true },
  ]
  const { data: created, error: insertError } = await supabase
    .from('board_columns')
    .insert(defaults)
    .select()
  if (insertError) throw insertError
  return created
}

export async function createColumn(userId, { title, accent, position }) {
  const { data, error } = await supabase
    .from('board_columns')
    .insert({ user_id: userId, title, accent, position })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateColumn(id, patch) {
  const { data, error } = await supabase
    .from('board_columns')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteColumn(id) {
  const { error } = await supabase.from('board_columns').delete().eq('id', id)
  if (error) throw error
}

/* ============================================================
   TASKS
   ============================================================ */
const TASK_SELECT = [
  'id, user_id, column_id, title, description, priority, due_date, labels,',
  'position, completed_at, cover_photo_id, created_at, updated_at,',
  'photos:task_photos (id, task_id, url, storage_path, file_name, mime_type,',
  'size_bytes, width, height, caption, position, created_at)',
]
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim()

function sortTask(task) {
  return {
    ...task,
    photos: (task.photos || []).slice().sort((a, b) => a.position - b.position),
  }
}

export async function fetchTasks(userId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) throw error
  return data.map(sortTask)
}

export async function createTask(userId, task) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, user_id: userId })
    .select(TASK_SELECT)
    .single()
  if (error) throw error
  return sortTask(data)
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select(TASK_SELECT)
    .single()
  if (error) throw error
  return sortTask(data)
}

export async function deleteTask(id) {
  const { data: photos } = await supabase
    .from('task_photos')
    .select('storage_path')
    .eq('task_id', id)
  if (photos?.length) {
    await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path))
  }
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function persistTaskOrder(updates) {
  // updates: [{ id, column_id, position, completed_at }]
  const results = await Promise.all(
    updates.map(({ id, ...patch }) => supabase.from('tasks').update(patch).eq('id', id)),
  )
  const failure = results.find((r) => r.error)
  if (failure) throw failure.error
}

/* ============================================================
   PHOTOS
   ============================================================ */
export async function uploadTaskPhoto(userId, taskId, file, position = 0) {
  const prepared = await prepareImage(file)
  const path = `${userId}/${taskId}/${crypto.randomUUID()}.${prepared.extension}`

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, prepared.blob, {
      contentType: prepared.mimeType,
      cacheControl: '31536000',
      upsert: false,
    })
  if (uploadError) throw uploadError

  const { data: publicUrl } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .from('task_photos')
    .insert({
      task_id: taskId,
      user_id: userId,
      storage_path: path,
      url: publicUrl.publicUrl,
      file_name: file.name,
      mime_type: prepared.mimeType,
      size_bytes: prepared.blob.size,
      width: prepared.width,
      height: prepared.height,
      position,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path])
    throw error
  }
  return data
}

export async function updatePhoto(id, patch) {
  const { data, error } = await supabase
    .from('task_photos')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePhoto(photo) {
  const { error } = await supabase.from('task_photos').delete().eq('id', photo.id)
  if (error) throw error
  if (photo.storage_path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
  }
}
