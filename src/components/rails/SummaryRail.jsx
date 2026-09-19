import { useEffect, useState } from 'react'
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Icon, { Trend } from '../Icon.jsx'
import { getReturns } from '../../lib/market.js'
import { api } from '../../lib/api.js'
import { fmt, fmtSigned } from '../../lib/format.js'

function ReturnCell({ label, value }) {
  if (value == null) {
    return (
      <div className="ret-cell">
        <span className="ret-cell__label">{label}</span>
        <span className="ret-cell__value">—</span>
      </div>
    )
  }
  const up = value >= 0
  return (
    <div className="ret-cell">
      <span className="ret-cell__label">{label}</span>
      <span className={`ret-cell__value ${up ? 'is-up' : 'is-down'}`}>
        <Trend up={up} /> {fmt(Math.abs(value))}%
      </span>
    </div>
  )
}

const tip = (rows) =>
  function Tip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div className="chart-tip">
        <span className="chart-tip__time">{label}</span>
        {rows(payload[0].payload).map((r) => (
          <span key={r}>{r}</span>
        ))}
      </div>
    )
  }
const EpsTip = tip((d) => [`Actual $${fmt(d.actual)}`, `Estimate $${fmt(d.estimate)}`])
const FinTip = tip((d) => [`Revenue $${fmt(d.revenue, 1)}B`, `Earnings $${fmt(d.earnings, 1)}B`])

export default function SummaryRail({ profile, onClose, onViewMore }) {
  const [returns, setReturns] = useState(null)
  const [fund, setFund] = useState(undefined)

  useEffect(() => {
    // The rail panel is keyed by symbol, so this mounts fresh per ticker.
    let alive = true
    getReturns(profile.symbol).then((r) => alive && setReturns(r))
    api
      .fundamentals(profile.symbol)
      .then((f) => alive && setFund(f))
      .catch(() => alive && setFund(null))
    return () => {
      alive = false
    }
  }, [profile.symbol])

  const eps = (fund?.epsHistory || []).slice(-4)
  const fin = (fund?.financials || []).slice(-4).map((q) => ({ quarter: q.quarter, revenue: q.revenue / 1e9, earnings: q.earnings / 1e9 }))
  const latest = eps[eps.length - 1]
  const rows = [
    ['YTD Return', 'ytd'],
    ['1-Year Return', 'y1'],
    ['5-Year Return', 'y5'],
  ]

  return (
    <>
      <div className="rail__head">
        <h2 className="rail__title">Summary</h2>
        <button className="ghost-btn" aria-label="Close panel" onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="rail__section-head">
        <h3>Performance Overview</h3>
        {returns && !returns.live && <span className="tag">Snapshot</span>}
      </div>
      <div className="rail-stack">
        {rows.map(([label, key]) => (
          <div className="rail-card ret-card" key={key}>
            <span className="ret-card__title">{label}</span>
            {returns ? (
              <div className="ret-card__grid">
                <ReturnCell label={profile.symbol} value={returns[key][0]} />
                <ReturnCell label="S&P 500 (^GSPC)" value={returns[key][1]} />
              </div>
            ) : (
              <div className="ret-card__grid">
                <span className="sk" style={{ width: 60, height: 22 }} />
                <span className="sk" style={{ width: 60, height: 22 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {fund === undefined && <span className="sk" style={{ height: 180, marginTop: 16 }} />}
      {eps.length > 0 && (
        <>
          <div className="rail__section-head">
            <h3>Earnings Trends</h3>
          </div>
          <div className="rail-card chart-card">
            <span className="ret-card__title">Earnings per Share</span>
            <div className="chart-card__legend">
              <span>{latest.quarter}</span>
              <span className="legend-dot" style={{ '--c': 'var(--gold)' }}>Estimate {fmtSigned(latest.estimate)}</span>
              <span className="legend-dot" style={{ '--c': 'var(--text-2)' }}>Actual {fmtSigned(latest.actual)}</span>
            </div>
            <div className="chart-card__plot">
              <ResponsiveContainer width="100%" height={84}>
                <LineChart data={eps} margin={{ top: 8, right: 6, bottom: 0, left: 6 }}>
                  <XAxis dataKey="quarter" hide />
                  <YAxis hide domain={['dataMin - 0.1', 'dataMax + 0.1']} />
                  <Tooltip content={<EpsTip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                  <Line dataKey="estimate" stroke="var(--gold)" strokeWidth={1.4} dot={{ r: 2 }} />
                  <Line dataKey="actual" stroke="rgba(255,255,255,0.55)" strokeWidth={1.3} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="quarter-row">
              {eps.slice(-3).map((q) => (
                <span key={q.quarter}>
                  <span className="muted-label">{q.quarter}</span>
                  <span className={`small-num ${q.actual - q.estimate >= 0 ? 'is-up' : 'is-down'}`}>{fmtSigned(q.actual - q.estimate)}</span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}
      {fin.length > 0 && (
        <div className="rail-card chart-card">
          <span className="ret-card__title">Revenue vs Earnings</span>
          <div className="chart-card__legend">
            <span>{fin[fin.length - 1].quarter}</span>
            <span className="legend-dot" style={{ '--c': 'var(--gold)' }}>Revenue</span>
            <span className="legend-dot" style={{ '--c': 'var(--up)' }}>Earning</span>
          </div>
          <div className="chart-card__plot">
            <ResponsiveContainer width="100%" height={96}>
              <BarChart data={fin} barGap={4} barCategoryGap="24%" margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="quarter" hide />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<FinTip />} />
                <Bar dataKey="revenue" fill="rgba(245,165,36,0.22)" stroke="rgba(245,165,36,0.7)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="earnings" fill="rgba(61,220,151,0.18)" stroke="rgba(61,220,151,0.6)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="quarter-row">
            {fin.slice(-3).map((q) => (
              <span key={q.quarter}>
                <span className="muted-label">{q.quarter}</span>
                <span className="small-num">${fmt(q.revenue, 1)}B</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <button className="view-more" onClick={onViewMore}>
        View More
      </button>
    </>
  )
}
