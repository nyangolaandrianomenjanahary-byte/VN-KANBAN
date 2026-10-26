import { useRef, useState } from 'react'

/**
 * Zone d'ajout de photos : clic, glisser-déposer, coller (Ctrl+V) et
 * appareil photo sur mobile.
 */
export default function PhotoDropzone({ onFiles, busy, hint }) {
  const inputRef = useRef(null)
  const [hovering, setHovering] = useState(false)

  function pick(files) {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (list.length) onFiles(list)
  }

  function handlePaste(event) {
    const items = Array.from(event.clipboardData?.items || [])
    const files = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean)
    if (files.length) {
      event.preventDefault()
      pick(files)
    }
  }

  return (
    <div
      className={`dropzone${hovering ? ' is-hovering' : ''}${busy ? ' is-busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setHovering(true)
      }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        e.preventDefault()
        setHovering(false)
        pick(e.dataTransfer.files)
      }}
      onPaste={handlePaste}
      tabIndex={0}
      role="button"
      aria-label="Ajouter des photos"
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = ''
        }}
      />

      <span className="dropzone-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="9" cy="10" r="1.8" />
          <path d="M4.5 17.5 9.8 12.6a1.6 1.6 0 0 1 2.2 0l4.2 4" />
          <path d="M15 9.5h5.5M17.75 6.75v5.5" />
        </svg>
      </span>

      <span className="dropzone-text">
        {busy ? 'Envoi des photos…' : 'Ajouter des photos'}
        <small>{hint || 'Glissez, collez (Ctrl+V) ou choisissez un fichier · JPG, PNG, WEBP'}</small>
      </span>
    </div>
  )
}
