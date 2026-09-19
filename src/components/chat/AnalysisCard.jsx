import { useRef, useState } from 'react'
import Icon, { Trend } from '../Icon.jsx'
import { CompanyLogo } from '../Logos.jsx'
import PriceChart from './PriceChart.jsx'
import { getSeries, TIMEFRAMES } from '../../lib/market.js'
import { fmt, fmtCompact, fmtTimeET, tzAbbrET } from '../../lib/format.js'

export default function AnalysisCard({ data, starred, onStar, onAlert, showChart }) {
  const { quote, profile } = data
  const [tf, setTf] = useState('1D')
  const [series, setSeries] = useState({ points: data.points, base: quote.prevClose })
  const [loading, setLoading] = useState(false)
  const [tall, setTall] = useState(false)
  const reqRef = useRef(0)

  const choose = async (next) => {
    if (next === tf) return
    setTf(next)
    const req = ++reqRef.current
    if (next === '1D') {
      setSeries({ points: data.points, base: quote.prevClose })
      return
    }
    setLoading(true)
    const s = await getSeries(quote.symbol, next, quote)
    if (req !== reqRef.current) return
    setSeries(s)
    setLoading(false)
  }

  const up = quote.changePct >= 0
  const asOf = quote.live
    ? `As of ${fmtTimeET(quote.time, true)} ${tzAbbrET(quote.time)}. Market ${quote.marketState === 'open' ? 'Open' : 'Closed'}`
    : 'As of 3:09:15 PM EST. Market Open'
  const periodPct =
    tf !== '1D' && series.points.length
      ? ((series.points[series.points.length - 1].v - series.base) / series.base) * 100
      : null

  return (
    <div className="analysis-card">
      <div className="analysis-card__head">
        <CompanyLogo symbol={quote.symbol} size={40} />
        <div className="analysis-card__id">
          <span className="eyebrow eyebrow--lg">
            {[quote.symbol, profile?.exchange || quote.exchange, quote.currency].filter(Boolean).join(' · ')}
          </span>
          <span className="analysis-card__name">{profile?.name || quote.name}</span>
        </div>
        <div className="analysis-card__tools">
          <button
            className={`tool-btn tool-btn--square ${starred ? 'is-starred' : ''}`}
            aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
            aria-pressed={starred}
            onClick={onStar}
          >
            <Icon name="star" size={16} stroke={1.5} />
          </button>
          <button className="tool-btn" onClick={onAlert}>
            <Icon name="bell" size={16} />
            Price Alert
          </button>
        </div>
      </div>

      <div className="analysis-card__quote reveal" style={{ animationDelay: '120ms' }}>
        <span className="analysis-card__price">{fmt(quote.price)}</span>
        <span className="analysis-card__meta">
          <span className={up ? 'is-up' : 'is-down'}>
            <Trend up={up} /> {up ? '+' : ''}
            {fmt(quote.changePct)}%
          </span>
          <span>{asOf}</span>
          {!quote.live && <span className="tag">Snapshot</span>}
        </span>
      </div>

      {showChart && (
        <div className="reveal" style={{ animationDelay: '60ms' }}>
          <div className="analysis-card__rule" />
          <div className="tf-row">
            <div className="tf-chips" role="tablist" aria-label="Timeframe">
              {TIMEFRAMES.map((t) => (
                <button key={t} role="tab" aria-selected={t === tf} className={`tf-chip ${t === tf ? 'is-active' : ''}`} onClick={() => choose(t)}>
                  {t}
                </button>
              ))}
            </div>
            {periodPct != null && (
              <span className={`tf-row__period ${periodPct >= 0 ? 'is-up' : 'is-down'}`}>
                {periodPct >= 0 ? '+' : ''}
                {fmt(periodPct)}% · {tf}
              </span>
            )}
            <div className="tf-row__tools">
              <button className="ghost-btn" aria-label={tall ? 'Collapse chart' : 'Expand chart'} onClick={() => setTall((v) => !v)}>
                <Icon name="expand" size={16} />
              </button>
            </div>
          </div>
          <div className={`price-chart-wrap ${loading ? 'is-loading' : ''}`}>
            <PriceChart points={series.points} base={series.base} tf={tf} height={tall ? 340 : 230} />
          </div>
        </div>
      )}
    </div>
  )
}

export function StatsGrid({ quote, stats }) {
  const cells = [
    ['Prev close', fmt(quote.prevClose)],
    ['52W Range', quote.low52 ? `${fmt(quote.low52)}-${fmt(quote.high52)}` : '—'],
    ['Market Cap', stats.marketCap ? fmtCompact(stats.marketCap) : '—'],
    ['Open', fmt(quote.open)],
    ['P/E Ratio', stats.pe ? fmt(stats.pe) : '—'],
    ['Dividend Yield', stats.divYield != null ? fmt(stats.divYield) + '%' : '—'],
    ['Day Range', quote.dayLow ? `${fmt(quote.dayLow)}-${fmt(quote.dayHigh)}` : '—'],
    ['Volume', fmtCompact(quote.volume)],
    ['EPS (TTM)', stats.eps ? fmt(stats.eps) : '—'],
  ]
  return (
    <dl className="stats-grid">
      {cells.map(([k, v], i) => (
        <div className="stats-grid__cell reveal" key={k} style={{ animationDelay: `${(i % 3) * 80 + Math.floor(i / 3) * 40}ms` }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
