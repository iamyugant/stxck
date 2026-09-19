import { useEffect, useState } from 'react'
import { FALLBACK_TAPE } from '../../lib/tape.js'
import { StxckLogo, CompanyLogo } from '../Logos.jsx'
import { Trend } from '../Icon.jsx'
import Icon from '../Icon.jsx'
import Sparkline from '../Sparkline.jsx'
import { Link } from '../../lib/router.js'
import { fmt, fmtPct } from '../../lib/format.js'
import { sparkSeries } from '../../data/fallback.js'

/** "Stxck" with the x in brand yellow — the crossing point of the name. */
export function Wordmark() {
  return (
    <span className="brandmark__word" aria-label="Stxck">
      St<span className="brandmark__x">x</span>ck
    </span>
  )
}

export function BrandMark({ to = '/', size = 28 }) {
  return (
    <Link to={to} className="brandmark" aria-label="Stxck home">
      <StxckLogo size={size} />
      <Wordmark />
    </Link>
  )
}

export function TickerTape({ tape }) {
  const row = tape.map((t) => (
    <span className="tape__item" key={t.symbol}>
      <b>{t.symbol.startsWith('^') ? t.name : t.symbol}</b>
      <span>{fmt(t.price)}</span>
      <span className={t.changePct >= 0 ? 'is-up' : 'is-down'}>{fmtPct(t.changePct)}</span>
    </span>
  ))
  return (
    <div className="tape" aria-label="Live market prices">
      <div className="tape__track">
        <div className="tape__row">{row}</div>
        <div className="tape__row" aria-hidden="true">
          {row}
        </div>
      </div>
    </div>
  )
}

const QUESTION = 'How did Nvidia do this week?'

/** Self-playing mock of a Stxck conversation, fed by the live tape. */
export function ProductPreview({ tape, compact = false }) {
  const nvda = tape.find((t) => t.symbol === 'NVDA') || FALLBACK_TAPE.find((t) => t.symbol === 'NVDA')
  const [reduce] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [step, setStep] = useState(reduce ? 4 : 0)
  const [typed, setTyped] = useState(reduce ? QUESTION.length : 0)

  useEffect(() => {
    if (reduce) return
    let cancelled = false
    const timers = []
    const run = () => {
      setStep(0)
      setTyped(0)
      for (let i = 1; i <= QUESTION.length; i++) timers.push(setTimeout(() => !cancelled && setTyped(i), 400 + i * 38))
      const t0 = 400 + QUESTION.length * 38
      timers.push(setTimeout(() => !cancelled && setStep(1), t0 + 300))
      timers.push(setTimeout(() => !cancelled && setStep(2), t0 + 1500))
      timers.push(setTimeout(() => !cancelled && setStep(3), t0 + 2300))
      timers.push(setTimeout(() => !cancelled && setStep(4), t0 + 3100))
      timers.push(setTimeout(() => !cancelled && run(), t0 + 11000))
    }
    run()
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [reduce])

  const up = nvda.changePct >= 0
  return (
    <div className={`preview ${compact ? 'preview--compact' : ''}`} aria-hidden="true">
      <div className="preview__bar">
        <span />
        <span />
        <span />
        <em>stxck.app</em>
      </div>
      <div className="preview__body">
        {!compact && (
          <div className="preview__rail">
            {['pencil', 'home', 'grid', 'bars', 'briefcase'].map((i, k) => (
              <span key={i} className={k === 1 ? 'is-on' : ''}>
                <Icon name={i} size={14} />
              </span>
            ))}
          </div>
        )}
        <div className="preview__chat">
          <div className="preview__user">
            {QUESTION.slice(0, typed)}
            {typed < QUESTION.length && <i className="preview__caret" />}
          </div>
          {step >= 1 && (
            <ul className="tool-trail preview__tools reveal">
              <li className={step >= 2 ? 'is-done' : ''}>
                <span className="tool-trail__dot">
                  {step >= 2 ? <Icon name="checkCircle" size={15} weight="fill" /> : <span className="spin spinner--xs" />}
                </span>
                Pulling NVDA price action and fundamentals
              </li>
            </ul>
          )}
          {step >= 2 && (
            <div className="preview__card reveal">
              <div className="preview__card-head">
                <CompanyLogo symbol="NVDA" size={26} />
                <div>
                  <small>NVDA · NasdaqGS</small>
                  <b>Nvidia Corporation</b>
                </div>
              </div>
              <div className="preview__price">
                {fmt(nvda.price)}
                <span className={up ? 'is-up' : 'is-down'}>
                  <Trend up={up} /> {fmtPct(Math.abs(nvda.changePct)).replace('+', '')} today
                </span>
              </div>
              <Sparkline values={sparkSeries('NVDA-preview', up, 60)} width={320} height={64} color={up ? 'var(--up)' : 'var(--down)'} strokeWidth={1.6} />
            </div>
          )}
          {step >= 3 && (
            <p className="preview__text reveal">
              Nvidia is trading at <b>${fmt(nvda.price)}</b>, {up ? 'up' : 'down'} {fmt(Math.abs(nvda.changePct))}% today. Data-center demand
              keeps driving revenue growth, while valuation leaves less room for a miss…
            </p>
          )}
          {step >= 4 && (
            <div className="preview__actions reveal">
              <span>
                <Icon name="star" size={12} /> Watchlist
              </span>
              <span>
                <Icon name="bars" size={12} /> Simulate
              </span>
              <span className="is-buy">Buy Nvidia</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
