// Frozen numbers from the design frames. Used whenever the Yahoo proxy is unreachable,
// and for fields the free chart endpoint doesn't expose (market cap, P/E).

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const seedOf = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

// Anchored random walk: `anchors` are [x in 0..1, % offset from base] pairs.
function shapedSeries({ seed, n, base, anchors, noise = 0.35, start, step }) {
  const r = rng(seed)
  let wobble = 0
  const out = []
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1)
    let k = 0
    while (k < anchors.length - 2 && anchors[k + 1][0] < x) k++
    const [x0, y0] = anchors[k]
    const [x1, y1] = anchors[k + 1]
    const f = x1 === x0 ? 0 : Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))
    wobble = wobble * 0.72 + (r() - 0.5) * noise
    const pct = y0 + (y1 - y0) * f + wobble
    out.push({ t: start + i * step, v: +(base * (1 + pct / 100)).toFixed(2) })
  }
  return out
}

// 6:00 AM → 6:00 PM ET today, 5-minute bars (EDT = UTC-4).
function todayET6am() {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0)
}

const NVDA_1D_ANCHORS = [
  [0, -0.9], [0.06, -0.7], [0.12, -1.3], [0.15, -1.5], [0.17, -0.4], [0.2, 0.9],
  [0.26, 1.3], [0.33, 1.6], [0.4, 0.8], [0.5, 1.0], [0.62, 0.6], [0.7, 0.4],
  [0.73, -0.2], [0.84, -0.4], [0.88, 0.4], [0.95, 0.5], [1, 0.3],
]

const TF_SHAPE = {
  '1D': { n: 145, step: 5 * 60e3 },
  '5D': { n: 130, step: 30 * 60e3 * 1.3 },
  '1M': { n: 22, step: 86400e3 * 1.4 },
  '6M': { n: 126, step: 86400e3 * 1.45 },
  YTD: { n: 180, step: 86400e3 * 1.45 },
  '1Y': { n: 252, step: 86400e3 * 1.45 },
  '5Y': { n: 260, step: 7 * 86400e3 },
  All: { n: 200, step: 30 * 86400e3 },
}

export function fallbackSeries(symbol, tf, price, base) {
  const shape = TF_SHAPE[tf] || TF_SHAPE['1D']
  if (tf === '1D') {
    const anchors = symbol === 'NVDA' ? NVDA_1D_ANCHORS : genericAnchors(symbol, price, base)
    return shapedSeries({ seed: seedOf(symbol + tf), n: shape.n, base, anchors, start: todayET6am(), step: shape.step })
  }
  const drift = { '5D': 2, '1M': 5, '6M': 18, YTD: 30, '1Y': 26, '5Y': 400, All: 1500 }[tf] || 5
  const startV = price / (1 + drift / 100)
  const anchors = [
    [0, 0], [0.3, drift * 0.35], [0.45, drift * 0.22], [0.7, drift * 0.7], [0.85, drift * 0.8], [1, drift],
  ]
  const end = Date.now()
  const series = shapedSeries({
    seed: seedOf(symbol + tf),
    n: shape.n,
    base: startV,
    anchors,
    noise: Math.max(0.6, Math.log10(drift + 1) * 1.4),
    start: end - shape.step * (shape.n - 1),
    step: shape.step,
  })
  series[series.length - 1].v = price
  return series
}

function genericAnchors(symbol, price, base) {
  const end = ((price - base) / base) * 100
  const r = rng(seedOf(symbol))
  return [
    [0, 0], [0.15, end * 0.3 + (r() - 0.5)], [0.35, end * 0.7 + (r() - 0.5)],
    [0.55, end * 0.4 + (r() - 0.5)], [0.8, end * 0.9 + (r() - 0.5) * 0.6], [1, end],
  ]
}

export function sparkSeries(symbol, up, n = 40) {
  const r = rng(seedOf(symbol + 'spark'))
  let v = 50
  const out = []
  for (let i = 0; i < n; i++) {
    v += (r() - 0.5) * 9 + (up ? 0.45 : -0.45)
    out.push(v)
  }
  return out
}

export const PROFILES = {
  NVDA: {
    symbol: 'NVDA',
    name: 'Nvidia Corporation',
    watchName: 'Nvidia Corp',
    short: 'Nvidia',
    exchange: 'NasdaqGS',
    snapshot: {
      price: 182.32, changePct: 2.11, prevClose: 178.55, open: 179.1, dayLow: 177.9, dayHigh: 184.2,
      low52: 86.62, high52: 212.19, volume: 289e6, time: null,
    },
    watch: { price: 190.17, change: 3.31, changePct: 1.77 },
    stats: { marketCap: 4.43e12, pe: 44.96, divYield: 0.02, eps: 4.05 },
    returns: { ytd: [36.85, 12.15], y1: [25.98, 11.47], y5: [1308.19, 85.41] },
  },
  AAPL: {
    symbol: 'AAPL', name: 'Apple Inc.', watchName: 'Apple Inc', short: 'Apple', exchange: 'NasdaqGS',
    snapshot: { price: 272.41, changePct: 0.64, prevClose: 270.68, open: 271.2, dayLow: 269.9, dayHigh: 274.1, low52: 169.21, high52: 280.38, volume: 48e6 },
    watch: { price: 272.41, change: 1.73, changePct: 0.64 },
    stats: { marketCap: 4.04e12, pe: 36.6, divYield: 0.38, eps: 7.46 },
    returns: { ytd: [8.4, 12.15], y1: [19.7, 11.47], y5: [141.2, 85.41] },
  },
  GOOG: {
    symbol: 'GOOG', name: 'Alphabet Inc.', watchName: 'Alphabet Inc', short: 'Alphabet', exchange: 'NasdaqGS',
    snapshot: { price: 276.41, changePct: 0.79, prevClose: 274.25, open: 274.9, dayLow: 273.6, dayHigh: 278.02, low52: 142.66, high52: 281.5, volume: 31e6 },
    watch: { price: 276.41, change: 2.16, changePct: 0.78 },
    stats: { marketCap: 3.34e12, pe: 27.1, divYield: 0.3, eps: 10.2 },
    returns: { ytd: [45.2, 12.15], y1: [62.3, 11.47], y5: [236.4, 85.41] },
  },
  AMZN: {
    symbol: 'AMZN', name: 'Amazon.com, Inc.', watchName: 'Amazon.com Inc', short: 'Amazon', exchange: 'NasdaqGS',
    snapshot: { price: 234.69, changePct: -1.22, prevClose: 237.58, open: 237.1, dayLow: 233.8, dayHigh: 238.3, low52: 161.38, high52: 242.52, volume: 42e6 },
    watch: { price: 234.69, change: -2.89, changePct: -1.22 },
    stats: { marketCap: 2.5e12, pe: 35.4, divYield: 0, eps: 6.63 },
    returns: { ytd: [7.1, 12.15], y1: [21.4, 11.47], y5: [45.8, 85.41] },
  },
}

export const INDEXES = [
  { symbol: '^GSPC', name: 'S&P 500', snapshot: { price: 6664.36, prevClose: 6631.96 } },
  { symbol: '^IXIC', name: 'Nasdaq Composite', snapshot: { price: 22631.48, prevClose: 22470.73 } },
  { symbol: '^DJI', name: 'Dow Jones', snapshot: { price: 46142.42, prevClose: 46018.32 } },
]

export const SECTORS = [
  { key: 'tech', name: 'Technology', value: 295.53, pct: 20.94, fill: 0.72, icon: 'cpu' },
  { key: 'fin', name: 'Financial', value: 113.28, pct: -11.39, fill: 0.2, icon: 'landmark' },
  { key: 'health', name: 'Healthcare', value: 176.89, pct: 13.89, fill: 0.42, icon: 'hospital' },
]
