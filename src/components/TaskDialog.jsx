import { useEffect, useMemo, useRef, useState } from 'react'
import PhotoDropzone from './PhotoDropzone'
import { formatBytes } from '../lib/images'
import {
  createTask,
  deletePhoto,
  deleteTask,
  updatePhoto,
  updateTask,
  uploadTaskPhoto,
} from '../lib/api'
import { PRIORITIES } from '../lib/supabase'

const MAX_PHOTOS = 12
const MAX_FILE_SIZE = 9 * 1024 * 1024

function emptyForm(defaultColumnId) {
  return {
    title: '',
    description: '',
    priority: 'normal',
    due_date: '',
    column_id: defaultColumnId || '',
    labels: [],
  }
}

export default function TaskDialog({
  user,
  task,
  defaultColumnId,
  columns,
  onClose,
  onSaved,
  onDeleted,
  notify,
  onOpenPhoto,
  nextPosition,
}) {
  const isEdit = Boolean(task?.id)
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          title: task.title || '',
          description: task.description || '',
          priority: task.priority || 'normal',
          due_date: task.due_date || '',
          column_id: task.column_id,
          labels: task.labels || [],
        }
      : emptyForm(defaultColumnId),
  )
  const [labelDraft, setLabelDraft] = useState('')
  const [photos, setPhotos] = useState(task?.photos || [])
  const [coverId, setCoverId] = useState(task?.cover_photo_id || task?.photos?.[0]?.id || null)
  const [pending, setPending] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef(null)
  const pendingRef = useRef(pending)

  pendingRef.current = pending

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  useEffect(
    () => () => {
      pendingRef.current.forEach((item) => URL.revokeObjectURL(item.preview))
    },
    [],
  )

  const columnOptions = useMemo(
    () => columns.map((column) => ({ value: column.id, label: column.title })),
    [columns],
  )

  function patch(values) {
    setForm((prev) => ({ ...prev, ...values }))
  }

  function addLabel() {
    const value = labelDraft.trim()
    if (!value) return
    if (!form.labels.includes(value)) patch({ labels: [...form.labels, value] })
    setLabelDraft('')
  }

  function validateFiles(files) {
    const accepted = []
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        notify(`« ${file.name} » dépasse 9 Mo.`, 'error')
        continue
      }
      if (photos.length + pending.length + accepted.length >= MAX_PHOTOS) {
        notify(`Maximum ${MAX_PHOTOS} photos par tâche.`, 'error')
        break
      }
      accepted.push(file)
    }
    return accepted
  }

  async function handleFiles(files) {
    const accepted = validateFiles(files)
    if (!accepted.length) return
    setError('')

    if (!isEdit) {
      setPending((prev) => [
        ...prev,
        ...accepted.map((file) => ({
          key: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
        })),
      ])
      return
    }

    // Tâche déjà enregistrée : envoi immédiat vers Supabase Storage.
    setUploading(true)
    let current = photos
    let currentCover = coverId
    try {
      for (const file of accepted) {
        const uploaded = await uploadTaskPhoto(user.id, task.id, file, current.length)
        current = [...current, uploaded]
        if (!currentCover) currentCover = uploaded.id
        setPhotos(current)
      }
      let updated = task
      if (currentCover !== task.cover_photo_id) {
        updated = await updateTask(task.id, { cover_photo_id: currentCover })
      }
      setCoverId(currentCover)
      onSaved({ ...updated, photos: current, cover_photo_id: currentCover })
      notify(`${accepted.length} photo(s) ajoutée(s).`, 'success')
    } catch (err) {
      setError(err.message || "L'envoi de la photo a échoué.")
    } finally {
      setUploading(false)
    }
  }

  function removePending(key) {
    setPending((prev) => {
      const target = prev.find((item) => item.key === key)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((item) => item.key !== key)
    })
  }

  async function removePhoto(photo) {
    if (!window.confirm('Supprimer cette photo ?')) return
    try {
      await deletePhoto(photo)
      const remaining = photos.filter((p) => p.id !== photo.id)
      setPhotos(remaining)
      let nextCover = coverId === photo.id ? remaining[0]?.id || null : coverId
      setCoverId(nextCover)
      const updated = await updateTask(task.id, { cover_photo_id: nextCover })
      onSaved({ ...updated, photos: remaining })
      notify('Photo supprimée.', 'success')
    } catch (err) {
      notify(err.message || 'Suppression impossible.', 'error')
    }
  }

  async function makeCover(photo) {
    try {
      const updated = await updateTask(task.id, { cover_photo_id: photo.id })
      setCoverId(photo.id)
      onSaved({ ...updated, photos })
      notify('Photo définie comme couverture.', 'success')
    } catch (err) {
      notify(err.message || 'Action impossible.', 'error')
    }
  }

  async function saveCaption(photo, caption) {
    if ((photo.caption || '') === caption) return
    try {
      const updated = await updatePhoto(photo.id, { caption })
      const next = photos.map((p) => (p.id === photo.id ? updated : p))
      setPhotos(next)
      onSaved({ ...task, photos: next, cover_photo_id: coverId })
    } catch (err) {
      notify(err.message || "La légende n'a pas pu être enregistrée.", 'error')
    }
  }

  async function submit(event) {
    event?.preventDefault()
    if (saving) return
    if (!form.title.trim()) {
      setError('Le titre de la tâche est obligatoire.')
      titleRef.current?.focus()
      return
    }
    if (!form.column_id) {
      setError('Choisissez une colonne.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
        column_id: form.column_id,
        labels: form.labels,
      }

      let saved
      if (isEdit) {
        const targetColumn = columns.find((c) => c.id === form.column_id)
        payload.completed_at = targetColumn?.is_done ? task.completed_at || new Date().toISOString() : null
        saved = await updateTask(task.id, payload)
      } else {
        const targetColumn = columns.find((c) => c.id === form.column_id)
        saved = await createTask(user.id, {
          ...payload,
          position: nextPosition ? nextPosition(form.column_id) : 0,
          completed_at: targetColumn?.is_done ? new Date().toISOString() : null,
        })
      }

      let currentPhotos = saved.photos || []
      if (pending.length) {
        setUploading(true)
        for (let i = 0; i < pending.length; i += 1) {
          const uploaded = await uploadTaskPhoto(
            user.id,
            saved.id,
            pending[i].file,
            currentPhotos.length,
          )
          currentPhotos = [...currentPhotos, uploaded]
        }
        setUploading(false)
      }

      if (currentPhotos.length > 0 && !saved.cover_photo_id) {
        saved = await updateTask(saved.id, { cover_photo_id: currentPhotos[0].id })
      }

      onSaved({ ...saved, photos: currentPhotos, cover_photo_id: saved.cover_photo_id || currentPhotos[0]?.id || null })
      notify(isEdit ? 'Tâche mise à jour.' : 'Tâche créée.', 'success')
      onClose()
    } catch (err) {
      setError(err.message || "L'enregistrement a échoué.")
    } finally {
      setUploading(false)
      setSaving(false)
    }
  }

  async function destroy() {
    if (!window.confirm(`Supprimer définitivement « ${task.title} » et ses photos ?`)) return
    try {
      await deleteTask(task.id)
      onDeleted(task.id)
      notify('Tâche supprimée.', 'success')
      onClose()
    } catch (err) {
      setError(err.message || 'Suppression impossible.')
    }
  }

  const busy = saving || uploading

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <header className="modal-head">
          <div>
            <p className="eyebrow mono">{isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}</p>
            <h2 id="task-modal-title">{isEdit ? form.title || 'Sans titre' : 'Ajouter une carte'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer" disabled={busy}>
            ✕
          </button>
        </header>

        <form className="modal-body" onSubmit={submit}>
          <label className="field">
            <span>Titre *</span>
            <input
              ref={titleRef}
              type="text"
              maxLength={200}
              value={form.title}
              placeholder="Ex. Préparer la présentation client"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Colonne</span>
              <select value={form.column_id} onChange={(e) => patch({ column_id: e.target.value })}>
                {columnOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Priorité</span>
              <select value={form.priority} onChange={(e) => patch({ priority: e.target.value })}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Échéance</span>
              <input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => patch({ due_date: e.target.value })}
              />
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <textarea
              rows={5}
              value={form.description}
              placeholder="Détaillez la tâche : contexte, étapes, points de vigilance… Ajoutez des photos pour la rendre plus précise."
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>

          <div className="field">
            <span className="field-label">Photos de la tâche</span>
            <PhotoDropzone
              onFiles={handleFiles}
              busy={uploading}
              hint={
                isEdit
                  ? 'Les photos sont envoyées dès la sélection · glissez, collez (Ctrl+V)'
                  : 'Elles seront envoyées à l’enregistrement · glissez, collez (Ctrl+V)'
              }
            />

            {(photos.length > 0 || pending.length > 0) && (
              <div className="photo-grid">
                {photos.map((photo) => (
                  <figure key={photo.id} className={`photo-tile${coverId === photo.id ? ' is-cover' : ''}`}>
                    <button
                      type="button"
                      className="photo-thumb"
                      onClick={() => onOpenPhoto(photos, photos.findIndex((p) => p.id === photo.id))}
                    >
                      <img src={photo.url} alt={photo.caption || photo.file_name || 'Photo'} loading="lazy" />
                    </button>

                    {coverId === photo.id && <span className="photo-badge">Couverture</span>}

                    <figcaption>
                      <input
                        type="text"
                        defaultValue={photo.caption || ''}
                        placeholder="Légende…"
                        onBlur={(e) => saveCaption(photo, e.target.value.trim())}
                      />
                      <div className="photo-meta mono">
                        <span>{formatBytes(photo.size_bytes)}</span>
                        <span className="photo-actions">
                          {coverId !== photo.id && (
                            <button type="button" title="Définir comme couverture" onClick={() => makeCover(photo)}>
                              ★
                            </button>
                          )}
                          <button type="button" title="Supprimer la photo" onClick={() => removePhoto(photo)}>
                            🗑
                          </button>
                        </span>
                      </div>
                    </figcaption>
                  </figure>
                ))}

                {pending.map((item) => (
                  <figure key={item.key} className="photo-tile is-pending">
                    <div className="photo-thumb">
                      <img src={item.preview} alt={item.file.name} />
                    </div>
                    <span className="photo-badge">À envoyer</span>
                    <figcaption>
                      <div className="photo-meta mono">
                        <span>{formatBytes(item.file.size)}</span>
                        <span className="photo-actions">
                          <button type="button" title="Retirer" onClick={() => removePending(item.key)}>
                            ✕
                          </button>
                        </span>
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <div className="field">
            <span className="field-label">Étiquettes</span>
            <div className="label-editor">
              {form.labels.map((label) => (
                <span key={label} className="chip">
                  {label}
                  <button
                    type="button"
                    onClick={() => patch({ labels: form.labels.filter((l) => l !== label) })}
                    aria-label={`Retirer ${label}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={labelDraft}
                placeholder="Ajouter une étiquette puis Entrée"
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addLabel()
                  }
                  if (e.key === 'Backspace' && !labelDraft && form.labels.length) {
                    patch({ labels: form.labels.slice(0, -1) })
                  }
                }}
                onBlur={addLabel}
              />
            </div>
          </div>

          {error && <p className="alert alert-error">{error}</p>}

          <footer className="modal-foot">
            {isEdit ? (
              <button type="button" className="btn btn-ghost danger" onClick={destroy} disabled={busy}>
                Supprimer
              </button>
            ) : (
              <span />
            )}

            <div className="modal-foot-right">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la tâche'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}
