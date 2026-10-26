import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import Header from './components/Header'
import Board from './components/Board'
import TaskDialog from './components/TaskDialog'
import Lightbox from './components/Lightbox'
import { isConfigured, supabase } from './lib/supabase'
import {
  createColumn,
  deleteColumn,
  deleteTask,
  fetchColumns,
  fetchTasks,
  persistTaskOrder,
  updateColumn,
} from './lib/api'

let toastId = 0

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [columns, setColumns] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null) // { task, columnId }
  const [lightbox, setLightbox] = useState(null) // { photos, index }
  const [toasts, setToasts] = useState([])
  const loadedFor = useRef(null)

  const user = session?.user

  const notify = useCallback((message, tone = 'info') => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  /* ---------------- Auth ---------------- */
  useEffect(() => {
    if (!isConfigured) {
      setAuthReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setColumns([])
        setTasks([])
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  /* ---------------- Data loading ---------------- */
  const loadBoard = useCallback(
    async (userId, { silent = false } = {}) => {
      if (!userId) return
      if (!silent) setLoading(true)
      else setSyncing(true)
      setError('')
      try {
        const [cols, items] = await Promise.all([fetchColumns(userId), fetchTasks(userId)])
        setColumns(cols)
        setTasks(items)
      } catch (err) {
        setError(err.message || 'Impossible de charger le tableau.')
      } finally {
        setLoading(false)
        setSyncing(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!user) {
      loadedFor.current = null
      return
    }
    if (loadedFor.current === user.id) return
    loadedFor.current = user.id
    loadBoard(user.id)
  }, [user, loadBoard])

  /* ---------------- Derived data ---------------- */
  const stats = useMemo(
    () => ({
      total: tasks.length,
      done: tasks.filter((t) => t.completed_at).length,
      photos: tasks.reduce((sum, task) => sum + (task.photos?.length || 0), 0),
    }),
    [tasks],
  )

  function mergeTask(saved) {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === saved.id)
      if (!exists) return [...prev, saved]
      return prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t))
    })
  }

  function nextPosition(columnId) {
    return tasks.filter((t) => t.column_id === columnId).length
  }

  /* ---------------- Drag & drop ---------------- */
  async function moveTask(taskId, columnId, index) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const groups = new Map()
    for (const column of columns) {
      groups.set(
        column.id,
        tasks
          .filter((t) => t.column_id === column.id && t.id !== taskId)
          .sort((a, b) => a.position - b.position),
      )
    }

    const target = groups.get(columnId)
    if (!target) return
    const safeIndex = Math.max(0, Math.min(index, target.length))
    target.splice(safeIndex, 0, { ...task, column_id: columnId })
    groups.set(columnId, target)

    const now = new Date().toISOString()
    const updates = []
    const nextTasks = []

    for (const [colId, list] of groups.entries()) {
      const isDone = columns.find((c) => c.id === colId)?.is_done
      list.forEach((item, position) => {
        const wasDone = Boolean(item.completed_at)
        const completed_at = isDone ? item.completed_at || now : null
        const patched = { ...item, column_id: colId, position, completed_at }
        nextTasks.push(patched)
        if (
          item.column_id !== colId ||
          item.position !== position ||
          (wasDone && !completed_at) ||
          (!wasDone && completed_at)
        ) {
          updates.push({ id: item.id, column_id: colId, position, completed_at })
        }
      })
    }

    setTasks(nextTasks)
    if (!updates.length) return

    try {
      setSyncing(true)
      await persistTaskOrder(updates)
    } catch (err) {
      notify(err.message || 'Déplacement non enregistré.', 'error')
      loadBoard(user.id, { silent: true })
    } finally {
      setSyncing(false)
    }
  }

  /* ---------------- Columns ---------------- */
  async function renameColumn(id, title) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
    try {
      await updateColumn(id, { title })
    } catch (err) {
      notify(err.message || 'Renommage impossible.', 'error')
    }
  }

  async function addColumn() {
    const title = window.prompt('Nom de la nouvelle colonne ?', 'Nouvelle étape')
    if (!title?.trim()) return
    try {
      const created = await createColumn(user.id, {
        title: title.trim().slice(0, 60),
        accent: 'navy',
        position: columns.length,
      })
      setColumns((prev) => [...prev, created])
      notify('Colonne ajoutée.', 'success')
    } catch (err) {
      notify(err.message || 'Ajout impossible.', 'error')
    }
  }

  async function removeColumn(column) {
    const count = tasks.filter((t) => t.column_id === column.id).length
    if (
      !window.confirm(
        `Supprimer la colonne « ${column.title} »${count ? ` et ses ${count} carte(s)` : ''} ?`,
      )
    )
      return
    try {
      // Supprime les cartes une à une pour nettoyer aussi les photos du Storage.
      const doomed = tasks.filter((t) => t.column_id === column.id)
      for (const item of doomed) {
        await deleteTask(item.id)
      }
      await deleteColumn(column.id)
      setColumns((prev) => prev.filter((c) => c.id !== column.id))
      setTasks((prev) => prev.filter((t) => t.column_id !== column.id))
      notify('Colonne supprimée.', 'success')
    } catch (err) {
      notify(err.message || 'Suppression impossible.', 'error')
    }
  }

  /* ---------------- Render ---------------- */
  if (!authReady) {
    return (
      <div className="boot">
        <span className="spinner" />
        <p className="mono">Chargement de l'espace de travail…</p>
      </div>
    )
  }

  if (!session) return <AuthScreen />

  return (
    <div className="app-shell">
      <Header
        email={user?.email}
        search={search}
        onSearch={setSearch}
        stats={stats}
        syncing={syncing}
        onNewTask={() => setDialog({ task: null, columnId: columns[0]?.id })}
        onRefresh={() => loadBoard(user.id, { silent: true })}
        onSignOut={() => supabase.auth.signOut()}
      />

      <main className="app-main">
        {error && (
          <div className="alert alert-error with-action">
            <span>{error}</span>
            <button type="button" className="btn btn-ghost" onClick={() => loadBoard(user.id)}>
              Réessayer
            </button>
          </div>
        )}

        {loading && columns.length === 0 ? (
          <div className="board-skeleton" aria-label="Chargement du tableau">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-column" />
            ))}
          </div>
        ) : (
          <Board
            columns={columns}
            tasks={tasks}
            search={search}
            onOpenTask={(task) => setDialog({ task, columnId: task.column_id })}
            onNewTask={(columnId) => setDialog({ task: null, columnId })}
            onMoveTask={moveTask}
            onOpenPhoto={(photos, index) => setLightbox({ photos, index: Math.max(0, index) })}
            onRenameColumn={renameColumn}
            onDeleteColumn={removeColumn}
            onAddColumn={addColumn}
          />
        )}
      </main>

      {dialog && (
        <TaskDialog
          key={dialog.task?.id || `new-${dialog.columnId}`}
          user={user}
          task={dialog.task}
          defaultColumnId={dialog.columnId}
          columns={columns}
          nextPosition={nextPosition}
          notify={notify}
          onClose={() => setDialog(null)}
          onSaved={mergeTask}
          onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
          onOpenPhoto={(photos, index) => setLightbox({ photos, index: Math.max(0, index) })}
        />
      )}

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox((prev) => ({ ...prev, index }))}
        />
      )}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}
