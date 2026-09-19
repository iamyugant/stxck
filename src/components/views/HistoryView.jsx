import { Fragment, useMemo, useState } from 'react'
import Icon from '../Icon.jsx'
import { textOf } from '../../lib/useChat.js'
import { downloadChat } from '../../lib/exportChat.js'
import { EmptyState } from '../ui/States.jsx'

function bucket(ts) {
  const day = 86400e3
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (ts >= start.getTime()) return 'Today'
  if (ts >= start.getTime() - day) return 'Yesterday'
  if (ts >= start.getTime() - 7 * day) return 'Previous 7 days'
  if (ts >= start.getTime() - 30 * day) return 'Previous 30 days'
  return 'Older'
}

function when(ts) {
  const d = new Date(ts)
  const days = Math.floor((Date.now() - ts) / 86400e3)
  if (days < 1 && d.getDate() === new Date().getDate()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function HistoryView({ chats, activeId, onOpen, onDelete, onRename, onNew }) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...chats]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((c) => !needle || c.title.toLowerCase().includes(needle) || c.messages.some((m) => textOf(m).toLowerCase().includes(needle)))
  }, [chats, q])

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">Chat history</h1>
          <p className="view__sub">{chats.length} conversations saved on this device.</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={onNew}>
          <Icon name="pencil" size={14} /> New chat
        </button>
      </header>
      <div className="sym-search sym-search--compact">
        <Icon name="search" size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
      </div>
      {list.length === 0 &&
        (chats.length ? (
          <EmptyState size="sm" icon="search" title="No matches" body="Try a different word from the question or answer." />
        ) : (
          <EmptyState
            icon="chat"
            title="No conversations yet"
            body="Your chats are saved here automatically."
            action={
              <button className="btn btn--primary btn--sm" onClick={onNew}>
                Start a chat
              </button>
            }
          />
        ))}
      <ul className="history-list">
        {list.map((c, i) => {
          const last = [...c.messages].reverse().find((m) => m.role === 'assistant')
          const group = bucket(c.updatedAt)
          const showGroup = i === 0 || bucket(list[i - 1].updatedAt) !== group
          return (
            <Fragment key={c.id}>
            {showGroup && <li className="history-list__group" aria-hidden="true">{group}</li>}
            <li className={c.id === activeId ? "is-active" : ""}>
              {editing === c.id ? (
                <form
                  className="history-list__edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const v = new FormData(e.currentTarget).get('title').trim()
                    if (v) onRename(c.id, v)
                    setEditing(null)
                  }}
                >
                  <input name="title" defaultValue={c.title} autoFocus className="input" onBlur={(e) => e.currentTarget.form.requestSubmit()} />
                </form>
              ) : (
                <button className="history-list__open" onClick={() => onOpen(c.id)}>
                  <span className="history-list__title">{c.title}</span>
                  <span className="history-list__preview">{last ? textOf(last).replace(/[*#_`>|-]/g, '').slice(0, 140) : ''}</span>
                </button>
              )}
              <span className="history-list__meta">{when(c.updatedAt)}</span>
              <span className="history-list__actions">
                <button className="ghost-btn" aria-label="Rename" onClick={() => setEditing(c.id)}>
                  <Icon name="pencil" size={14} />
                </button>
                <button className="ghost-btn" aria-label="Export as Markdown" data-tip="Export" onClick={() => downloadChat(c)}>
                  <Icon name="download" size={15} />
                </button>
                <button className="ghost-btn" aria-label="Delete conversation" onClick={() => onDelete(c.id)}>
                  <Icon name="trash" size={15} />
                </button>
              </span>
            </li>
            </Fragment>
          )
        })}
      </ul>
    </div>
  )
}
