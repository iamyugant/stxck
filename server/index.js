import express from 'express'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { aiEnabled, MODEL, resetClient, runAgent } from './agent.js'
import { chart, fundamentals, mapLimit, quote, RANGES, search } from './yahoo.js'
import { compareRows, marketOverview, shortName, spark, stockCard } from './tools.js'
import { simulate } from './simulate.js'
import { attachUser, authRouter, requireAuth, sameOrigin } from './auth.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const isProd = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT) || 5173

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
// SSE must not be buffered by compression.
app.use(compression({ filter: (req, res) => req.path !== '/api/chat' && compression.filter(req, res) }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)')
  if (isProd) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
        "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com data:",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    )
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})
app.use('/api', express.json({ limit: '25mb' }))

const SYMBOL_RE = /^[\^A-Za-z0-9.=-]{1,15}$/
const sym = (s) => (SYMBOL_RE.test(s || '') ? s.toUpperCase() : null)
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    res.status(err.status && err.status < 500 ? err.status : 502).json({ error: err.message || 'Upstream error' })
  })
const bySymbol = (fn) =>
  wrap(async (req, res) => {
    const s = sym(req.params.symbol)
    if (!s) return res.status(400).json({ error: 'Invalid symbol' })
    res.json(await fn(s))
  })

const hits = new Map()
function rateLimit(limit, windowMs) {
  return (req, res, next) => {
    const key = `${req.user?.id || req.ip}:${req.baseUrl}${req.path}`
    const now = Date.now()
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs)
    if (arr.length >= limit) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - arr[0])) / 1000))
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' })
    }
    arr.push(now)
    hits.set(key, arr)
    next()
  }
}
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of hits) if (!v.some((t) => now - t < 600e3)) hits.delete(k)
}, 60e3).unref()

app.use('/api', attachUser, sameOrigin)
app.get('/api/health', (req, res) => res.json({ ok: true, ai: aiEnabled(), model: aiEnabled() ? MODEL : null }))
app.use('/api/auth', rateLimit(60, 60e3), authRouter)

// Public ticker tape for the landing page (fixed symbol list, cached upstream).
const TAPE = ['^GSPC', '^IXIC', '^DJI', 'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'JPM']
app.get(
  '/api/public/tape',
  rateLimit(60, 60e3),
  wrap(async (req, res) => {
    const out = await mapLimit(TAPE, 6, async (s) => {
      const { quote: q } = await quote(s)
      const label = { '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq', '^DJI': 'Dow' }[s]
      return { symbol: s, name: label || shortName(q.name), price: q.price, changePct: q.changePct }
    })
    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json(out.filter((o) => !o.error))
  }),
)

app.use('/api', (req, res, next) => (req.path === '/' || req.path.startsWith('/public') ? next() : requireAuth(req, res, next)))

app.get(
  '/api/search',
  rateLimit(120, 60e3),
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80)
    if (!q) return res.json({ quotes: [], news: [] })
    res.json(await search(q))
  }),
)

app.get('/api/stock/:symbol', rateLimit(120, 60e3), bySymbol(stockCard))
app.get('/api/fundamentals/:symbol', rateLimit(120, 60e3), bySymbol(fundamentals))

app.get(
  '/api/series/:symbol',
  rateLimit(240, 60e3),
  wrap(async (req, res) => {
    const s = sym(req.params.symbol)
    const tf = String(req.query.tf || '1D')
    if (!s || !RANGES[tf]) return res.status(400).json({ error: 'Invalid symbol or timeframe' })
    const { meta, points } = await chart(s, tf)
    const base = tf === '1D' ? (meta.chartPreviousClose ?? points[0].v) : points[0].v
    res.json({ points: points.map(({ t, v }) => ({ t, v })), base, name: meta.longName || meta.shortName || s })
  }),
)

app.get(
  '/api/quotes',
  rateLimit(120, 60e3),
  wrap(async (req, res) => {
    const list = String(req.query.symbols || '')
      .split(',')
      .map(sym)
      .filter(Boolean)
      .slice(0, 60)
    const out = await mapLimit(list, 6, async (s) => {
      const { quote: q, points } = await quote(s)
      return {
        symbol: s,
        name: shortName(q.name),
        fullName: q.name,
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        volume: q.volume,
        spark: spark(points),
        live: true,
      }
    })
    res.json(Object.fromEntries(out.map((o, i) => [list[i], o])))
  }),
)

app.get('/api/market', rateLimit(60, 60e3), wrap(async (req, res) => res.json(await marketOverview())))

app.get(
  '/api/compare',
  rateLimit(60, 60e3),
  wrap(async (req, res) => {
    const list = String(req.query.symbols || '').split(',').map(sym).filter(Boolean).slice(0, 4)
    if (!list.length) return res.status(400).json({ error: 'No symbols' })
    res.json({ rows: await compareRows(list, req.query.benchmark !== '0') })
  }),
)

app.post(
  '/api/simulate',
  rateLimit(60, 60e3),
  wrap(async (req, res) => {
    const s = sym(req.body?.symbol)
    const amount = Number(req.body?.amount)
    const years = Math.round(Number(req.body?.years))
    if (!s || !(amount > 0 && amount <= 1e9) || !(years >= 1 && years <= 10)) {
      return res.status(400).json({ error: 'Invalid simulation input' })
    }
    res.json(await simulate({ symbol: s, amount, years }))
  }),
)

// Large caps with static, GICS-style sector labels.
const SCREENER_UNIVERSE = [
  ['AAPL', 'Apple', 'Technology'], ['MSFT', 'Microsoft', 'Technology'], ['NVDA', 'Nvidia', 'Technology'],
  ['AVGO', 'Broadcom', 'Technology'], ['ORCL', 'Oracle', 'Technology'], ['AMD', 'AMD', 'Technology'],
  ['CRM', 'Salesforce', 'Technology'], ['ADBE', 'Adobe', 'Technology'], ['INTC', 'Intel', 'Technology'],
  ['GOOGL', 'Alphabet', 'Communication'], ['META', 'Meta Platforms', 'Communication'], ['NFLX', 'Netflix', 'Communication'],
  ['DIS', 'Disney', 'Communication'], ['AMZN', 'Amazon', 'Consumer Disc.'], ['TSLA', 'Tesla', 'Consumer Disc.'],
  ['HD', 'Home Depot', 'Consumer Disc.'], ['MCD', "McDonald's", 'Consumer Disc.'], ['NKE', 'Nike', 'Consumer Disc.'],
  ['WMT', 'Walmart', 'Consumer Staples'], ['COST', 'Costco', 'Consumer Staples'], ['PG', 'Procter & Gamble', 'Consumer Staples'],
  ['KO', 'Coca-Cola', 'Consumer Staples'], ['JPM', 'JPMorgan Chase', 'Financial'], ['BAC', 'Bank of America', 'Financial'],
  ['V', 'Visa', 'Financial'], ['MA', 'Mastercard', 'Financial'], ['GS', 'Goldman Sachs', 'Financial'],
  ['BRK-B', 'Berkshire Hathaway', 'Financial'], ['LLY', 'Eli Lilly', 'Healthcare'], ['UNH', 'UnitedHealth', 'Healthcare'],
  ['JNJ', 'Johnson & Johnson', 'Healthcare'], ['ABBV', 'AbbVie', 'Healthcare'], ['MRK', 'Merck', 'Healthcare'],
  ['PFE', 'Pfizer', 'Healthcare'], ['XOM', 'Exxon Mobil', 'Energy'], ['CVX', 'Chevron', 'Energy'],
  ['CAT', 'Caterpillar', 'Industrials'], ['GE', 'GE Aerospace', 'Industrials'], ['BA', 'Boeing', 'Industrials'],
  ['NEE', 'NextEra Energy', 'Utilities'], ['PLD', 'Prologis', 'Real Estate'], ['LIN', 'Linde', 'Materials'],
].map(([symbol, name, sector]) => ({ symbol, name, sector }))

app.get(
  '/api/screener',
  rateLimit(30, 60e3),
  wrap(async (req, res) => {
    const rows = await mapLimit(SCREENER_UNIVERSE, 8, async (u) => {
      const { quote: q } = await quote(u.symbol)
      const ytd = await chart(u.symbol, 'YTD').catch(() => null)
      const first = ytd?.points?.[0]?.v
      return {
        ...u,
        price: q.price,
        changePct: q.changePct,
        volume: q.volume,
        high52: q.high52,
        low52: q.low52,
        ytdPct: first ? ((q.price - first) / first) * 100 : null,
        offHighPct: q.high52 ? ((q.price - q.high52) / q.high52) * 100 : null,
      }
    })
    res.json({ rows: rows.filter((r) => !r.error), asOf: Date.now() })
  }),
)

const ALLOWED_MEDIA = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'])

function buildUserContent(text, files = []) {
  const blocks = []
  for (const f of files.slice(0, 6)) {
    if (!f?.data || typeof f.data !== 'string') continue
    const name = String(f.name || 'file').slice(0, 120)
    if (f.kind === 'text') {
      blocks.push({ type: 'text', text: `Attached file "${name}":\n\n${f.data.slice(0, 200000)}` })
    } else if (ALLOWED_MEDIA.has(f.mediaType)) {
      blocks.push(
        f.mediaType === 'application/pdf'
          ? { type: 'document', title: name, source: { type: 'base64', media_type: f.mediaType, data: f.data } }
          : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.data } },
      )
    }
  }
  blocks.push({ type: 'text', text: String(text).slice(0, 12000) })
  return blocks
}

app.post('/api/chat', rateLimit(20, 5 * 60e3), async (req, res) => {
  if (!aiEnabled()) return res.status(503).json({ error: 'AI is not configured', demo: true })
  const { conversationId, text, files, transcript, context, settings } = req.body || {}
  if (!text || typeof text !== 'string' || !/^[\w-]{6,64}$/.test(conversationId || '')) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  const controller = new AbortController()
  res.on('close', () => controller.abort())
  const emit = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  const ping = setInterval(() => res.write(': ping\n\n'), 15e3)

  try {
    await runAgent({
      conversationId: `${req.user.id}:${conversationId}`,
      userContent: buildUserContent(text, files),
      transcript,
      context,
      settings: {
        model: String(settings?.model || 'Stxck 2o'),
        deep: Boolean(settings?.deep),
        web: Boolean(settings?.web),
      },
      emit,
      signal: controller.signal,
    })
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error('[chat]', err?.status || '', err?.message)
      const status = err?.status
      emit('error', {
        message:
          status === 401
            ? 'The AI key is invalid. Check ANTHROPIC_API_KEY on the server.'
            : status === 429
              ? 'Stxck is busy right now. Try again in a moment.'
              : status === 529 || status >= 500
                ? 'The AI service is temporarily overloaded. Try again shortly.'
                : 'Something went wrong while generating the answer.',
      })
    }
  } finally {
    clearInterval(ping)
    res.end()
  }
})

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

if (isProd) {
  const dist = path.join(root, 'dist')
  app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true }))
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html'), { maxAge: 0 }))
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err))

// Dev convenience: pick up edits to .env (e.g. a newly added API key) without a restart.
if (!isProd) {
  const envFile = path.join(root, '.env')
  let timer = 0
  const reload = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      let text = ''
      try {
        text = fs.readFileSync(envFile, 'utf8')
      } catch {
        return
      }
      const before = aiEnabled()
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (!m) continue
        const value = m[2].replace(/^(['"])(.*)\1$/, '$2')
        if (value) process.env[m[1]] = value
        else delete process.env[m[1]]
      }
      resetClient()
      if (aiEnabled() !== before) console.log(`[env] .env reloaded — AI ${aiEnabled() ? `enabled (${MODEL})` : 'disabled (demo mode)'}`)
    }, 150)
  }
  fs.watchFile(envFile, { interval: 1000 }, reload)
}

const server = app.listen(PORT, () => {
  console.log(`Stxck running on http://localhost:${PORT}  (AI: ${aiEnabled() ? MODEL : 'demo mode — set ANTHROPIC_API_KEY'})`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
