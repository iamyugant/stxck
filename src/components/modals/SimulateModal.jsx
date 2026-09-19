import { useEffect, useState } from 'react'
import Modal from '../Modal.jsx'
import SymbolSearch from '../SymbolSearch.jsx'
import { SimulationCard } from '../chat/Cards.jsx'
import { api } from '../../lib/api.js'
import { EmptyState, Notice, Skeleton } from '../States.jsx'

export default function SimulateModal({ initialSymbol, onClose, onAsk }) {
  const [symbol, setSymbol] = useState(initialSymbol || '')
  const [amount, setAmount] = useState('10000')
  const [years, setYears] = useState(5)
  const [result, setResult] = useState(null)
  const [state, setState] = useState('idle')

  useEffect(() => {
    const amt = Number(amount)
    if (!symbol || !(amt > 0)) return
    let alive = true
    const t = setTimeout(async () => {
      setState('loading')
      try {
        const r = await api.simulate({ symbol, amount: amt, years })
        if (alive) {
          setResult(r)
          setState('ready')
        }
      } catch (err) {
        if (alive) setState(err.message || 'error')
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [symbol, amount, years])

  return (
    <Modal title="Investment simulator" subtitle="Backtest a lump sum, then see a volatility-based range ahead." onClose={onClose} width={560}>
      <div className="sim-form">
        {symbol ? (
          <label className="field">
            <span className="field__label">Ticker</span>
            <button className="input input--button" onClick={() => setSymbol('')}>
              {symbol} <span className="muted">Change</span>
            </button>
          </label>
        ) : (
          <label className="field">
            <span className="field__label">Ticker</span>
            <SymbolSearch autoFocus onPick={setSymbol} compact />
          </label>
        )}
        <label className="field">
          <span className="field__label">Amount (USD)</span>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label className="field">
          <span className="field__label">Years: {years}</span>
          <input type="range" min="1" max="10" value={years} onChange={(e) => setYears(Number(e.target.value))} className="range" />
        </label>
      </div>
      {state === 'loading' && !result && <Skeleton h={300} r={12} />}
      {state !== 'loading' && state !== 'ready' && state !== 'idle' && (
        <Notice tone="error" title="Simulation unavailable">
          {state}
        </Notice>
      )}
      {!symbol && state === 'idle' && <EmptyState size="sm" icon="chart" title="Pick a ticker" body="Choose a stock or ETF to backtest a lump-sum investment." />}
      {result && (
        <div className={state === 'loading' ? 'is-dim' : ''}>
          <SimulationCard data={result} />
          <button className="btn btn--ghost btn--block" onClick={() => onAsk(`Simulate investing $${amount} in ${symbol} over ${years} years and explain the risks`)}>
            Ask Stxck to explain this
          </button>
        </div>
      )}
    </Modal>
  )
}
