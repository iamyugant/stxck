import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon.jsx'
import { CompanyLogo } from '../Logos.jsx'
import { Spinner } from '../States.jsx'
import { useTickerSearch } from '../../lib/hooks.js'

// Actions are static commands, tickers come from live search, and any free text can go straight to the analyst.
export default function CommandPalette({ onClose, actions, chats, onAsk, onTicker, onOpenChat }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const { results: tickers, loading } = useTickerSearch(q, 5, 160)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = []
    if (needle) out.push({ group: 'Ask', id: 'ask', icon: 'sparkles', label: `Ask Stxck “${q.trim()}”`, run: () => onAsk(q.trim()) })
    const acts = actions.filter((a) => !needle || a.label.toLowerCase().includes(needle) || a.keywords?.includes(needle))
    out.push(...acts.map((a) => ({ group: 'Go to', ...a })))
    if (needle) {
      out.push(
        ...tickers.map((t) => ({
          group: 'Tickers',
          id: `t-${t.symbol}`,
          symbol: t.symbol,
          label: t.symbol,
          meta: t.name,
          run: () => onTicker(t.symbol),
        })),
      )
      out.push(
        ...chats
          .filter((c) => c.title.toLowerCase().includes(needle))
          .slice(0, 4)
          .map((c) => ({ group: 'Chats', id: `c-${c.id}`, icon: 'chat', label: c.title, run: () => onOpenChat(c.id) })),
      )
    }
    return out
  }, [q, actions, tickers, chats, onAsk, onTicker, onOpenChat])

  // Keep the highlighted row in range and in view.
  const current = Math.min(active, Math.max(0, items.length - 1))
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${current}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const run = (item) => {
    onClose()
    item?.run()
  }

  let lastGroup = null
  return createPortal(
    <div className="cmdk-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cmdk__input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            placeholder="Search tickers, pages, chats — or ask Stxck"
            aria-label="Command"
            aria-controls="cmdk-list"
            aria-activedescendant={items[current] ? `cmdk-${items[current].id}` : undefined}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run(items[current])
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
          />
          {loading ? <Spinner size={14} /> : <kbd>Esc</kbd>}
        </div>
        <ul className="cmdk__list" id="cmdk-list" role="listbox" ref={listRef}>
          {items.length === 0 && <li className="cmdk__empty">No results for “{q}”</li>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <li key={it.id} role="presentation">
                {head && <p className="cmdk__group">{head}</p>}
                <div
                  id={`cmdk-${it.id}`}
                  role="option"
                  aria-selected={i === current}
                  data-idx={i}
                  className={`cmdk__item ${i === current ? 'is-active' : ''}`}
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => run(it)}
                >
                  {it.symbol ? <CompanyLogo symbol={it.symbol} size={22} /> : <Icon name={it.icon} size={17} />}
                  <span className="cmdk__label">{it.label}</span>
                  {it.meta && <span className="cmdk__meta">{it.meta}</span>}
                  {it.hint && <kbd>{it.hint}</kbd>}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="cmdk__foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> select
          </span>
          <span>
            <kbd>/</kbd> focus chat
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
