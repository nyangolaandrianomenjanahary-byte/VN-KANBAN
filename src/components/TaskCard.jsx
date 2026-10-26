import { PRIORITIES } from '../lib/supabase'

function formatDue(dateStr) {
  if (!dateStr) return null
  const date = new Date(`${dateStr}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((date - today) / 86400000)
  const label = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  if (diff < 0) return { label, tone: 'late', suffix: 'en retard' }
  if (diff === 0) return { label, tone: 'today', suffix: "aujourd'hui" }
  if (diff === 1) return { label, tone: 'soon', suffix: 'demain' }
  return { label, tone: 'normal', suffix: null }
}

export default function TaskCard({ task, onOpen, onDragStart, onDragEnd, dragging, onOpenPhoto, draggable = true }) {
  const photos = task.photos || []
  const cover = photos.find((p) => p.id === task.cover_photo_id) || photos[0]
  const priority = PRIORITIES.find((p) => p.value === task.priority) || PRIORITIES[1]
  const due = formatDue(task.due_date)
  const done = Boolean(task.completed_at)

  return (
    <article
      className={`task-card${dragging ? ' is-dragging' : ''}${done ? ' is-done' : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.id)
        onDragStart(task)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(task)
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ouvrir la tâche ${task.title}`}
    >
      {cover && (
        <button
          type="button"
          className="card-cover"
          onClick={(e) => {
            e.stopPropagation()
            onOpenPhoto(photos, photos.findIndex((p) => p.id === cover.id))
          }}
          aria-label="Agrandir la photo"
        >
          <img src={cover.url} alt={cover.caption || task.title} loading="lazy" />
          {photos.length > 1 && <span className="photo-count">+{photos.length - 1}</span>}
        </button>
      )}

      <div className="card-top">
        <span className="priority-dot" style={{ background: priority.color }} title={`Priorité ${priority.label}`} />
        <h4>{task.title}</h4>
      </div>

      {task.description && <p className="card-desc">{task.description}</p>}

      {task.labels?.length > 0 && (
        <ul className="card-labels">
          {task.labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      )}

      <footer className="card-foot">
        {due && (
          <span className={`due due-${due.tone}`}>
            {due.label}
            {due.suffix && ` · ${due.suffix}`}
          </span>
        )}
        {photos.length > 0 && (
          <span className="photo-pill" title={`${photos.length} photo(s)`}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="M4.5 17 9.5 12.4a1.5 1.5 0 0 1 2 0L16 17" />
            </svg>
            {photos.length}
          </span>
        )}
        {task.completed_at && <span className="done-pill">Terminée</span>}
      </footer>
    </article>
  )
}
