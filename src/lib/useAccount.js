// Paper portfolio, price alerts, notifications and watchlist — all persisted locally.
import { useCallback, useEffect, useRef } from 'react'
import { api } from './api.js'
import { uid, usePersistentState } from './storage.js'
import { fmt } from './format.js'

import { applyTrade, freshPortfolio } from './trading.js'

export { STARTING_CASH } from './trading.js'

export function useAccount({ notify }) {
  const [watchlist, setWatchlist] = usePersistentState('watchlist', ['GOOGL', 'AMZN', 'NVDA'])
  const [portfolio, setPortfolio] = usePersistentState('portfolio', freshPortfolio)
  const [alerts, setAlerts] = usePersistentState('alerts', [])
  const [equityHistory, setEquityHistory] = usePersistentState('equityHistory', [])
  const [notifications, setNotifications] = usePersistentState('notifications', () => [
    {
      id: uid('n'),
      title: 'Welcome to Stxck',
      body: 'You have $100,000 in paper money. Ask the analyst anything or open Portfolio to trade.',
      time: Date.now(),
      read: false,
    },
  ])

  const push = useCallback(
    (title, body = '') => {
      setNotifications((all) => [{ id: uid('n'), title, body, time: Date.now(), read: false }, ...all].slice(0, 50))
    },
    [setNotifications],
  )

  /* ---------------------------------------------------------------- watchlist */
  const toggleWatch = useCallback(
    (symbol, force) => {
      const has = watchlist.includes(symbol)
      const add = force ?? !has
      if (add === has) return
      setWatchlist((list) => (add ? [...list.filter((s) => s !== symbol), symbol] : list.filter((s) => s !== symbol)))
      notify(add ? `${symbol} added to watchlist` : `${symbol} removed from watchlist`)
    },
    [watchlist, setWatchlist, notify],
  )

  /* ------------------------------------------------------------------ trading */
  const executeTrade = useCallback(
    ({ symbol, side, quantity, price }) => {
      const res = applyTrade(portfolio, { symbol, side, quantity, price }, Date.now(), uid('t'))
      if (!res.ok) return res
      const qty = Number(quantity)
      const cost = qty * price
      setPortfolio(res.portfolio)
      push(`Paper ${side === 'buy' ? 'bought' : 'sold'} ${qty} ${symbol}`, `Filled at $${fmt(price)} · $${fmt(cost)}`)
      notify(`${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${symbol} at $${fmt(price)}`)
      return { ok: true }
    },
    [portfolio, setPortfolio, push, notify],
  )

  /** Keep one equity point per calendar day (latest wins) for the performance chart. */
  const recordEquity = useCallback(
    (value) => {
      if (!(value > 0)) return
      const d = new Date().toLocaleDateString('en-CA')
      setEquityHistory((h) => {
        const last = h[h.length - 1]
        if (last?.d === d) return Math.abs(last.v - value) < 0.005 ? h : [...h.slice(0, -1), { d, v: +value.toFixed(2) }]
        return [...h, { d, v: +value.toFixed(2) }].slice(-730)
      })
    },
    [setEquityHistory],
  )

  const resetPortfolio = useCallback(() => {
    setEquityHistory([])
    setPortfolio(freshPortfolio())
    notify('Paper portfolio reset to $100,000')
  }, [setPortfolio, setEquityHistory, notify])

  /* ------------------------------------------------------------------- alerts */
  const addAlert = useCallback(
    ({ symbol, direction, price }) => {
      setAlerts((all) => [{ id: uid('a'), symbol, direction, price: Number(price), createdAt: Date.now(), triggered: false }, ...all])
      notify(`Alert set: ${symbol} ${direction} $${fmt(price)}`)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    },
    [setAlerts, notify],
  )
  const removeAlert = useCallback((id) => setAlerts((all) => all.filter((a) => a.id !== id)), [setAlerts])

  // Poll active alerts every 60s and fire the ones that crossed.
  const alertsRef = useRef(alerts)
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])
  useEffect(() => {
    const check = async () => {
      const active = alertsRef.current.filter((a) => !a.triggered)
      if (!active.length) return
      const symbols = [...new Set(active.map((a) => a.symbol))]
      let quotes
      try {
        quotes = await api.quotes(symbols)
      } catch {
        return
      }
      const fired = active.filter((a) => {
        const p = quotes[a.symbol]?.price
        return p != null && (a.direction === 'above' ? p >= a.price : p <= a.price)
      })
      if (!fired.length) return
      setAlerts((all) => all.map((a) => (fired.some((f) => f.id === a.id) ? { ...a, triggered: true, triggeredAt: Date.now() } : a)))
      for (const a of fired) {
        const p = quotes[a.symbol].price
        const title = `${a.symbol} is ${a.direction} $${fmt(a.price)}`
        push(title, `Now $${fmt(p)}`)
        notify(title)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          try {
            new Notification(`Stxck: ${title}`, { body: `Now $${fmt(p)}` })
          } catch {
            /* notifications unsupported */
          }
        }
      }
    }
    check()
    const id = setInterval(check, 60e3)
    return () => clearInterval(id)
  }, [setAlerts, push, notify])

  return {
    watchlist,
    setWatchlist,
    toggleWatch,
    portfolio,
    executeTrade,
    resetPortfolio,
    equityHistory,
    recordEquity,
    alerts,
    addAlert,
    removeAlert,
    notifications,
    setNotifications,
    push,
  }
}
