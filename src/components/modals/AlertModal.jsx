import { useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { fmt } from '../../lib/format.js'

export default function AlertModal({ symbol, price, alerts, onAdd, onRemove, onClose }) {
  const [direction, setDirection] = useState('above')
  const [target, setTarget] = useState(price ? (price * 1.05).toFixed(2) : '')
  const mine = alerts.filter((a) => a.symbol === symbol)

  return (
    <Modal
      title={`Price alert · ${symbol}`}
      subtitle={price ? `Now $${fmt(price)}. Checked every minute while Stxck is open.` : undefined}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Done
          </button>
          <button
            className="btn btn--primary"
            disabled={!(Number(target) > 0)}
            onClick={() => {
              onAdd({ symbol, direction, price: Number(target) })
              onClose()
            }}
          >
            Create alert
          </button>
        </>
      }
    >
      <div className="seg">
        {[
          ['above', 'Rises above'],
          ['below', 'Falls below'],
        ].map(([d, label]) => (
          <button key={d} className={direction === d ? 'is-active' : ''} aria-pressed={direction === d} onClick={() => setDirection(d)}>
            {label}
          </button>
        ))}
      </div>
      <div className="quick-row">
        {[-10, -5, 5, 10].map((p) => (
          <button
            key={p}
            className="chip chip--btn"
            onClick={() => {
              setDirection(p > 0 ? 'above' : 'below')
              setTarget((price * (1 + p / 100)).toFixed(2))
            }}
            disabled={!price}
          >
            {p > 0 ? '+' : ''}
            {p}%
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field__label">Target price (USD)</span>
        <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ''))} />
      </label>
      {mine.length > 0 && (
        <ul className="alert-list">
          {mine.map((a) => (
            <li key={a.id}>
              <span>
                {a.direction === 'above' ? 'Above' : 'Below'} ${fmt(a.price)} {a.triggered && <span className="chip">Triggered</span>}
              </span>
              <button className="ghost-btn" aria-label="Delete alert" onClick={() => onRemove(a.id)}>
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
