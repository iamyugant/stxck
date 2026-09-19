import { useEffect, useState } from 'react'
import Icon from '../Icon.jsx'
import SymbolSearch from '../SymbolSearch.jsx'
import WatchlistCard, { WatchlistSkeleton } from './WatchlistCard.jsx'
import PredictionCard from './PredictionCard.jsx'
import SectorList from './SectorList.jsx'
import { getMarket } from '../../lib/market.js'
import { load, save } from '../../lib/storage.js'
import { EmptyState, SkeletonText } from '../ui/States.jsx'

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
