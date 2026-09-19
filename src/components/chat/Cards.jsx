import { useMemo, useState } from 'react'
import { Area, Bar, BarChart, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CompanyLogo } from '../Logos.jsx'
import WatchlistCard from '../rails/WatchlistCard.jsx'
import SectorList from '../rails/SectorList.jsx'
import { fmt, fmtCompact, fmtPct } from '../../lib/format.js'

const pctCls = (v) => (v == null ? '' : v >= 0 ? 'is-up' : 'is-down')
const pct = (v, d = 2) => (v == null ? '—' : fmtPct(v, d))

export function CompareCard({ rows }) {
  const best = (key) => Math.max(...rows.map((r) => r[key] ?? -Infinity))
  const cols = [
    ['ytd', 'YTD'],
    ['y1', '1 Year'],
    ['y5', '5 Years'],
  ]
  return (
    <div className="data-card compare-card">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Ticker</th>
            {cols.map(([, l]) => (
              <th scope="col" key={l} className="num">
                {l}
              </th>
            ))}
            <th scope="col" className="num">
              Vol.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol}>
              <th scope="row">
                <span className="cell-id">
                  <CompanyLogo symbol={r.symbol} size={24} />
                  <span>
                    <span className="cell-id__sym">{r.symbol.replace('^GSPC', 'S&P 500')}</span>
                    {r.symbol !== '^GSPC' && <span className="cell-id__name">{r.name}</span>}
                  </span>
                </span>
              </th>
              {cols.map(([k]) => (
                <td key={k} className={`num ${pctCls(r[k])} ${r[k] === best(k) && rows.length > 1 ? 'is-best' : ''}`}>
                  {pct(r[k])}
                </td>
              ))}
              <td className="num muted">{r.vol != null ? `${fmt(r.vol, 1)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="data-card__note">Price return, excludes dividends. Vol. = annualized volatility (5Y weekly).</p>
    </div>
  )
}

function Metric({ label, value, tone }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd className={tone || ''}>{value}</dd>
    </div>
  )
}

export function FundamentalsCard({ data: f }) {
  const [more, setMore] = useState(false)
  const eps = (f.epsHistory || []).slice(-4)
  const fin = (f.financials || []).slice(-4).map((q) => ({ ...q, revenue: q.revenue / 1e9, earnings: q.earnings / 1e9 }))
  const upside = f.targetMeanPrice && f.currentPrice ? ((f.targetMeanPrice - f.currentPrice) / f.currentPrice) * 100 : null
  return (
    <div className="data-card fund-card">
      <div className="data-card__head">
        <span className="data-card__title">Financial health</span>
        {f.sector && <span className="chip">{[f.sector, f.industry].filter(Boolean).join(' · ')}</span>}
      </div>
      <dl className="metric-grid">
        <Metric label="Market cap" value={f.marketCap ? `$${fmtCompact(f.marketCap)}` : '—'} />
        <Metric label="Revenue (TTM)" value={f.totalRevenue ? `$${fmtCompact(f.totalRevenue)}` : '—'} />
        <Metric label="Revenue growth" value={pct(f.revenueGrowth, 1)} tone={pctCls(f.revenueGrowth)} />
        <Metric label="Net margin" value={f.profitMargin != null ? `${fmt(f.profitMargin, 1)}%` : '—'} />
        <Metric label="Operating margin" value={f.operatingMargin != null ? `${fmt(f.operatingMargin, 1)}%` : '—'} />
        <Metric label="Return on equity" value={f.returnOnEquity != null ? `${fmt(f.returnOnEquity, 1)}%` : '—'} />
        <Metric label="Free cash flow" value={f.freeCashflow ? `$${fmtCompact(f.freeCashflow)}` : '—'} />
        <Metric label="Cash / Debt" value={`$${fmtCompact(f.totalCash || 0)} / $${fmtCompact(f.totalDebt || 0)}`} />
        <Metric label="P/E (TTM / Fwd)" value={`${f.trailingPE ? fmt(f.trailingPE, 1) : '—'} / ${f.forwardPE ? fmt(f.forwardPE, 1) : '—'}`} />
        <Metric label="Beta" value={f.beta != null ? fmt(f.beta, 2) : '—'} />
        <Metric
          label="Analyst target"
          value={f.targetMeanPrice ? `$${fmt(f.targetMeanPrice)}${upside != null ? ` (${fmtPct(upside, 1)})` : ''}` : '—'}
        />
        <Metric label="Consensus" value={f.recommendation ? f.recommendation.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—'} />
      </dl>

      {(eps.length > 0 || fin.length > 0) && (
        <div className="fund-card__charts">
          {eps.length > 0 && (
            <div>
              <span className="muted-label">EPS actual vs estimate</span>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={eps} barGap={3} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="quarter" tick={{ fontSize: 10.5, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<EpsTip />} />
                  <Bar dataKey="estimate" fill="rgba(255,255,255,0.18)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" fill="var(--gold)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {fin.length > 0 && (
            <div>
              <span className="muted-label">Revenue vs earnings ($B)</span>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={fin} barGap={3} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="quarter" tick={{ fontSize: 10.5, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<FinTip />} />
                  <Bar dataKey="revenue" fill="rgba(245,165,36,0.35)" stroke="rgba(245,165,36,0.8)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="earnings" fill="rgba(61,220,151,0.3)" stroke="rgba(61,220,151,0.8)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {f.summary && (
        <div className="fund-card__about">
          <p className={more ? '' : 'clamp-2'}>{f.summary}</p>
          <button className="link-btn" onClick={() => setMore((m) => !m)}>
            {more ? 'Show less' : 'About the company'}
          </button>
        </div>
      )}
    </div>
  )
}

function EpsTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tip">
      <span className="chart-tip__time">{label}</span>
      <span>Actual ${fmt(d.actual)}</span>
      <span>Estimate ${fmt(d.estimate)}</span>
      {d.surprisePct != null && <span className={pctCls(d.surprisePct)}>Surprise {fmtPct(d.surprisePct, 1)}</span>}
    </div>
  )
}

function FinTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tip">
      <span className="chart-tip__time">{label}</span>
      <span>Revenue ${fmt(d.revenue, 1)}B</span>
      <span>Earnings ${fmt(d.earnings, 1)}B</span>
    </div>
  )
}

export function SimulationCard({ data: s }) {
  const series = useMemo(() => {
    const hist = s.path.map((p) => ({ t: p.t, value: p.v }))
    const last = hist[hist.length - 1]
    const proj = s.projection.map((p, i) => ({
      t: p.t,
      ...(i === 0 ? { value: last.value } : {}),
      base: p.base,
      band: [p.bear, p.bull],
    }))
    return [...hist.slice(0, -1), ...proj]
  }, [s])
  const up = s.finalValue >= s.amount
  return (
    <div className="data-card sim-card">
      <div className="data-card__head">
        <span className="cell-id">
          <CompanyLogo symbol={s.symbol} size={28} />
          <span>
            <span className="data-card__title">
              ${fmt(s.amount, 0)} in {s.symbol}
            </span>
            <span className="cell-id__name">
              Invested {s.startDate} at ${fmt(s.startPrice)}
            </span>
          </span>
        </span>
      </div>
      <div className="sim-card__big">
        <span className="sim-card__value">${fmt(s.finalValue, 0)}</span>
        <span className={up ? 'is-up' : 'is-down'}>
          {fmtPct(s.totalReturnPct, 1)} · {fmtPct(s.cagrPct, 1)}/yr
        </span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t) => new Date(t).getFullYear()}
            tick={{ fontSize: 11, fill: 'var(--text-3)' }}
            axisLine={false}
            tickLine={false}
            tickCount={6}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="chart-tip">
                  <span className="chart-tip__time">{new Date(d.t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  {d.value != null && <span>Value ${fmt(d.value, 0)}</span>}
                  {d.band && (
                    <>
                      <span className="is-up">Bull ${fmt(d.band[1], 0)}</span>
                      <span>Base ${fmt(d.base, 0)}</span>
                      <span className="is-down">Bear ${fmt(d.band[0], 0)}</span>
                    </>
                  )}
                </div>
              )
            }}
          />
          <Area dataKey="band" stroke="none" fill="rgba(0,211,243,0.12)" isAnimationActive={false} connectNulls />
          <Line dataKey="base" stroke="var(--sky)" strokeDasharray="4 4" dot={false} strokeWidth={1.4} connectNulls />
          <Line dataKey="value" stroke={up ? 'var(--up)' : 'var(--down)'} dot={false} strokeWidth={1.6} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <dl className="metric-grid metric-grid--4">
        <Metric label="Max drawdown" value={`${fmt(s.maxDrawdownPct, 1)}%`} tone="is-down" />
        <Metric label="Volatility" value={`${fmt(s.volatilityPct, 1)}%/yr`} />
        <Metric label={`Bear in ${s.years}y`} value={`$${fmtCompact(s.projectedBear)}`} />
        <Metric label={`Bull in ${s.years}y`} value={`$${fmtCompact(s.projectedBull)}`} />
      </dl>
      <p className="data-card__note">
        Backtest uses price history (no dividends). The dashed line and band are a 10th–90th percentile projection from historical
        volatility — illustrative, not a forecast.
      </p>
    </div>
  )
}

export function MarketCard({ card }) {
  const [all, setAll] = useState(false)
  const sectors = [...(card.sectors || [])].sort((a, b) => b.pct - a.pct)
  const maxAbs = Math.max(1, ...sectors.map((s) => Math.abs(s.pct)))
  const shown = (all ? sectors : sectors.slice(0, 5)).map((s) => ({ ...s, fill: Math.min(1, Math.abs(s.pct) / maxAbs) * 0.85 + 0.05 }))
  return (
    <>
      {card.items?.length > 0 && (
        <div className="index-strip">
          {card.items.map((it) => (
            <WatchlistCard key={it.symbol} item={it} compact />
          ))}
        </div>
      )}
      {sectors.length > 0 && (
        <div className="data-card">
          <div className="data-card__head">
            <span className="data-card__title">Sector performance · YTD</span>
            {sectors.length > 5 && (
              <button className="link-btn" onClick={() => setAll((a) => !a)}>
                {all ? 'Top 5' : `All ${sectors.length}`}
              </button>
            )}
          </div>
          <SectorList sectors={shown} />
        </div>
      )}
    </>
  )
}
