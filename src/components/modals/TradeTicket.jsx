import { useEffect, useState } from 'react'
import Modal from '../Modal.jsx'
import { CompanyLogo } from '../Logos.jsx'
import SymbolSearch from '../SymbolSearch.jsx'
import { api } from '../../lib/api.js'
import { fmt } from '../../lib/format.js'
import { Notice } from '../ui/States.jsx'

/** Paper-trading order ticket. Market orders fill at the live quote on confirm. */
export default function TradeTicket({ initial, portfolio, onExecute, onClose }) {
  const [symbol, setSymbol] = useState(initial?.symbol || '')
  const [side, setSide] = useState(initial?.side || 'buy')
  const [mode, setMode] = useState('shares')
  const [amount, setAmount] = useState(initial?.quantity ? String(initial.quantity) : '')
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!symbol) return
    let alive = true
    const load = () =>
      api
        .quotes([symbol])
        .then((q) => alive && setQuote(q[symbol]?.error ? null : q[symbol]))
        .catch(() => alive && setQuote(null))
    load()
    const id = setInterval(load, 15e3)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [symbol])

  const price = quote?.price
  const held = portfolio.positions[symbol]?.quantity || 0
  const shares = mode === 'shares' ? Number(amount) : price ? Number(amount) / price : 0
  const total = price ? shares * price : 0
  const valid = symbol && price && shares > 0

  const submit = () => {
    setSubmitting(true)
    const res = onExecute({ symbol, side, quantity: +shares.toFixed(6), price })
    setSubmitting(false)
    if (res.ok) onClose()
    else setError(res.error)
  }

  return (
    <Modal
      title="Paper trade"
      subtitle="Simulated order with virtual money. Nothing is sent to a broker."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={`btn ${side === 'buy' ? 'btn--up' : 'btn--down'}`} disabled={!valid || submitting} onClick={submit}>
            {side === 'buy' ? 'Buy' : 'Sell'} {shares > 0 ? fmt(shares, shares % 1 ? 4 : 0).replace(/\.?0+$/, '') : ''} {symbol}
          </button>
        </>
      }
    >
      {!symbol ? (
        <SymbolSearch autoFocus onPick={(s) => setSymbol(s)} />
      ) : (
        <div className="ticket-head">
          <CompanyLogo symbol={symbol} size={36} />
          <div>
            <div className="ticket-head__sym">{symbol}</div>
            <div className="ticket-head__name">{quote?.fullName || quote?.name || 'Loading…'}</div>
          </div>
          <div className="ticket-head__price">
            {price ? `$${fmt(price)}` : '—'}
            {quote && (
              <span className={quote.changePct >= 0 ? 'is-up' : 'is-down'}>
                {quote.changePct >= 0 ? '+' : ''}
                {fmt(quote.changePct)}%
              </span>
            )}
          </div>
          {!initial?.symbol && (
            <button className="link-btn" onClick={() => setSymbol('')}>
              Change
            </button>
          )}
        </div>
      )}

      <div className="seg" role="tablist" aria-label="Side">
        {['buy', 'sell'].map((s) => (
          <button key={s} role="tab" aria-selected={side === s} className={side === s ? `is-active is-${s}` : ''} onClick={() => setSide(s)}>
            {s === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <label className="field">
        <span className="field__label">
          Amount
          <span className="seg seg--mini">
            {['shares', 'dollars'].map((m) => (
              <button key={m} type="button" className={mode === m ? 'is-active' : ''} onClick={() => setMode(m)}>
                {m === 'shares' ? 'Shares' : 'USD'}
              </button>
            ))}
          </span>
        </span>
        <input
          className="input"
          inputMode="decimal"
          value={amount}
          placeholder={mode === 'shares' ? '0' : '$0.00'}
          onChange={(e) => {
            setError('')
            setAmount(e.target.value.replace(/[^\d.]/g, ''))
          }}
        />
      </label>

      <dl className="ticket-summary">
        <div>
          <dt>Order type</dt>
          <dd>Market</dd>
        </div>
        <div>
          <dt>Est. {mode === 'dollars' ? 'shares' : 'total'}</dt>
          <dd>{mode === 'dollars' ? fmt(shares, 4) : `$${fmt(total)}`}</dd>
        </div>
        <div>
          <dt>Buying power</dt>
          <dd>${fmt(portfolio.cash)}</dd>
        </div>
        <div>
          <dt>You hold</dt>
          <dd>
            {fmt(held, held % 1 ? 4 : 0)} {symbol}
          </dd>
        </div>
      </dl>
      {error && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="error" compact>
            {error}
          </Notice>
        </div>
      )}
    </Modal>
  )
}
