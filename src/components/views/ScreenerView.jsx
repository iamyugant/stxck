import { useEffect, useMemo, useState } from 'react'
import Icon from '../Icon.jsx'
import { CompanyLogo } from '../Logos.jsx'
import { api } from '../../lib/api.js'
import { fmt, fmtCompact, fmtPct } from '../../lib/format.js'
import { EmptyState, Notice, Skeleton } from '../ui/States.jsx'

const COLS = [
  ['symbol', 'Company', 'text'],
  ['price', 'Price', 'num'],
  ['changePct', 'Day', 'pct'],
  ['ytdPct', 'YTD', 'pct'],
  ['offHighPct', 'From 52W high', 'pct'],
  ['volume', 'Volume', 'vol'],
]

export default function ScreenerView({ watchlist, onToggleWatch, onAnalyze, onChart }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [sector, setSector] = useState('All')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'changePct', dir: -1 })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    api
      .screener()
      .then((r) => alive && (setRows(r.rows), setError('')))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [reload])

  const sectors = useMemo(() => ['All', ...new Set((rows || []).map((r) => r.sector))], [rows])
  const view = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows || [])
      .filter((r) => sector === 'All' || r.sector === sector)
      .filter((r) => !needle || r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const x = a[sort.key]
        const y = b[sort.key]
        if (typeof x === 'string') return x.localeCompare(y) * sort.dir
        return ((x ?? -Infinity) - (y ?? -Infinity)) * sort.dir
      })
  }, [rows, sector, q, sort])

  const movers = useMemo(() => {
    if (!rows) return null
    const s = [...rows].sort((a, b) => b.changePct - a.changePct)
    return { up: s.slice(0, 3), down: s.slice(-3).reverse() }
  }, [rows])

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">Screener</h1>
          <p className="view__sub">{rows ? `${rows.length} large-cap US stocks · live` : 'Loading live quotes…'}</p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => (setRows(null), setReload((n) => n + 1))} aria-label="Refresh">
          <Icon name="refresh" size={14} /> Refresh
        </button>
      </header>

      {movers && (
        <div className="movers">
          {[
            ['Top gainers', movers.up],
            ['Top losers', movers.down],
          ].map(([label, list]) => (
            <div className="data-card movers__card" key={label}>
              <span className="muted-label">{label}</span>
              {list.map((r) => (
                <button key={r.symbol} className="movers__row" onClick={() => onChart(r.symbol)}>
                  <CompanyLogo symbol={r.symbol} size={22} />
                  <span className="movers__sym">{r.symbol}</span>
                  <span className="movers__price">${fmt(r.price)}</span>
                  <span className={r.changePct >= 0 ? 'is-up' : 'is-down'}>{fmtPct(r.changePct)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="filters">
        <div className="sym-search sym-search--compact">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or ticker" aria-label="Filter" />
        </div>
        <div className="chip-row" role="tablist" aria-label="Sector">
          {sectors.map((s) => (
            <button key={s} role="tab" aria-selected={sector === s} className={`chip chip--btn ${sector === s ? 'is-active' : ''}`} onClick={() => setSector(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Notice
          tone="error"
          title="Couldn’t load live quotes"
          action={
            <button className="btn btn--ghost btn--sm" onClick={() => setReload((n) => n + 1)}>
              <Icon name="refresh" size={14} /> Try again
            </button>
          }
        >
          {error}
        </Notice>
      )}

      <div className="data-card table-wrap">
        <table className="data-table data-table--screener">
          <thead>
            <tr>
              {COLS.map(([key, label, type]) => (
                <th key={key} scope="col" className={type !== 'text' ? 'num' : ''} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                  <button className="sort-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : type === 'text' ? 1 : -1 }))}>
                    {label}
                    {sort.key === key && <Icon name="chevronDown" size={12} style={{ transform: sort.dir > 0 ? 'rotate(180deg)' : 'none' }} />}
                  </button>
                </th>
              ))}
              <th scope="col" className="num">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!rows &&
              !error &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} aria-hidden="true">
                  <th scope="row">
                    <span className="cell-id">
                      <Skeleton w={26} h={26} r={999} />
                      <span style={{ gap: 6 }}>
                        <Skeleton w={44} h={10} />
                        <Skeleton w={110} h={8} />
                      </span>
                    </span>
                  </th>
                  {[64, 48, 48, 56, 40].map((w, k) => (
                    <td key={k} className="num">
                      <Skeleton w={w} h={10} style={{ marginLeft: 'auto' }} />
                    </td>
                  ))}
                  <td />
                </tr>
              ))}
            {view.map((r) => (
              <tr key={r.symbol} className="clickable" onClick={() => onChart(r.symbol)}>
                <th scope="row">
                  <span className="cell-id">
                    <CompanyLogo symbol={r.symbol} size={26} />
                    <span>
                      <span className="cell-id__sym">{r.symbol}</span>
                      <span className="cell-id__name">
                        {r.name} · {r.sector}
                      </span>
                    </span>
                  </span>
                </th>
                <td className="num">${fmt(r.price)}</td>
                <td className={`num ${r.changePct >= 0 ? 'is-up' : 'is-down'}`}>{fmtPct(r.changePct)}</td>
                <td className={`num ${r.ytdPct >= 0 ? 'is-up' : 'is-down'}`}>{r.ytdPct == null ? '—' : fmtPct(r.ytdPct, 1)}</td>
                <td className="num muted">{r.offHighPct == null ? '—' : fmtPct(r.offHighPct, 1)}</td>
                <td className="num muted">{fmtCompact(r.volume)}</td>
                <td className="num row-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`star-btn ${watchlist.includes(r.symbol) ? 'is-on is-filled' : ''}`}
                    aria-label={watchlist.includes(r.symbol) ? `Remove ${r.symbol} from watchlist` : `Add ${r.symbol} to watchlist`}
                    onClick={() => onToggleWatch(r.symbol)}
                  >
                    <Icon name="star" size={15} stroke={1.5} />
                  </button>
                  <button className="ghost-btn" aria-label={`Ask Stxck about ${r.symbol}`} onClick={() => onAnalyze(r.symbol)}>
                    <Icon name="sparkles" size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {rows && view.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState size="sm" icon="search" title="No matches" body="Try another name or ticker, or clear the sector filter." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
