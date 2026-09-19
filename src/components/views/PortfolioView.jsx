import { useEffect, useMemo, useState } from 'react'
import Icon from '../Icon.jsx'
import { CompanyLogo } from '../Logos.jsx'
import { api } from '../../lib/api.js'
import { STARTING_CASH } from '../../lib/useAccount.js'
import { fmt, fmtPct } from '../../lib/format.js'
import { EmptyState } from '../ui/States.jsx'
import { Flash } from '../ui/Live.jsx'
import Sparkline from '../Sparkline.jsx'
import SymbolSearch from '../SymbolSearch.jsx'

const PALETTE = ['#00d3f3', '#fdc700', '#3ddc97', '#a78bfa', '#f07167', '#60a5fa', '#f59e0b', '#34d399']
const qtyFmt = (q) => fmt(q, q % 1 ? 4 : 0).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')

export default function PortfolioView({ portfolio, onOpen, onAnalyze, onReset, equityHistory = [], onRecordEquity, alerts = [], onRemoveAlert }) {
  const symbols = Object.keys(portfolio.positions)
  const [quotes, setQuotes] = useState({})
  const [confirmReset, setConfirmReset] = useState(false)
  const key = symbols.join(',')

  useEffect(() => {
    if (!key) return
    let alive = true
    const load = () =>
      api
        .quotes(key.split(','))
        .then((q) => alive && setQuotes(q))
        .catch(() => {})
    load()
    const id = setInterval(load, 30e3)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [key])

  const rows = useMemo(
    () =>
      symbols.map((s) => {
        const pos = portfolio.positions[s]
        const q = quotes[s]
        const price = q?.price ?? pos.avgCost
        const value = pos.quantity * price
        // Older positions predate openedAt; fall back to the earliest buy on record.
        const opened = pos.openedAt || Math.min(...portfolio.trades.filter((t) => t.symbol === s && t.side === 'buy').map((t) => t.time), Infinity)
        const openedToday = Number.isFinite(opened) && new Date(opened).toDateString() === new Date().toDateString()
        const pnl = value - pos.quantity * pos.avgCost
        return {
          symbol: s,
          name: q?.name || s,
          ...pos,
          price,
          value,
          pnl,
          pnlPct: ((price - pos.avgCost) / pos.avgCost) * 100,
          // Positions opened today only count moves since the fill.
          dayPnl: openedToday ? pnl : q ? pos.quantity * q.change : 0,
          dayPct: q?.changePct ?? 0,
          live: Boolean(q),
        }
      }),
    [symbols, portfolio.positions, portfolio.trades, quotes],
  )

  const invested = rows.reduce((s, r) => s + r.value, 0)
  const equity = portfolio.cash + invested
  const totalPnl = equity - STARTING_CASH
  const dayPnl = rows.reduce((s, r) => s + r.dayPnl, 0)
  const realized = portfolio.trades.reduce((s, t) => s + (t.realized || 0), 0)
  const alloc = [...[...rows].sort((a, b) => b.value - a.value), { symbol: 'Cash', value: portfolio.cash }].filter((r) => r.value > 0)

  // Record today's equity once every position is priced live.
  const allLive = rows.every((r) => r.live)
  useEffect(() => {
    if (allLive) onRecordEquity?.(equity)
  }, [allLive, equity, onRecordEquity])

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">Paper portfolio</h1>
          <p className="view__sub">Practice with $100,000 of virtual money at live prices. No real orders are placed.</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => onOpen('trade', {})}>
          <Icon name="plus" size={14} /> New trade
        </button>
      </header>

      <div className="kpis">
        <div className="kpi">
          <span className="muted-label">Total equity</span>
          <span className="kpi__value">${fmt(equity)}</span>
          <span className={totalPnl >= 0 ? 'is-up' : 'is-down'}>
            {totalPnl >= 0 ? '+' : '-'}${fmt(Math.abs(totalPnl))} ({fmtPct((totalPnl / STARTING_CASH) * 100)}) all time
          </span>
        </div>
        <div className="kpi">
          <span className="muted-label">Today</span>
          <span className={`kpi__value ${dayPnl >= 0 ? 'is-up' : 'is-down'}`}>
            {dayPnl >= 0 ? '+' : '-'}${fmt(Math.abs(dayPnl))}
          </span>
          <span className="muted">on open positions</span>
        </div>
        <div className="kpi">
          <span className="muted-label">Buying power</span>
          <span className="kpi__value">${fmt(portfolio.cash)}</span>
          <span className="muted">Realized P&L {realized >= 0 ? '+' : '-'}${fmt(Math.abs(realized))}</span>
        </div>
      </div>

      <Performance history={equityHistory} equity={equity} />

      {alloc.length > 0 && (
        <div className="data-card">
          <span className="muted-label">Allocation</span>
          <div className="alloc-bar" role="img" aria-label="Allocation by position">
            {alloc.map((r, i) => (
              <span key={r.symbol} style={{ width: `${(r.value / equity) * 100}%`, background: r.symbol === 'Cash' ? 'rgba(255,255,255,0.18)' : PALETTE[i % PALETTE.length] }} />
            ))}
          </div>
          <div className="alloc-legend">
            {alloc.map((r, i) => (
              <span key={r.symbol}>
                <i style={{ background: r.symbol === 'Cash' ? 'rgba(255,255,255,0.3)' : PALETTE[i % PALETTE.length] }} />
                {r.symbol} {fmt((r.value / equity) * 100, 1)}%
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="data-card table-wrap">
        <div className="data-card__head">
          <span className="data-card__title">Positions</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon="briefcase"
            title="No positions yet"
            body="Buy any stock with virtual cash to start tracking P&L at live prices."
            action={
              <button className="btn btn--primary btn--sm" onClick={() => onOpen('trade', {})}>
                Place a paper trade
              </button>
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col" className="num">Shares</th>
                <th scope="col" className="num">Avg cost</th>
                <th scope="col" className="num">Price</th>
                <th scope="col" className="num">Value</th>
                <th scope="col" className="num">Today</th>
                <th scope="col" className="num">Total P&L</th>
                <th scope="col" className="num"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <th scope="row">
                    <span className="cell-id">
                      <CompanyLogo symbol={r.symbol} size={26} />
                      <span>
                        <span className="cell-id__sym">{r.symbol}</span>
                        <span className={`cell-id__name ${r.dayPct >= 0 ? 'is-up' : 'is-down'}`}>{fmtPct(r.dayPct)} today</span>
                      </span>
                    </span>
                  </th>
                  <td className="num">{qtyFmt(r.quantity)}</td>
                  <td className="num">${fmt(r.avgCost)}</td>
                  <td className="num">
                    <Flash value={r.price}>${fmt(r.price)}</Flash>
                  </td>
                  <td className="num">${fmt(r.value)}</td>
                  <td className={`num ${r.dayPnl >= 0 ? 'is-up' : 'is-down'}`}>
                    {r.dayPnl >= 0 ? '+' : '-'}${fmt(Math.abs(r.dayPnl))}
                  </td>
                  <td className={`num ${r.pnl >= 0 ? 'is-up' : 'is-down'}`}>
                    {r.pnl >= 0 ? '+' : '-'}${fmt(Math.abs(r.pnl))}
                    <span className="cell-sub">{fmtPct(r.pnlPct)}</span>
                  </td>
                  <td className="num row-actions">
                    <button className="btn btn--ghost btn--xs" onClick={() => onOpen('trade', { symbol: r.symbol, side: 'buy' })}>Buy</button>
                    <button className="btn btn--ghost btn--xs" onClick={() => onOpen('trade', { symbol: r.symbol, side: 'sell', quantity: r.quantity })}>Sell</button>
                    <button className="ghost-btn" aria-label={`Ask Stxck about ${r.symbol}`} onClick={() => onAnalyze(r.symbol)}>
                      <Icon name="sparkles" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AlertsCard alerts={alerts} onOpen={onOpen} onRemove={onRemoveAlert} />

      {portfolio.trades.length > 0 && (
        <div className="data-card table-wrap">
          <div className="data-card__head">
            <span className="data-card__title">Activity</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Order</th>
                <th scope="col" className="num">Price</th>
                <th scope="col" className="num">Amount</th>
                <th scope="col" className="num">Realized</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.trades.slice(0, 25).map((t) => (
                <tr key={t.id}>
                  <td className="muted">{new Date(t.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td>
                    <span className={t.side === 'buy' ? 'is-up' : 'is-down'}>{t.side === 'buy' ? 'Buy' : 'Sell'}</span> {qtyFmt(t.quantity)} {t.symbol}
                  </td>
                  <td className="num">${fmt(t.price)}</td>
                  <td className="num">${fmt(t.price * t.quantity)}</td>
                  <td className={`num ${t.realized == null ? 'muted' : t.realized >= 0 ? 'is-up' : 'is-down'}`}>
                    {t.realized == null ? '—' : `${t.realized >= 0 ? '+' : '-'}$${fmt(Math.abs(t.realized))}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="view__foot">
        {confirmReset ? (
          <div className="confirm-bar">
            <span>Reset to $100,000 and clear all positions?</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn btn--danger btn--sm" onClick={() => (onReset(), setConfirmReset(false))}>Reset</button>
          </div>
        ) : (
          <button className="link-btn" onClick={() => setConfirmReset(true)}>
            Reset paper portfolio
          </button>
        )}
      </div>
    </div>
  )
}

function Performance({ history, equity }) {
  const points = history.length ? history : [{ d: new Date().toLocaleDateString('en-CA'), v: equity }]
  const first = points[0]
  const change = equity - first.v
  const pct = (change / first.v) * 100
  const up = change >= 0
  const since = new Date(first.d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className="data-card perf">
      <div className="data-card__head">
        <div>
          <span className="data-card__title">Performance</span>
          <p className="muted-label">Since {since}</p>
        </div>
        <span className={`perf__delta ${up ? 'is-up' : 'is-down'}`}>
          {up ? '+' : '-'}${fmt(Math.abs(change))} · {fmtPct(pct)}
        </span>
      </div>
      {points.length > 1 ? (
        <Sparkline values={points.map((p) => p.v)} width={840} height={96} color={up ? 'var(--up)' : 'var(--down)'} area strokeWidth={1.6} />
      ) : (
        <p className="perf__empty">
          <Icon name="chart" size={16} /> Stxck records your equity once a day while you use it. Your performance chart fills in from tomorrow.
        </p>
      )}
    </div>
  )
}

function AlertsCard({ alerts, onOpen, onRemove }) {
  const [loading, setLoading] = useState(null)
  const add = async (symbol) => {
    setLoading(symbol)
    try {
      const q = await api.quotes([symbol])
      onOpen('alert', { symbol, price: q[symbol]?.price })
    } finally {
      setLoading(null)
    }
  }
  const active = alerts.filter((a) => !a.triggered)
  const fired = alerts.filter((a) => a.triggered)
  return (
    <div className="data-card">
      <div className="data-card__head alerts-head">
        <div>
          <span className="data-card__title">Price alerts</span>
          <p className="muted-label">
            {active.length} active{fired.length ? ` · ${fired.length} triggered` : ''} · checked every minute while Stxck is open
          </p>
        </div>
        <SymbolSearch compact placeholder={loading ? `Loading ${loading}…` : 'Add alert for…'} onPick={add} className="alerts-head__search" />
      </div>
      {alerts.length === 0 ? (
        <EmptyState size="sm" icon="bell" title="No alerts yet" body="Pick a ticker above to get notified when it crosses a price." />
      ) : (
        <ul className="alert-rows">
          {[...active, ...fired].map((a) => (
            <li key={a.id} className={a.triggered ? 'is-fired' : ''}>
              <CompanyLogo symbol={a.symbol} size={26} />
              <span className="alert-rows__sym">{a.symbol}</span>
              <span className="alert-rows__rule">
                <Icon name={a.direction === 'above' ? 'arrowUpRight' : 'arrowDownRight'} size={13} />
                {a.direction === 'above' ? 'Above' : 'Below'} ${fmt(a.price)}
              </span>
              <span className={`badge ${a.triggered ? 'badge--fired' : 'badge--active'}`}>
                {a.triggered ? `Triggered ${new Date(a.triggeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Active'}
              </span>
              <button className="ghost-btn" aria-label={`Edit alerts for ${a.symbol}`} onClick={() => add(a.symbol)}>
                <Icon name="pencil" size={15} />
              </button>
              <button className="ghost-btn" aria-label={`Delete ${a.symbol} alert`} onClick={() => onRemove(a.id)}>
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
