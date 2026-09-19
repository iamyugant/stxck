import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from './api.js'

const subscribeOnline = (cb) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

// `anchorRef` is the toggle button, so clicking it doesn't close and immediately reopen the popover.
export function useDismiss(open, close, ref, anchorRef) {
  useEffect(() => {
    if (!open) return
    const onDown = (e) => !ref.current?.contains(e.target) && !anchorRef?.current?.contains(e.target) && close()
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close, ref, anchorRef])
}

// Results for the previous query stay visible until the next ones land, so the list doesn't flicker.
export function useTickerSearch(query, limit, delay = 180) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const q = query.trim()

  useEffect(() => {
    if (!q) return
    let alive = true
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await api.search(q)
        if (alive) setResults(r.quotes.slice(0, limit))
      } catch {
        if (alive) setResults([])
      } finally {
        if (alive) setLoading(false)
      }
    }, delay)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, limit, delay])

  return { results: q ? results : [], loading: q ? loading : false }
}
