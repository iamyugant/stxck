import { useCallback, useId, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { useDismiss, useTickerSearch } from '../lib/hooks.js'

export default function SymbolSearch({ onPick, placeholder = 'Search ticker or company', autoFocus, className = '', compact }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const { results: items, loading } = useTickerSearch(q, 7)
  const listId = useId()
  const wrapRef = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, wrapRef)

  const pick = (item) => {
    onPick(item.symbol, item)
    setQ('')
    setOpen(false)
  }

  return (
    <div className={`sym-search ${compact ? 'sym-search--compact' : ''} ${className}`} ref={wrapRef}>
      <Icon name="search" size={15} />
      <input
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(Boolean(e.target.value.trim()))
        }}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, items.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (items[active]) pick(items[active])
            else if (/^[\^A-Za-z0-9.=-]{1,15}$/.test(q.trim())) pick({ symbol: q.trim().toUpperCase() })
          }
        }}
      />
      {loading && <span className="spinner" aria-hidden="true" />}
      {open && items.length > 0 && (
        <ul className="sym-search__list" role="listbox" id={listId}>
          {items.map((it, i) => (
            <li
              key={it.symbol}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(it)
              }}
            >
              <span className="sym-search__sym">{it.symbol}</span>
              <span className="sym-search__name">{it.name}</span>
              <span className="sym-search__meta">{[it.type, it.exchange].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
