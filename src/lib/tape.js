// Public market tape for marketing surfaces (no auth), with a design-snapshot fallback.
import { useEffect, useState } from 'react'
import { api } from './api.js'
import { INDEXES, PROFILES } from './fallback.js'

export const FALLBACK_TAPE = [
  ...INDEXES.map((i) => ({ symbol: i.symbol, name: i.name, price: i.snapshot.price, changePct: ((i.snapshot.price - i.snapshot.prevClose) / i.snapshot.prevClose) * 100 })),
  ...Object.values(PROFILES).map((p) => ({ symbol: p.symbol, name: p.short, price: p.watch.price, changePct: p.watch.changePct })),
]

export function useTape() {
  const [tape, setTape] = useState(FALLBACK_TAPE)
  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .tape()
        .then((t) => alive && t.length && setTape(t))
        .catch(() => {})
    load()
    const id = setInterval(load, 60e3)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  return tape
}

