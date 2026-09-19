// Client market data: live via the Stxck server, frozen design snapshot as the offline fallback.
import { api } from './api.js'
import { fallbackSeries, INDEXES, PROFILES, SECTORS, sparkSeries } from '../data/fallback.js'

export const TIMEFRAMES = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'All']

function snapshotCard(symbol) {
  const p = PROFILES[symbol]
  if (!p) return null
  const s = p.snapshot
  const quote = {
    symbol,
    name: p.name,
    exchange: p.exchange,
    currency: 'USD',
    ...s,
    change: s.price - s.prevClose,
    marketState: 'open',
    live: false,
  }
  return {
    type: 'stock',
    quote,
    points: fallbackSeries(symbol, '1D', s.price, s.prevClose),
    weekChangePct: null,
    stats: { marketCap: p.stats.marketCap, pe: p.stats.pe, divYield: p.stats.divYield, eps: p.stats.eps },
    profile: { symbol, name: p.name, short: p.short, exchange: p.exchange },
    fundamentals: null,
  }
}

/** Live price card data (quote, intraday points, key stats). Returns null if unknown. */
export async function getStockCard(symbol) {
  try {
    return await api.stock(symbol)
  } catch (err) {
    if (err.status === 404 || err.status === 400) return null
    return snapshotCard(symbol)
  }
}

export async function getSeries(symbol, tf, quote) {
  try {
    const s = await api.series(symbol, tf)
    return { points: s.points, base: s.base, live: true }
  } catch {
    const points = fallbackSeries(symbol, tf, quote.price, quote.prevClose)
    return { points, base: tf === '1D' ? quote.prevClose : points[0].v, live: false }
  }
}

export async function getWatchItems(symbols) {
  let live = {}
  try {
    live = await api.quotes(symbols)
  } catch {
    /* fall through to snapshots */
  }
  const out = {}
  for (const s of symbols) {
    const item = live[s]
    if (item && !item.error) {
      out[s] = item
    } else if (PROFILES[s]) {
      const w = PROFILES[s].watch
      out[s] = { symbol: s, name: PROFILES[s].watchName, ...w, spark: sparkSeries(s, w.change >= 0), live: false }
    }
  }
  return out
}

export async function getReturns(symbol) {
  try {
    const { rows } = await api.compare([symbol])
    const a = rows.find((r) => r.symbol === symbol)
    const b = rows.find((r) => r.symbol === '^GSPC')
    return { ytd: [a.ytd, b.ytd], y1: [a.y1, b.y1], y5: [a.y5, b.y5], live: true }
  } catch {
    const p = PROFILES[symbol]
    return { ...(p?.returns || { ytd: [null, 12.15], y1: [null, 11.47], y5: [null, 85.41] }), live: false }
  }
}

export async function getMarket() {
  try {
    return { ...(await api.market()), live: true }
  } catch {
    return {
      indexes: INDEXES.map((i) => ({
        ...i,
        price: i.snapshot.price,
        change: i.snapshot.price - i.snapshot.prevClose,
        changePct: ((i.snapshot.price - i.snapshot.prevClose) / i.snapshot.prevClose) * 100,
        spark: sparkSeries(i.symbol, i.snapshot.price >= i.snapshot.prevClose),
      })),
      sectors: SECTORS,
      live: false,
    }
  }
}

/** Resolve free text ("palantir", "PLTR") to a symbol via server search. */
export async function resolveSymbol(query) {
  const q = query.trim()
  if (!q) return null
  try {
    const { quotes } = await api.search(q)
    const exact = quotes.find((x) => x.symbol.toUpperCase() === q.toUpperCase())
    return (exact || quotes[0])?.symbol || null
  } catch {
    return PROFILES[q.toUpperCase()] ? q.toUpperCase() : null
  }
}
