import { useEffect, useState } from 'react'
import Icon from '../Icon.jsx'
import SymbolSearch from '../SymbolSearch.jsx'
import AnalysisCard, { StatsGrid } from '../chat/AnalysisCard.jsx'
import { FundamentalsCard } from '../chat/Cards.jsx'
import { api } from '../../lib/api.js'
import { getStockCard } from '../../lib/market.js'
import { EmptyState, StockCardSkeleton } from '../ui/States.jsx'

export default function ChartsView({ symbol, onSymbol, watchlist, onToggleWatch, onOpen, onAnalyze }) {
  const [card, setCard] = useState(null)
  const [fund, setFund] = useState(null)
  const [state, setState] = useState('idle')

  useEffect(() => {
    if (!symbol) return
    let alive = true
    setState('loading')
    setFund(null)
    getStockCard(symbol).then((c) => {
      if (!alive) return
      setCard(c)
      setState(c ? 'ready' : 'missing')
    })
    api
      .fundamentals(symbol)
      .then((f) => alive && setFund(f))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [symbol])

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">Charts</h1>
          <p className="view__sub">Live price history, key stats and fundamentals for any ticker.</p>
        </div>
        <SymbolSearch onPick={onSymbol} className="view__search" compact />
      </header>

      {watchlist.length > 0 && (
        <div className="chip-row">
          {watchlist.map((s) => (
            <button key={s} className={`chip chip--btn ${s === symbol ? 'is-active' : ''}`} onClick={() => onSymbol(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {!symbol && <EmptyState icon="chart" title="Search for a ticker" body="Charts, key stats and fundamentals for any stock, ETF or index." />}
      {state === 'loading' && !card && <StockCardSkeleton />}
      {state === 'missing' && <EmptyState icon="search" title={`No data for ${symbol}`} body="Check the ticker symbol, or search by company name." />}
      {card && (
        <div className={`charts-stack ${state === 'loading' ? 'is-dim' : ''}`}>
          <AnalysisCard
            key={card.quote.symbol}
            data={card}
            showChart
            starred={watchlist.includes(card.quote.symbol)}
            onStar={() => onToggleWatch(card.quote.symbol)}
            onAlert={() => onOpen('alert', { symbol: card.quote.symbol, price: card.quote.price })}
          />
          <StatsGrid quote={card.quote} stats={card.stats} />
          <div className="action-row">
            <button className="action-btn" onClick={() => onAnalyze(card.quote.symbol)}>
              <Icon name="sparkles" size={16} /> Ask Stxck about {card.quote.symbol}
            </button>
            <button className="action-btn" onClick={() => onOpen('simulate', { symbol: card.quote.symbol })}>
              <Icon name="bars" size={16} /> Simulate
            </button>
            <button className="action-btn action-btn--buy" onClick={() => onOpen('trade', { symbol: card.quote.symbol, side: 'buy' })}>
              <Icon name="briefcase" size={16} /> Paper trade
            </button>
          </div>
          {fund && <FundamentalsCard data={fund} />}
        </div>
      )}
    </div>
  )
}
