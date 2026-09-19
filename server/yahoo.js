// Yahoo Finance access for the server: chart, search/news, and quoteSummary (crumb-authenticated).
// Yahoo rate-limits full browser UAs, so requests go out with a bare UA and no browser headers.

const BASE = 'https://query1.finance.yahoo.com'
const UA = 'Mozilla/5.0'
const cache = new Map()

async function cached(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value
  const value = await fn()
  cache.set(key, { at: Date.now(), value })
  if (cache.size > 2000) cache.delete(cache.keys().next().value)
  return value
}

async function getJSON(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    const err = new Error(`Yahoo ${res.status} for ${url.replace(BASE, '')}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const RANGES = {
  '1D': { range: '1d', interval: '5m', prepost: true, ttl: 30e3 },
  '5D': { range: '5d', interval: '30m', ttl: 60e3 },
  '1M': { range: '1mo', interval: '1d', ttl: 300e3 },
  '6M': { range: '6mo', interval: '1d', ttl: 600e3 },
  YTD: { range: 'ytd', interval: '1d', ttl: 600e3 },
  '1Y': { range: '1y', interval: '1d', ttl: 600e3 },
  '5Y': { range: '5y', interval: '1wk', ttl: 3600e3 },
  All: { range: 'max', interval: '1mo', ttl: 3600e3 },
}

export async function chart(symbol, tf = '1D') {
  const r = RANGES[tf] || RANGES['1D']
  const url =
    `${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${r.range}&interval=${r.interval}${r.prepost ? '&includePrePost=true' : ''}`
  return cached(`chart:${symbol}:${tf}`, r.ttl, async () => {
    const json = await getJSON(url)
    const result = json?.chart?.result?.[0]
    if (!result?.timestamp) throw Object.assign(new Error(`No price data for ${symbol}`), { status: 404 })
    const q = result.indicators.quote[0]
    const points = []
    result.timestamp.forEach((t, i) => {
      if (q.close[i] != null) points.push({ t: t * 1000, v: +q.close[i].toFixed(4), o: q.open[i] })
    })
    return { meta: result.meta, points }
  })
}

/** Current quote derived from the 1D chart (works without a crumb). */
export async function quote(symbol) {
  const { meta, points } = await chart(symbol, '1D')
  const prevClose = meta.chartPreviousClose ?? meta.previousClose
  const price = meta.regularMarketPrice
  const reg = meta.currentTradingPeriod?.regular
  const firstRegular = reg ? points.find((p) => p.t >= reg.start * 1000) : null
  const now = Date.now() / 1000
  return {
    quote: {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || symbol,
      exchange: meta.fullExchangeName || meta.exchangeName,
      currency: meta.currency,
      instrumentType: meta.instrumentType,
      price,
      prevClose,
      change: price - prevClose,
      changePct: meta.regularMarketChangePercent ?? ((price - prevClose) / prevClose) * 100,
      open: firstRegular?.o ?? points[0]?.v,
      dayLow: meta.regularMarketDayLow,
      dayHigh: meta.regularMarketDayHigh,
      low52: meta.fiftyTwoWeekLow,
      high52: meta.fiftyTwoWeekHigh,
      volume: meta.regularMarketVolume,
      time: meta.regularMarketTime * 1000,
      marketState: reg && now >= reg.start && now < reg.end ? 'open' : 'closed',
      live: true,
    },
    points: points.map(({ t, v }) => ({ t, v })),
  }
}

/** Map with bounded concurrency so screeners don't hammer Yahoo. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++
      try {
        out[k] = await fn(items[k])
      } catch (err) {
        out[k] = { error: err.message }
      }
    }
  })
  await Promise.all(workers)
  return out
}

export async function search(query) {
  return cached(`search:${query.toLowerCase()}`, 300e3, async () => {
    const json = await getJSON(
      `${BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=8&enableFuzzyQuery=true`,
    )
    return {
      quotes: (json.quotes || [])
        .filter((q) => q.symbol && ['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND', 'CRYPTOCURRENCY'].includes(q.quoteType))
        .map((q) => ({
          symbol: q.symbol,
          name: q.longname || q.shortname || q.symbol,
          exchange: q.exchDisp,
          type: q.typeDisp || q.quoteType,
          sector: q.sector,
          industry: q.industry,
        })),
      news: (json.news || []).map((n) => ({
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        time: n.providerPublishTime ? n.providerPublishTime * 1000 : null,
      })),
    }
  })
}

/* ------------------------------------------------------------ quoteSummary */

let crumbState = null

async function getCrumb(force = false) {
  if (crumbState && !force && Date.now() - crumbState.at < 6 * 3600e3) return crumbState
  const res = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  })
  const cookie = (res.headers.getSetCookie?.() || [])
    .map((c) => c.split(';')[0])
    .join('; ')
  const crumbRes = await fetch(`${BASE}/v1/test/getcrumb`, {
    headers: { 'User-Agent': UA, Cookie: cookie },
    signal: AbortSignal.timeout(8000),
  })
  const crumb = await crumbRes.text()
  if (!crumbRes.ok || !crumb || crumb.includes('<')) throw new Error('Could not obtain Yahoo crumb')
  crumbState = { cookie, crumb, at: Date.now() }
  return crumbState
}

const raw = (x) => (x && typeof x === 'object' && 'raw' in x ? x.raw : (x ?? null))

export async function fundamentals(symbol) {
  return cached(`fund:${symbol}`, 15 * 60e3, async () => {
    const modules = 'price,summaryDetail,defaultKeyStatistics,financialData,earnings,calendarEvents,assetProfile'
    let json
    for (let attempt = 0; attempt < 2; attempt++) {
      const { cookie, crumb } = await getCrumb(attempt > 0)
      try {
        json = await getJSON(
          `${BASE}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`,
          { Cookie: cookie },
        )
        break
      } catch (err) {
        if (err.status !== 401 || attempt) throw err
      }
    }
    const r = json?.quoteSummary?.result?.[0]
    if (!r) throw Object.assign(new Error(`No fundamentals for ${symbol}`), { status: 404 })
    const sd = r.summaryDetail || {}
    const ks = r.defaultKeyStatistics || {}
    const fd = r.financialData || {}
    const ap = r.assetProfile || {}
    const earn = r.earnings || {}
    const quarterly = earn.earningsChart?.quarterly || []
    const fin = earn.financialsChart?.quarterly || []
    const nextEarnings = r.calendarEvents?.earnings?.earningsDate?.[0]
    return {
      symbol,
      name: r.price?.longName || r.price?.shortName || symbol,
      sector: ap.sector || null,
      industry: ap.industry || null,
      employees: ap.fullTimeEmployees || null,
      website: ap.website || null,
      summary: ap.longBusinessSummary ? ap.longBusinessSummary.slice(0, 900) : null,
      marketCap: raw(sd.marketCap) ?? raw(r.price?.marketCap),
      trailingPE: raw(sd.trailingPE),
      forwardPE: raw(sd.forwardPE) ?? raw(ks.forwardPE),
      eps: raw(ks.trailingEps),
      forwardEps: raw(ks.forwardEps),
      dividendYield: raw(sd.dividendYield) != null ? raw(sd.dividendYield) * 100 : null,
      beta: raw(sd.beta),
      priceToBook: raw(ks.priceToBook),
      profitMargin: raw(fd.profitMargins) != null ? raw(fd.profitMargins) * 100 : null,
      operatingMargin: raw(fd.operatingMargins) != null ? raw(fd.operatingMargins) * 100 : null,
      revenueGrowth: raw(fd.revenueGrowth) != null ? raw(fd.revenueGrowth) * 100 : null,
      earningsGrowth: raw(fd.earningsGrowth) != null ? raw(fd.earningsGrowth) * 100 : null,
      returnOnEquity: raw(fd.returnOnEquity) != null ? raw(fd.returnOnEquity) * 100 : null,
      totalCash: raw(fd.totalCash),
      totalDebt: raw(fd.totalDebt),
      debtToEquity: raw(fd.debtToEquity),
      freeCashflow: raw(fd.freeCashflow),
      totalRevenue: raw(fd.totalRevenue),
      currentPrice: raw(fd.currentPrice) ?? raw(r.price?.regularMarketPrice),
      targetMeanPrice: raw(fd.targetMeanPrice),
      targetHighPrice: raw(fd.targetHighPrice),
      targetLowPrice: raw(fd.targetLowPrice),
      recommendation: fd.recommendationKey || null,
      analystCount: raw(fd.numberOfAnalystOpinions),
      nextEarningsDate: nextEarnings ? raw(nextEarnings) * 1000 : null,
      epsHistory: quarterly.map((q) => ({
        quarter: q.fiscalQuarter || q.date,
        actual: raw(q.actual),
        estimate: raw(q.estimate),
        surprisePct: q.surprisePct != null ? Number(q.surprisePct) : null,
      })),
      financials: fin.map((q) => ({ quarter: q.fiscalQuarter || q.date, revenue: raw(q.revenue), earnings: raw(q.earnings) })),
    }
  })
}

/* ---------------------------------------------------------------- analytics */

export function seriesStats(points) {
  if (points.length < 2) return null
  const first = points[0].v
  const last = points[points.length - 1].v
  let hi = -Infinity
  let lo = Infinity
  let peak = first
  let maxDd = 0
  const rets = []
  for (let i = 0; i < points.length; i++) {
    const v = points[i].v
    hi = Math.max(hi, v)
    lo = Math.min(lo, v)
    peak = Math.max(peak, v)
    maxDd = Math.min(maxDd, (v - peak) / peak)
    if (i) rets.push(Math.log(v / points[i - 1].v))
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1))
  const spanDays = (points[points.length - 1].t - points[0].t) / 86400e3
  const perYear = spanDays > 0 ? rets.length / (spanDays / 365) : 252
  return {
    start: first,
    end: last,
    returnPct: ((last - first) / first) * 100,
    high: hi,
    low: lo,
    maxDrawdownPct: maxDd * 100,
    annualizedVolatilityPct: sd * Math.sqrt(perYear) * 100,
    annualizedDriftPct: mean * perYear * 100,
    fromDate: new Date(points[0].t).toISOString().slice(0, 10),
    toDate: new Date(points[points.length - 1].t).toISOString().slice(0, 10),
  }
}

export function returnsFrom(points) {
  const last = points[points.length - 1]
  const at = (ms) => {
    let best = points[0]
    for (const p of points) if (p.t <= ms) best = p
    return best.v
  }
  const jan1 = Date.UTC(new Date(last.t).getUTCFullYear(), 0, 1)
  const pct = (from) => ((last.v - from) / from) * 100
  return { ytd: pct(at(jan1 - 1)), y1: pct(at(last.t - 365 * 86400e3)), y5: pct(points[0].v) }
}
