// Client-side (our server) tools the Claude agent can call. Each returns
// { result } for the model and optionally { card, sources, action } for the UI.
import { z } from 'zod'
import { chart, fundamentals, mapLimit, quote, returnsFrom, search, seriesStats } from './yahoo.js'
import { simulate } from './simulate.js'

const Symbol = z
  .string()
  .trim()
  .min(1)
  .max(15)
  .regex(/^[\^A-Za-z0-9.=-]+$/, 'Invalid ticker symbol')
  .transform((s) => s.toUpperCase())

export const INDEXES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq Composite' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^RUT', name: 'Russell 2000' },
  { symbol: '^VIX', name: 'VIX' },
]

export const SECTOR_ETFS = [
  { symbol: 'XLK', name: 'Technology', icon: 'cpu' },
  { symbol: 'XLF', name: 'Financial', icon: 'landmark' },
  { symbol: 'XLV', name: 'Healthcare', icon: 'hospital' },
  { symbol: 'XLE', name: 'Energy', icon: 'bolt' },
  { symbol: 'XLY', name: 'Consumer Disc.', icon: 'cart' },
  { symbol: 'XLI', name: 'Industrials', icon: 'factory' },
  { symbol: 'XLC', name: 'Communication', icon: 'globe' },
  { symbol: 'XLP', name: 'Consumer Staples', icon: 'cart' },
  { symbol: 'XLU', name: 'Utilities', icon: 'bolt' },
  { symbol: 'XLRE', name: 'Real Estate', icon: 'home' },
  { symbol: 'XLB', name: 'Materials', icon: 'cube' },
]

const round = (n, d = 2) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d)
const spark = (points, n = 48) => {
  const step = Math.max(1, Math.floor(points.length / n))
  return points.filter((_, i) => i % step === 0).map((p) => p.v)
}

async function safeFundamentals(symbol) {
  try {
    return await fundamentals(symbol)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ shared */

export async function stockCard(symbol) {
  const [{ quote: q, points }, f, week] = await Promise.all([
    quote(symbol),
    safeFundamentals(symbol),
    chart(symbol, '5D').catch(() => null),
  ])
  const weekStart = week?.points?.[0]?.v
  return {
    type: 'stock',
    quote: q,
    points,
    weekChangePct: weekStart ? ((q.price - weekStart) / weekStart) * 100 : null,
    stats: {
      marketCap: f?.marketCap ?? null,
      pe: f?.trailingPE ?? null,
      divYield: f?.dividendYield ?? (f ? 0 : null),
      eps: f?.eps ?? null,
    },
    profile: {
      symbol: q.symbol,
      name: f?.name || q.name,
      short: shortName(f?.name || q.name),
      exchange: q.exchange,
      sector: f?.sector,
    },
    fundamentals: f,
  }
}

export function shortName(name) {
  return (name || '')
    .replace(/,?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.?|Ltd\.?|Limited|plc|N\.V\.|S\.A\.|Holdings?|Group|Class [A-C])$/gi, '')
    .replace(/,?\s+(Inc\.?|Corporation|Corp\.?)$/i, '')
    .replace(/^NVIDIA$/i, 'Nvidia')
    .trim()
}

export async function marketOverview() {
  const [idx, sectors] = await Promise.all([
    mapLimit(INDEXES, 5, async (i) => {
      const { quote: q, points } = await quote(i.symbol)
      return { symbol: i.symbol, name: i.name, price: q.price, change: q.change, changePct: q.changePct, spark: spark(points) }
    }),
    mapLimit(SECTOR_ETFS, 6, async (s) => {
      const [{ quote: q }, ytd] = await Promise.all([quote(s.symbol), chart(s.symbol, 'YTD')])
      const first = ytd.points[0].v
      return {
        key: s.symbol,
        symbol: s.symbol,
        name: s.name,
        icon: s.icon,
        value: q.price,
        dayPct: q.changePct,
        pct: ((q.price - first) / first) * 100,
      }
    }),
  ])
  return { indexes: idx.filter((i) => !i.error), sectors: sectors.filter((s) => !s.error) }
}

export async function compareRows(symbols, includeBenchmark = true) {
  const list = [...new Set([...symbols, ...(includeBenchmark ? ['^GSPC'] : [])])].slice(0, 5)
  const rows = await mapLimit(list, 5, async (s) => {
    const { meta, points } = await chart(s, '5Y')
    const r = returnsFrom(points)
    return {
      symbol: s,
      name: s === '^GSPC' ? 'S&P 500' : shortName(meta.longName || meta.shortName || s),
      ytd: r.ytd,
      y1: r.y1,
      y5: r.y5,
      vol: seriesStats(points)?.annualizedVolatilityPct ?? null,
    }
  })
  return rows.filter((r) => !r.error)
}

/* ------------------------------------------------------------------- tools */

const defs = [
  {
    name: 'get_stock_snapshot',
    label: (i) => `Pulling ${i.symbol} price action and fundamentals`,
    description:
      'Live quote for one ticker: price, day change, day/52-week range, volume, 5-day change, market cap, P/E, EPS, dividend yield, sector, analyst target. Also renders an interactive price card for the user. Call this whenever you discuss a specific stock.',
    schema: z.object({ symbol: Symbol }),
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Ticker symbol, e.g. NVDA, AAPL, BRK-B, ^GSPC' } },
      required: ['symbol'],
    },
    async run({ symbol }) {
      const card = await stockCard(symbol)
      const q = card.quote
      const f = card.fundamentals
      return {
        card,
        result: {
          symbol: q.symbol,
          name: card.profile.name,
          price: round(q.price),
          currency: q.currency,
          dayChangePct: round(q.changePct),
          weekChangePct: round(card.weekChangePct),
          prevClose: round(q.prevClose),
          dayRange: [round(q.dayLow), round(q.dayHigh)],
          range52w: [round(q.low52), round(q.high52)],
          volume: q.volume,
          marketState: q.marketState,
          asOf: new Date(q.time).toISOString(),
          marketCap: f?.marketCap ?? null,
          trailingPE: round(f?.trailingPE),
          forwardPE: round(f?.forwardPE),
          eps: f?.eps ?? null,
          dividendYieldPct: round(f?.dividendYield),
          sector: f?.sector ?? null,
          industry: f?.industry ?? null,
          analystTargetMean: round(f?.targetMeanPrice),
          analystRecommendation: f?.recommendation ?? null,
          nextEarningsDate: f?.nextEarningsDate ? new Date(f.nextEarningsDate).toISOString().slice(0, 10) : null,
        },
      }
    },
  },
  {
    name: 'get_price_history',
    label: (i) => `Measuring ${i.symbol} over ${i.range}`,
    description:
      'Statistics for a ticker over a lookback window: start/end price, total return, high, low, max drawdown, annualized volatility. Use for trend, volatility and drawdown questions.',
    schema: z.object({ symbol: Symbol, range: z.enum(['5D', '1M', '6M', 'YTD', '1Y', '5Y', 'All']) }),
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        range: { type: 'string', enum: ['5D', '1M', '6M', 'YTD', '1Y', '5Y', 'All'] },
      },
      required: ['symbol', 'range'],
    },
    async run({ symbol, range }) {
      const { points } = await chart(symbol, range)
      const s = seriesStats(points)
      return { result: { symbol, range, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v])) } }
    },
  },
  {
    name: 'get_fundamentals',
    label: (i) => `Reading ${i.symbol} financial statements`,
    description:
      'Detailed fundamentals for one company: valuation (trailing/forward P/E, P/B), margins, growth, ROE, cash, debt, free cash flow, quarterly EPS actual vs estimate, quarterly revenue and earnings, analyst targets, business summary. Renders a financial-health card. Use for financial health, valuation, and earnings questions.',
    schema: z.object({ symbol: Symbol }),
    input_schema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] },
    async run({ symbol }) {
      const f = await fundamentals(symbol)
      return { card: { type: 'fundamentals', data: f }, result: f }
    },
  },
  {
    name: 'compare_performance',
    label: (i) => `Comparing ${i.symbols.join(', ')}`,
    description:
      'Compare YTD, 1-year and 5-year total price returns plus annualized volatility for up to 4 tickers, optionally against the S&P 500. Renders a comparison table.',
    schema: z.object({
      symbols: z.array(Symbol).min(1).max(4),
      include_benchmark: z.boolean().optional().default(true),
    }),
    input_schema: {
      type: 'object',
      properties: {
        symbols: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
        include_benchmark: { type: 'boolean', description: 'Add the S&P 500 as a benchmark row (default true)' },
      },
      required: ['symbols'],
    },
    async run({ symbols, include_benchmark }) {
      const rows = await compareRows(symbols, include_benchmark)
      return {
        card: { type: 'compare', rows },
        result: rows.map((r) => ({ ...r, ytd: round(r.ytd), y1: round(r.y1), y5: round(r.y5), vol: round(r.vol) })),
      }
    },
  },
  {
    name: 'get_market_overview',
    label: () => 'Reading the tape across indexes and sectors',
    description:
      'Live snapshot of the S&P 500, Nasdaq, Dow, Russell 2000, VIX and the 11 SPDR sector ETFs (day change and YTD). Use for market sentiment, breadth and sector rotation questions. Renders index cards.',
    schema: z.object({}).passthrough(),
    input_schema: { type: 'object', properties: {} },
    async run() {
      const o = await marketOverview()
      return {
        card: { type: 'market', items: o.indexes.filter((i) => i.symbol !== '^VIX').slice(0, 3), sectors: o.sectors },
        result: {
          indexes: o.indexes.map((i) => ({ name: i.name, price: round(i.price), dayChangePct: round(i.changePct) })),
          sectors: o.sectors.map((s) => ({ sector: s.name, etf: s.symbol, dayChangePct: round(s.dayPct), ytdPct: round(s.pct) })),
        },
      }
    },
  },
  {
    name: 'search_ticker',
    label: (i) => `Looking up "${i.query}"`,
    description: 'Find ticker symbols by company name or keyword. Use when unsure of the exact symbol.',
    schema: z.object({ query: z.string().trim().min(1).max(80) }),
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    async run({ query }) {
      const r = await search(query)
      return { result: r.quotes.slice(0, 6) }
    },
  },
  {
    name: 'get_news',
    label: (i) => `Scanning headlines for ${i.query}`,
    description: 'Recent news headlines (title, publisher, link, time) for a company, ticker or topic.',
    schema: z.object({ query: z.string().trim().min(1).max(80) }),
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Ticker or topic' } }, required: ['query'] },
    async run({ query }) {
      const r = await search(query)
      const news = r.news.slice(0, 8)
      return {
        sources: news.map((n) => ({ title: n.title, url: n.link, publisher: n.publisher })),
        result: news.map((n) => ({ ...n, time: n.time ? new Date(n.time).toISOString() : null })),
      }
    },
  },
  {
    name: 'simulate_investment',
    label: (i) => `Simulating $${i.amount} in ${i.symbol}`,
    description:
      'Backtest a lump-sum investment in a ticker over the past N years and project a forward range (bear/base/bull) from historical volatility. Renders a simulation card. Illustrative only.',
    schema: z.object({ symbol: Symbol, amount: z.number().positive().max(1e9), years: z.number().int().min(1).max(10) }),
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        amount: { type: 'number', description: 'Dollar amount invested' },
        years: { type: 'integer', minimum: 1, maximum: 10, description: 'Backtest length and projection horizon in years' },
      },
      required: ['symbol', 'amount', 'years'],
    },
    async run(input) {
      const sim = await simulate(input)
      return { card: { type: 'simulation', data: sim }, result: { ...sim, path: undefined, projection: undefined } }
    },
  },
  {
    name: 'add_to_watchlist',
    label: (i) => `Adding ${i.symbol} to your watchlist`,
    description: "Add a ticker to the user's watchlist in the Insight panel. Only call when the user asks.",
    schema: z.object({ symbol: Symbol }),
    input_schema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] },
    async run({ symbol }) {
      await quote(symbol) // validates that the symbol exists
      return { action: { type: 'watch', symbol }, result: { ok: true, symbol } }
    },
  },
  {
    name: 'set_price_alert',
    label: (i) => `Setting an alert on ${i.symbol}`,
    description: 'Create a price alert that notifies the user when a ticker crosses a price. Only call when the user asks.',
    schema: z.object({ symbol: Symbol, direction: z.enum(['above', 'below']), price: z.number().positive() }),
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        direction: { type: 'string', enum: ['above', 'below'] },
        price: { type: 'number' },
      },
      required: ['symbol', 'direction', 'price'],
    },
    async run({ symbol, direction, price }) {
      await quote(symbol)
      return { action: { type: 'alert', symbol, direction, price }, result: { ok: true, symbol, direction, price } }
    },
  },
  {
    name: 'propose_paper_trade',
    label: (i) => `Preparing a paper ${i.side} ticket for ${i.symbol}`,
    description:
      "Open a paper-trading order ticket (simulated money, no real brokerage) for the user to review and confirm. Never assume it executed; the user must confirm in the ticket. Only call when the user asks to buy or sell.",
    schema: z.object({ symbol: Symbol, side: z.enum(['buy', 'sell']), quantity: z.number().positive().max(1e7) }),
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        side: { type: 'string', enum: ['buy', 'sell'] },
        quantity: { type: 'number', description: 'Number of shares' },
      },
      required: ['symbol', 'side', 'quantity'],
    },
    async run({ symbol, side, quantity }) {
      const { quote: q } = await quote(symbol)
      return {
        action: { type: 'trade', symbol, side, quantity, price: q.price },
        result: { ticketOpened: true, symbol, side, quantity, indicativePrice: round(q.price), note: 'Awaiting user confirmation' },
      }
    },
  },
]

// Deterministic order keeps the tools prefix cacheable.
export const TOOLS = defs
  .map((d) => ({ name: d.name, description: d.description, input_schema: d.input_schema, eager_input_streaming: true }))
  .sort((a, b) => a.name.localeCompare(b.name))

const byName = Object.fromEntries(defs.map((d) => [d.name, d]))

export function toolLabel(name, input) {
  try {
    return byName[name]?.label(input || {}) || 'Working'
  } catch {
    return 'Working'
  }
}

/** Validate and run one tool call. Never throws; errors become is_error results. */
export async function runTool(name, input) {
  const def = byName[name]
  if (!def) return { isError: true, result: { error: `Unknown tool ${name}` } }
  const parsed = def.schema.safeParse(input ?? {})
  if (!parsed.success) {
    return { isError: true, result: { INVALID_INPUT: JSON.stringify(input), issues: parsed.error.issues.map((i) => i.message) } }
  }
  try {
    return await def.run(parsed.data)
  } catch (err) {
    return { isError: true, result: { error: err.message || String(err) } }
  }
}
