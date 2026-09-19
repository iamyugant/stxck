import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import { StxckLogo } from '../Logos.jsx'
import { MarketStatus } from '../ui/Live.jsx'

const MODELS = [
  { id: 'Stxck 2o', note: 'Fast, everyday analysis' },
  { id: 'Stxck 2o mini', note: 'Quick quotes and summaries' },
  { id: 'Stxck Reasoning', note: 'Slower, deeper multi-step research' },
]

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60e3)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

function useOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && close()
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, close])
}

export default function TopBar({ model, onModel, railOpen, onToggleRail, onUpgrade, onHome, ai, notifications, onReadAll, onClearNotifications, onOpenSettings, onOpenDrawer, onOpenPalette, shortcut }) {
  const [menu, setMenu] = useState(null)
  const unread = notifications.some((n) => !n.read)
  const modelRef = useRef(null)
  const bellRef = useRef(null)
  const close = () => setMenu(null)
  useOutside(modelRef, menu === 'model', close)
  useOutside(bellRef, menu === 'bell', close)

  return (
    <header className="topbar">
      <button className="icon-btn topbar__burger" aria-label="Open menu" onClick={onOpenDrawer}>
        <Icon name="menu" size={18} />
      </button>
      <button className="topbar__logo" onClick={onHome} aria-label="Stxck home">
        <StxckLogo size={32} />
      </button>

      <div className="popover-anchor" ref={modelRef}>
        <button
          className={`model-switch ${menu === 'model' ? 'is-open' : ''}`}
          onClick={() => setMenu(menu === 'model' ? null : 'model')}
          aria-haspopup="menu"
          aria-expanded={menu === 'model'}
        >
          {model}
          <Icon name="chevronDown" size={14} stroke={2} />
        </button>
        {ai && !ai.enabled && (
          <button className="demo-badge" onClick={onOpenSettings} title="AI key not configured. Click for details.">
            Demo mode
          </button>
        )}
        {menu === 'model' && (
          <div className="popover popover--model" role="menu">
            {MODELS.map((m) => (
              <button
                key={m.id}
                role="menuitemradio"
                aria-checked={m.id === model}
                className="popover__item"
                onClick={() => {
                  onModel(m.id)
                  close()
                }}
              >
                <span>
                  <span className="popover__title">{m.id}</span>
                  <span className="popover__note">{m.note}</span>
                </span>
                {m.id === model && <Icon name="check" size={15} stroke={2} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <MarketStatus />
      <button className="search-trigger" onClick={onOpenPalette} aria-label="Search and commands">
        <Icon name="search" size={15} />
        <span className="search-trigger__label">Search tickers, pages, chats</span>
        <kbd>{shortcut}</kbd>
      </button>
      <div className="topbar__actions">
        <div className="popover-anchor" ref={bellRef}>
          <button
            className="icon-btn"
            aria-label="Notifications"
            onClick={() => {
              setMenu(menu === 'bell' ? null : 'bell')
              if (unread) onReadAll()
            }}
          >
            <Icon name="bell" size={18} />
            {unread && <span className="icon-btn__dot" />}
          </button>
          {menu === 'bell' && (
            <div className="popover popover--right popover--bell">
              <div className="popover__head">
                Notifications
                {notifications.length > 0 && (
                  <button className="link-btn" onClick={onClearNotifications}>
                    Clear all
                  </button>
                )}
              </div>
              <div className="popover__scroll">
                {notifications.length === 0 && <p className="notice notice--empty">You're all caught up.</p>}
                {notifications.map((n) => (
                  <div key={n.id} className={`notice ${n.read ? '' : 'is-unread'}`}>
                    <span className="notice__title">{n.title}</span>
                    {n.body && <span className="notice__body">{n.body}</span>}
                    <span className="notice__time">{ago(n.time)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          className={`icon-btn ${railOpen ? 'is-active' : ''}`}
          aria-label={railOpen ? 'Hide insight panel' : 'Show insight panel'}
          aria-pressed={railOpen}
          onClick={onToggleRail}
        >
          <Icon name="panel" size={18} mirrored weight={railOpen ? 'fill' : 'regular'} />
        </button>
        <button className="upgrade-btn" onClick={onUpgrade} aria-label="Upgrade">
          <Icon name="bolt" size={16} />
          <span className="upgrade-btn__label">Upgrade</span>
        </button>
      </div>
    </header>
  )
}
