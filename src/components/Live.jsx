import { useEffect, useState } from 'react'
import { useOnline } from '../lib/hooks.js'
import { marketStatus } from '../lib/marketHours.js'

export function Flash({ value, children, className = '' }) {
  const [snap, setSnap] = useState({ value, dir: null, n: 0 })
  // Derive the direction during render when the value changes (no effect round-trip).
  if (value !== snap.value) {
    const dir = value != null && snap.value != null ? (value > snap.value ? 'up' : 'down') : null
    setSnap({ value, dir, n: snap.n + 1 })
  }
  useEffect(() => {
    if (!snap.dir) return
    const t = setTimeout(() => setSnap((s) => ({ ...s, dir: null })), 900)
    return () => clearTimeout(t)
  }, [snap.n, snap.dir])
  return (
    <span key={snap.n} className={`${className} ${snap.dir ? `flash flash--${snap.dir}` : ''}`}>
      {children}
    </span>
  )
}

export function MarketStatus() {
  const [status, setStatus] = useState(() => marketStatus())
  useEffect(() => {
    const id = setInterval(() => setStatus(marketStatus()), 30e3)
    return () => clearInterval(id)
  }, [])
  return (
    <span className={`mkt mkt--${status.state}`} title={`${status.label} · ${status.detail}`}>
      <span className="mkt__dot" />
      <span className="mkt__label">{status.label}</span>
      <span className="mkt__detail">{status.detail}</span>
    </span>
  )
}

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="offline" role="status">
      <span className="offline__dot" /> You’re offline. Prices and answers will resume when you reconnect.
    </div>
  )
}
