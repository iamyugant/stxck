import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import { StxckLogo } from '../Logos.jsx'
import { useDismiss } from '../../lib/hooks.js'

const NAV_ITEMS = [
  { id: 'new', icon: 'pencil', label: 'New chat' },
  { id: 'chat', icon: 'home', label: 'Home' },
  { id: 'screener', icon: 'grid', label: 'Screener' },
  { id: 'charts', icon: 'bars', label: 'Charts' },
  { id: 'portfolio', icon: 'briefcase', label: 'Paper portfolio' },
  { id: 'history', icon: 'clock', label: 'Chat history' },
]

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'N'
}

export function Avatar({ user, size = 40 }) {
  const hue = [...(user?.email || 'n')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 40)
  return (
    <span className="user-avatar" style={{ width: size, height: size, '--hue': hue, fontSize: size * 0.36 }} aria-hidden="true">
      {initials(user?.name)}
    </span>
  )
}

export function AccountButton({ user, onSettings, onLogout, onUpgrade }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, ref)
  return (
    <div className="account-anchor" ref={ref}>
      <button className="avatar-btn" aria-label="Account menu" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <Avatar user={user} />
      </button>
      {open && (
        <div className="popover account-pop" role="menu">
          <div className="account-pop__who">
            <Avatar user={user} size={36} />
            <span>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </span>
          </div>
          <button role="menuitem" className="popover__item popover__item--icon" onClick={() => (close(), onSettings())}>
            <span>
              <Icon name="settings" size={16} /> Settings
            </span>
          </button>
          <button role="menuitem" className="popover__item popover__item--icon" onClick={() => (close(), onUpgrade())}>
            <span>
              <Icon name="bolt" size={16} /> Upgrade to Pro
            </span>
          </button>
          <div className="popover__sep" />
          <button role="menuitem" className="popover__item popover__item--icon" onClick={onLogout}>
            <span>
              <Icon name="logout" size={16} /> Log out
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export function MobileDrawer({ open, onClose, user, active, onNav, chats, onOpenChat, onSettings, onLogout }) {
  const panelRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    panelRef.current?.querySelector('button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const recent = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
  return (
    <div className={`drawer ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button className="drawer__scrim" aria-label="Close menu" tabIndex={-1} onClick={onClose} />
      <nav className="drawer__panel" ref={panelRef} aria-label="Main menu">
        <div className="drawer__head">
          <span className="brandmark">
            <StxckLogo size={22} />
            <span className="brandmark__word">
              St<span className="brandmark__x">x</span>ck
            </span>
          </span>
          <button className="ghost-btn" aria-label="Close menu" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="drawer__nav">
          {NAV_ITEMS.map((it) => (
            <button
              key={it.id}
              className={`drawer__item ${active === it.id ? 'is-active' : ''}`}
              aria-current={active === it.id ? 'page' : undefined}
              onClick={() => (onClose(), onNav(it.id))}
            >
              <Icon name={it.icon} size={20} weight={active === it.id ? 'fill' : 'regular'} /> {it.label}
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="drawer__recent">
            <span className="muted-label">Recent chats</span>
            {recent.map((c) => (
              <button key={c.id} className="drawer__chat" onClick={() => (onClose(), onOpenChat(c.id))}>
                {c.title}
              </button>
            ))}
          </div>
        )}
        <div className="drawer__foot">
          <div className="account-pop__who">
            <Avatar user={user} size={36} />
            <span>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </span>
          </div>
          <div className="drawer__foot-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => (onClose(), onSettings())}>
              <Icon name="settings" size={14} /> Settings
            </button>
            <button className="btn btn--ghost btn--sm" onClick={onLogout}>
              <Icon name="logout" size={14} /> Log out
            </button>
          </div>
        </div>
      </nav>
    </div>
  )
}

export function IconRail({ active, onSelect, account }) {
  return (
    <nav className="icon-rail" aria-label="Primary">
      <div className="icon-rail__group">
        {NAV_ITEMS.map((it) => (
          <button
            key={it.id}
            className={`rail-btn ${active === it.id ? 'is-active' : ''}`}
            onClick={() => onSelect(it.id)}
            aria-label={it.label}
            aria-current={active === it.id ? 'page' : undefined}
            data-tip={it.label}
          >
            <Icon name={it.icon} size={20} weight={active === it.id ? 'fill' : 'regular'} />
          </button>
        ))}
      </div>
      <div className="icon-rail__group">
        <button className="rail-btn" aria-label="Settings" data-tip="Settings" onClick={() => onSelect('settings')}>
          <Icon name="settings" size={20} />
        </button>
        {account}
      </div>
    </nav>
  )
}
