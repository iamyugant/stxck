import { useState } from 'react'
import Icon from '../Icon.jsx'
import { CompanyLogo } from '../Logos.jsx'
import SymbolSearch from '../SymbolSearch.jsx'
import { BrandMark } from '../landing/Brand.jsx'
import { useAuth } from '../../lib/auth.jsx'
import { navigate } from '../../lib/router.js'
import { save } from '../../lib/storage.js'

const STYLES = [
  { id: 'long-term', icon: 'pie', title: 'Long-term investing', body: 'Quality companies, valuation, compounding' },
  { id: 'active', icon: 'bars', title: 'Active trading', body: 'Momentum, catalysts, price action' },
  { id: 'income', icon: 'landmark', title: 'Income & dividends', body: 'Yield, stability, cash flow' },
  { id: 'learning', icon: 'sparkles', title: 'Learning the ropes', body: 'Plain-English explanations' },
]

const POPULAR = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'JPM', 'V', 'COST', 'LLY']

export default function Welcome() {
  const { user, update } = useAuth()
  const [step, setStep] = useState(0)
  const [styles, setStyles] = useState([])
  const [watch, setWatch] = useState(['NVDA', 'AAPL', 'MSFT'])
  const [saving, setSaving] = useState(false)
  const first = (user?.name || '').split(' ')[0]

  const toggle = (set, id) => set((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  const finish = async (skip = false) => {
    setSaving(true)
    save('watchlist', skip ? ['GOOGL', 'AMZN', 'NVDA'] : watch)
    try {
      await update({ onboarded: true, interests: skip ? [] : styles })
    } finally {
      navigate('/app', { replace: true })
    }
  }

  return (
    <div className="welcome">
      <header className="welcome__top">
        <BrandMark to="/app" />
        <button className="link-btn" onClick={() => finish(true)} disabled={saving}>
          Skip for now
        </button>
      </header>

      <main className="welcome__card" aria-live="polite">
        <div className="welcome__progress" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label="Setup progress">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= step ? 'is-on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <section className="reveal" key="s0">
            <p className="welcome__kicker">Step 1 of 3</p>
            <h1 className="welcome__title">Welcome{first ? `, ${first}` : ''}. How do you invest?</h1>
            <p className="welcome__sub">Stxck tunes its explanations to your style. Pick any that fit.</p>
            <div className="style-grid">
              {STYLES.map((s) => {
                const on = styles.includes(s.id)
                return (
                  <button key={s.id} className={`style-card ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(setStyles, s.id)}>
                    <span className="style-card__icon">
                      <Icon name={s.icon} size={18} />
                    </span>
                    <span className="style-card__title">{s.title}</span>
                    <span className="style-card__body">{s.body}</span>
                    <span className="style-card__check" aria-hidden="true">
                      <Icon name="check" size={12} stroke={2.6} />
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="welcome__actions">
              <span />
              <button className="btn btn--primary btn--lg" onClick={() => setStep(1)}>
                Continue <Icon name="chevronRight" size={16} />
              </button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="reveal" key="s1">
            <p className="welcome__kicker">Step 2 of 3</p>
            <h1 className="welcome__title">Start your watchlist</h1>
            <p className="welcome__sub">These stay pinned in your Insight panel with live prices. You can change them anytime.</p>
            <SymbolSearch compact placeholder="Search any ticker or company" onPick={(s) => setWatch((w) => (w.includes(s) ? w : [...w, s]))} />
            <div className="pick-grid">
              {[...new Set([...POPULAR, ...watch])].map((s) => {
                const on = watch.includes(s)
                return (
                  <button key={s} className={`pick ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(setWatch, s)}>
                    <CompanyLogo symbol={s} size={24} />
                    {s}
                    <Icon name={on ? 'check' : 'plus'} size={13} stroke={2.2} />
                  </button>
                )
              })}
            </div>
            <div className="welcome__actions">
              <button className="btn btn--ghost btn--lg" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="btn btn--primary btn--lg" onClick={() => setStep(2)}>
                Continue <Icon name="chevronRight" size={16} />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="reveal" key="s2">
            <p className="welcome__kicker">Step 3 of 3</p>
            <h1 className="welcome__title">You're all set</h1>
            <p className="welcome__sub">Here's what's waiting for you:</p>
            <ul className="ready-list">
              <li>
                <span>
                  <Icon name="sparkles" size={16} />
                </span>
                <div>
                  <b>An AI analyst</b>
                  <p>Ask about any stock or the market. It pulls live data and shows its sources.</p>
                </div>
              </li>
              <li>
                <span>
                  <Icon name="briefcase" size={16} />
                </span>
                <div>
                  <b>$100,000 paper portfolio</b>
                  <p>Test ideas at live prices without risking real money.</p>
                </div>
              </li>
              <li>
                <span>
                  <Icon name="star" size={16} />
                </span>
                <div>
                  <b>{watch.length ? `${watch.length} stocks on your watchlist` : 'An empty watchlist'}</b>
                  <p>{watch.length ? watch.slice(0, 6).join(', ') + (watch.length > 6 ? '…' : '') : 'Star any stock to follow it.'}</p>
                </div>
              </li>
            </ul>
            <div className="welcome__actions">
              <button className="btn btn--ghost btn--lg" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn btn--primary btn--lg" onClick={() => finish(false)} disabled={saving}>
                {saving ? <span className="spin spin--dark" /> : <>Enter Stxck <Icon name="chevronRight" size={16} /></>}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
