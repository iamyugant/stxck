import { useEffect, useState } from 'react'
import Icon from '../Icon.jsx'
import { CompanyLogo } from '../Logos.jsx'
import Sparkline from '../Sparkline.jsx'
import SymbolSearch from '../SymbolSearch.jsx'
import WatchlistCard, { WatchlistSkeleton } from './WatchlistCard.jsx'
import SectorList from './SectorList.jsx'
import { api } from '../../lib/api.js'
import { fmt, fmtPct } from '../../lib/format.js'
import { getMarket } from '../../lib/market.js'
import { load, save } from '../../lib/storage.js'
import { EmptyState, SkeletonText } from '../States.jsx'

/** Least-squares trend on log prices over the last month, extrapolated 7 trading days. */
function trend(points) {
  const ys = points.map((p) => Math.log(p.v))
  const n = ys.length
  const xm = (n - 1) / 2
  const ym = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  ys.forEach((y, x) => {
    num += (x - xm) * (y - ym)
    den += (x - xm) ** 2
  })
  const slope = num / den
  const resid = Math.sqrt(ys.reduce((s, y, x) => s + (y - (ym + slope * (x - xm))) ** 2, 0) / Math.max(1, n - 2))
  const last = points[n - 1].v
  const projected = last * Math.exp(slope * 7)
  const r2 = 1 - ys.reduce((s, y, x) => s + (y - (ym + slope * (x - xm))) ** 2, 0) / ys.reduce((s, y) => s + (y - ym) ** 2, 0)
  return { last, projected, pct: (projected / last - 1) * 100, confidence: Math.max(0, Math.min(1, r2)), resid }
}

function PredictionCard({ symbols, onAnalyze, onHide }) {
  const [symbol, setSymbol] = useState(symbols[0] || 'AAPL')
  const [data, setData] = useState(null)
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .series(symbol, '1M')
      .then((s) => {
        if (!alive || s.points.length < 5) return
        const t = trend(s.points)
        const proj = Array.from({ length: 7 }, (_, i) => t.last * Math.exp((Math.log(t.projected / t.last) / 7) * (i + 1)))
        setData({ ...t, series: [...s.points.map((p) => p.v), ...proj], split: s.points.length, name: s.name })
      })
      .catch(() => alive && setData(null))
    return () => {
      alive = false
    }
  }, [symbol])

  const up = (data?.pct ?? 0) >= 0
  return (
    <div className="rail-card prediction">
      <div className="watch-card__head">
        <CompanyLogo symbol={symbol} size={32} />
        <div className="watch-card__id">
          <span className="eyebrow">{symbol}</span>
          <span className="watch-card__name">{data?.name || '…'}</span>
        </div>
        <div className="popover-anchor">
          <button className="ghost-btn" aria-label="Prediction options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Icon name="more" size={18} />
          </button>
          {menu && (
            <div className="popover popover--right popover--mini" onMouseLeave={() => setMenu(false)}>
              {[...new Set([...symbols, 'AAPL'])].slice(0, 6).map((s) => (
                <button key={s} className="popover__item" onClick={() => (setSymbol(s), setMenu(false))}>
                  Track {s} {s === symbol && <Icon name="check" size={14} />}
                </button>
              ))}
              <button className="popover__item" onClick={() => (setMenu(false), onAnalyze(symbol))}>
                Ask Stxck about {symbol}
              </button>
              <button className="popover__item" onClick={() => (setMenu(false), onHide())}>
                Hide card
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="prediction__chart">
        {data ? (
          <Sparkline values={data.series} width={228} height={70} color="var(--gold)" area strokeWidth={1.5} splitAt={data.split} />
        ) : (
          <span className="sk" style={{ height: 70 }} />
        )}
      </div>
      <div className="prediction__foot">
        <span>
          <span className="muted-label">Last close</span>
          <span className="small-num">{data ? `$${fmt(data.last)}` : '—'}</span>
        </span>
        <span className="align-right">
          <span className="muted-label">7D trend</span>
          <span className={`small-num ${up ? 'is-up' : 'is-down'}`}>{data ? `$${fmt(data.projected)} (${fmtPct(data.pct, 1)})` : '—'}</span>
        </span>
      </div>
      {data && (
        <p className="prediction__note">
          Trend fit {Math.round(data.confidence * 100)}% · statistical extrapolation, not a forecast
        </p>
      )}
    </div>
  )
}

export default function InsightRail({ symbols, items, onRemove, onOpen, onAdd, onClose, onAnalyze }) {
  const [searching, setSearching] = useState(false)
  const [showPrediction, setShowPrediction] = useState(() => load('showPrediction', true))
  const [sectors, setSectors] = useState(null)

  useEffect(() => {
    let alive = true
    const fetchSectors = () =>
      getMarket().then((m) => {
        if (!alive) return
        const pick = ['Technology', 'Financial', 'Healthcare']
        const chosen = m.sectors.filter((s) => pick.includes(s.name))
        const maxAbs = Math.max(1, ...m.sectors.map((s) => Math.abs(s.pct)))
        setSectors((chosen.length ? chosen : m.sectors.slice(0, 3)).map((s) => ({ ...s, fill: s.fill ?? Math.min(1, Math.abs(s.pct) / maxAbs) * 0.85 + 0.05 })))
      })
    fetchSectors()
    const id = setInterval(fetchSectors, 120e3)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return (
    <>
      <div className="rail__head">
        <h2 className="rail__title">Insight</h2>
        <button className="ghost-btn" aria-label="Close panel" onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="rail__section-head">
        <h3>{symbols.length ? 'Watchlist' : 'Create watchlist'}</h3>
        <button
          className={`ghost-btn ${searching ? 'is-on' : ''}`}
          aria-label={searching ? 'Close search' : 'Add a ticker'}
          aria-expanded={searching}
          onClick={() => setSearching((s) => !s)}
        >
          <Icon name={searching ? 'x' : 'search'} size={17} />
        </button>
      </div>
      {searching && (
        <SymbolSearch
          autoFocus
          compact
          className="rail-search-box"
          placeholder="Add ticker, e.g. MSFT"
          onPick={(s) => {
            onAdd(s)
            setSearching(false)
          }}
        />
      )}
      <div className="watch-stack">
        {symbols.map((s) =>
          items[s] ? (
            <WatchlistCard key={s} item={items[s]} starred onStar={() => onRemove(s)} onOpen={() => onOpen(s)} />
          ) : (
            <WatchlistSkeleton key={s} />
          ),
        )}
        {symbols.length === 0 && (
          <EmptyState size="sm" icon="star" title="Your watchlist is empty" body="Search a ticker above, or star one from any analysis." />
        )}
      </div>

      {showPrediction && (
        <>
          <div className="rail__section-head">
            <h3>AI Prediction</h3>
          </div>
          <PredictionCard
            symbols={symbols}
            onAnalyze={onAnalyze}
            onHide={() => {
              setShowPrediction(false)
              save('showPrediction', false)
            }}
          />
        </>
      )}

      <div className="rail__section-head">
        <h3>Equity Sector</h3>
        <span className="muted-label">YTD</span>
      </div>
      <div className="rail-card">{sectors ? <SectorList sectors={sectors} /> : <SkeletonText lines={6} widths={['40%', '100%', '46%', '100%', '38%', '100%']} />}</div>
    </>
  )
}
