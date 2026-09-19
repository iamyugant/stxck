import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Icon, { Trend } from '../Icon.jsx'
import { CompanyLogo } from '../Logos.jsx'
import { getSeries, TIMEFRAMES } from '../../lib/market.js'
import { fmt, fmtCompact, fmtTick, fmtTimeET, fmtTooltipTime, tzAbbrET } from '../../lib/format.js'

const HOUR = 3600e3

function computeTicks(points, tf) {
  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  if (tf === '1D') {
    const step = t1 - t0 > 13 * HOUR ? 3 * HOUR : 2 * HOUR
    const out = []
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) out.push(t)
    return out
  }
  if (tf === '5D') {
    const seen = new Set()
    const out = []
    for (const p of points) {
      const key = new Date(p.t).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
      if (!seen.has(key)) {
        seen.add(key)
        out.push(p.t)
      }
    }
    return out
  }
  const n = 6
  return Array.from({ length: n }, (_, i) => points[Math.round((i / (n - 1)) * (points.length - 1))].t)
}

function EdgeTick({ x, y, payload, index, visibleTicksCount, tf }) {
  const anchor = index === 0 ? 'start' : index === visibleTicksCount - 1 ? 'end' : 'middle'
  return (
    <text x={x} y={y + 14} textAnchor={anchor} className="axis-tick">
      {fmtTick(payload.value, tf)}
    </text>
  )
}

function LastPill({ cx, cy, value }) {
  if (cx == null || cy == null) return null
  const label = fmt(value)
  const w = label.length * 6.4 + 16
  return (
    <g className="last-pill">
      <rect x={cx + 8} y={cy - 11} width={w} height={22} rx={5} fill="#f5f7fa" />
      <text x={cx + 8 + w / 2} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0b111d" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font)' }}>
        {label}
      </text>
    </g>
  )
}

function ChartTip({ active, payload, tf, base }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const diff = ((p.v - base) / base) * 100
  return (
    <div className="chart-tip">
      <span className="chart-tip__price">{fmt(p.v)}</span>
      <span className={diff >= 0 ? 'is-up' : 'is-down'}>
        {diff >= 0 ? '+' : ''}
        {fmt(diff)}%
      </span>
      <span className="chart-tip__time">{fmtTooltipTime(p.t, tf)}</span>
    </div>
  )
}

function PriceChart({ points, base, tf, height = 210 }) {
  const boxRef = useRef(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 460))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const gid = 'pc' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const { min, max, off, domain, ticks, last } = useMemo(() => {
    const vals = points.map((p) => p.v)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const off = max === min ? 1 : Math.min(1, Math.max(0, (max - base) / (max - min)))
    const lo = Math.min(min, base)
    const hi = Math.max(max, base)
    const pad = (hi - lo) * 0.14 || 1
    return {
      min,
      max,
      off,
      domain: [lo - pad, hi + pad],
      ticks: computeTicks(points, tf).filter((_, i, all) => !narrow || all.length <= 4 || i % 2 === 0),
      last: points[points.length - 1],
    }
  }, [points, base, tf, narrow])

  return (
    <div className="price-chart" style={{ height }} ref={boxRef}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 62, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor="var(--up)" />
              <stop offset={off} stopColor="var(--down)" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={(props) => <EdgeTick {...props} tf={tf} />}
            height={28}
          />
          <YAxis hide domain={domain} />
          <ReferenceLine y={base} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 4" />
          <Tooltip
            content={<ChartTip tf={tf} base={base} />}
            cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Line
            key={`${tf}-${points.length}-${min}-${max}`}
            dataKey="v"
            stroke={`url(#${gid})`}
            strokeWidth={1.6}
            dot={false}
            activeDot={{ r: 4, fill: '#f5f7fa', stroke: 'var(--bg)', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={1100}
            animationEasing="ease-out"
          />
          <ReferenceDot x={last.t} y={last.v} r={0} shape={(p) => <LastPill {...p} value={last.v} />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

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
            <Icon name="star" size={16} />
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
