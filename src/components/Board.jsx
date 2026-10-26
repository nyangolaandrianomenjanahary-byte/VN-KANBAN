import { useMemo, useRef, useState } from 'react'
import TaskCard from './TaskCard'

export default function Board({
  columns,
  tasks,
  onOpenTask,
  onNewTask,
  onMoveTask,
  onOpenPhoto,
  onRenameColumn,
  onDeleteColumn,
  onAddColumn,
  search,
}) {
  const [drag, setDrag] = useState(null) // { taskId }
  const [over, setOver] = useState(null) // { columnId, index }
  const listRefs = useRef({})

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tasks
    return tasks.filter((task) => {
      const haystack = [task.title, task.description, ...(task.labels || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [tasks, search])

  const byColumn = useMemo(() => {
    const map = new Map()
    for (const column of columns) map.set(column.id, [])
    for (const task of filtered) {
      if (map.has(task.column_id)) map.get(task.column_id).push(task)
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position)
    return map
  }, [columns, filtered])

  function computeIndex(columnId, clientY) {
    const node = listRefs.current[columnId]
    if (!node) return { columnId, index: 0 }
    const cards = Array.from(node.querySelectorAll('[data-task-card]'))
    for (let i = 0; i < cards.length; i += 1) {
      const rect = cards[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return { columnId, index: i }
    }
    return { columnId, index: cards.length }
  }

  function drop(columnId) {
    if (!drag || search) return
    const target = over?.columnId === columnId ? over.index : byColumn.get(columnId)?.length ?? 0
    onMoveTask(drag.taskId, columnId, target)
    setDrag(null)
    setOver(null)
  }

  return (
    <div className="board" role="list" aria-label="Tableau Kanban">
      {columns.map((column) => {
        const list = byColumn.get(column.id) || []
        const isTarget = over?.columnId === column.id
        const markerIndex = isTarget ? over.index : -1

        return (
          <section
            key={column.id}
            className={`column accent-${column.accent || 'navy'}${isTarget ? ' is-target' : ''}`}
            role="listitem"
          >
            <header className="column-head">
              <div className="column-title">
                <span className="accent-bar" aria-hidden="true" />
                <h3
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const value = e.target.textContent.trim()
                    if (value && value !== column.title) onRenameColumn(column.id, value)
                    else e.target.textContent = column.title
                  }}
                  title="Cliquer pour renommer"
                >
                  {column.title}
                </h3>
                <span className="column-count mono">{list.length}</span>
              </div>

              <div className="column-tools">
                <button
                  type="button"
                  className="icon-btn"
                  title="Ajouter une tâche"
                  onClick={() => onNewTask(column.id)}
                >
                  +
                </button>
                {columns.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn subtle"
                    title="Supprimer la colonne"
                    onClick={() => onDeleteColumn(column)}
                  >
                    🗑
                  </button>
                )}
              </div>
            </header>

            <div
              className="column-list"
              ref={(node) => {
                if (node) listRefs.current[column.id] = node
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const next = computeIndex(column.id, e.clientY)
                if (over?.columnId !== next.columnId || over?.index !== next.index) setOver(next)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setOver(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                drop(column.id)
              }}
            >
              {list.map((task, index) => (
                <div key={task.id} data-task-card>
                  {markerIndex === index && <div className="drop-marker" aria-hidden="true" />}
                  <TaskCard
                    task={task}
                    draggable={!search}
                    dragging={drag?.taskId === task.id}
                    onOpen={onOpenTask}
                    onOpenPhoto={onOpenPhoto}
                    onDragStart={(t) => setDrag({ taskId: t.id })}
                    onDragEnd={() => {
                      setDrag(null)
                      setOver(null)
                    }}
                  />
                </div>
              ))}

              {markerIndex >= list.length && <div className="drop-marker" aria-hidden="true" />}

              {list.length === 0 && (
                <p className="column-empty">
                  Aucune carte
                  {search ? ' pour cette recherche' : ''}.
                </p>
              )}

              <button type="button" className="add-card" onClick={() => onNewTask(column.id)}>
                + Nouvelle carte
              </button>
            </div>
          </section>
        )
      })}

      <button type="button" className="add-column" onClick={onAddColumn}>
        <span>+</span>
        Ajouter une colonne
      </button>
    </div>
  )
}
