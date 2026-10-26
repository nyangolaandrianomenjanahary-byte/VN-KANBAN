export default function Header({
  email,
  search,
  onSearch,
  onNewTask,
  onSignOut,
  onRefresh,
  stats,
  syncing,
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-mark">VN</span>
          <div className="brand-text">
            <h1>Kanban</h1>
            <p className="mono">
              {stats.total} tâche{stats.total > 1 ? 's' : ''} · {stats.done} terminée
              {stats.done > 1 ? 's' : ''} · {stats.photos} photo{stats.photos > 1 ? 's' : ''}
              {syncing && <span className="sync-dot" title="Synchronisation…"> ●</span>}
            </p>
          </div>
        </div>

        <div className="header-tools">
          <div className="search">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Rechercher une tâche, une étiquette…"
              aria-label="Rechercher"
            />
          </div>

          <button type="button" className="icon-btn" onClick={onRefresh} title="Rafraîchir depuis le serveur">
            ↻
          </button>

          <button type="button" className="btn btn-primary" onClick={onNewTask}>
            + Nouvelle tâche
          </button>

          <div className="user">
            <span className="avatar" aria-hidden="true">
              {(email || '?').charAt(0).toUpperCase()}
            </span>
            <div className="user-menu">
              <span className="user-mail mono">{email}</span>
              <button type="button" className="link-btn" onClick={onSignOut}>
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
