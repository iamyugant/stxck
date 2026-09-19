import { useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { load, save } from '../../lib/storage.js'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    features: ['Live quotes and charts', 'AI analyst chat', 'Paper portfolio with $100k', 'Price alerts while open'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19/mo',
    highlight: true,
    features: ['Everything in Free', 'Unlimited Deep Research', 'Stxck Reasoning model', 'Background alerts by email', 'Export reports'],
  },
]

export function UpgradeModal({ onClose, notify }) {
  const [joined, setJoined] = useState(() => load('waitlist', false))
  return (
    <Modal title="Upgrade to Stxck Pro" subtitle="Deeper research and faster answers." onClose={onClose} width={560}>
      <div className="plans">
        {PLANS.map((p) => (
          <div key={p.id} className={`plan ${p.highlight ? 'plan--pro' : ''}`}>
            <div className="plan__name">
              {p.name}
              {p.id === 'free' && <span className="chip">Current</span>}
            </div>
            <div className="plan__price">{p.price}</div>
            <ul>
              {p.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={14} stroke={2} /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button
        className="btn btn--primary btn--block"
        disabled={joined}
        onClick={() => {
          save('waitlist', true)
          setJoined(true)
          notify('You’re on the Pro waitlist')
        }}
      >
        <Icon name="bolt" size={15} /> {joined ? 'You’re on the waitlist' : 'Join the Pro waitlist'}
      </button>
      <p className="data-card__note center">Billing isn't live yet. Joining the waitlist is free and doesn't need a card.</p>
    </Modal>
  )
}

export function CookieModal({ onClose, notify }) {
  const [prefs, setPrefs] = useState(() => load('cookies', { analytics: false }))
  return (
    <Modal
      title="Cookie preferences"
      onClose={onClose}
      footer={
        <button
          className="btn btn--primary"
          onClick={() => {
            save('cookies', prefs)
            notify('Cookie preferences saved')
            onClose()
          }}
        >
          Save
        </button>
      }
    >
      <label className="toggle-row">
        <span>
          <strong>Essential storage</strong>
          <span className="muted-block">Keeps your chats, watchlist, alerts and paper portfolio on this device. Always on.</span>
        </span>
        <input type="checkbox" checked disabled />
      </label>
      <label className="toggle-row">
        <span>
          <strong>Product analytics</strong>
          <span className="muted-block">Anonymous usage stats to improve Stxck. Stxck currently collects none.</span>
        </span>
        <input type="checkbox" checked={prefs.analytics} onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })} />
      </label>
    </Modal>
  )
}
