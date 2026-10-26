import { useCallback, useEffect } from 'react'

export default function Lightbox({ photos, index, onClose, onNavigate }) {
  const current = photos[index]

  const next = useCallback(() => {
    if (photos.length > 1) onNavigate((index + 1) % photos.length)
  }, [index, photos.length, onNavigate])

  const prev = useCallback(() => {
    if (photos.length > 1) onNavigate((index - 1 + photos.length) % photos.length)
  }, [index, photos.length, onNavigate])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  if (!current) return null

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Aperçu de la photo">
      <button className="lightbox-close" type="button" onClick={onClose} aria-label="Fermer">
        ✕
      </button>

      {photos.length > 1 && (
        <button className="lightbox-nav prev" type="button" onClick={prev} aria-label="Photo précédente">
          ‹
        </button>
      )}

      <figure>
        <img src={current.url} alt={current.caption || current.file_name || 'Photo de la tâche'} />
        <figcaption className="mono">
          {current.caption || current.file_name || 'Photo'}
          {photos.length > 1 && ` · ${index + 1}/${photos.length}`}
        </figcaption>
      </figure>

      {photos.length > 1 && (
        <button className="lightbox-nav next" type="button" onClick={next} aria-label="Photo suivante">
          ›
        </button>
      )}
    </div>
  )
}
