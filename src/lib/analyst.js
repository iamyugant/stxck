// Demo mode analyst: used when the server has no ANTHROPIC_API_KEY. It emits the same
// events as the real agent (status/tool/card/text/sources/done) so the UI has one code path.
import { api } from './api.js'
import { getMarket, getStockCard, resolveSymbol } from './market.js'
import { fmt, fmtCompact } from './format.js'

const ALIASES = {
  nvidia: 'NVDA', apple: 'AAPL', google: 'GOOGL', alphabet: 'GOOGL', amazon: 'AMZN', microsoft: 'MSFT',
  tesla: 'TSLA', meta: 'META', facebook: 'META', amd: 'AMD', netflix: 'NFLX', broadcom: 'AVGO',
  palantir: 'PLTR', intel: 'INTC', coinbase: 'COIN', shopify: 'SHOP', walmart: 'WMT', costco: 'COST',
  jpmorgan: 'JPM', visa: 'V', berkshire: 'BRK-B', disney: 'DIS', oracle: 'ORCL', salesforce: 'CRM',
}
const NOT_TICKERS = new Set(['I', 'AI', 'EPS', 'USD', 'PE', 'CEO', 'IPO', 'ETF', 'US', 'OK', 'YTD', 'ME', 'A', 'S', 'P', 'VS'])

export function parseIntent(text) {
  const lower = text.toLowerCase()
  // Collect company names and tickers with their positions so order follows the text.
  const found = []
  for (const m of lower.matchAll(/[a-z]+/g)) if (ALIASES[m[0]]) found.push([m.index, ALIASES[m[0]]])
  for (const m of text.matchAll(/\$?\b([A-Z]{1,5}(?:-[A-Z])?)\b/g)) if (!NOT_TICKERS.has(m[1])) found.push([m.index, m[1]])
  const symbols = [...new Set(found.sort((a, b) => a[0] - b[0]).map((f) => f[1]))]
  const symbol = symbols[0] || null
  if (symbol && /compar|\bvs\.?\b|versus|s&p|against/.test(lower)) return { kind: 'compare', symbols }
  if (symbol && /simulat|invest(ed)? \$?\d|if i (had )?invest/.test(lower)) return { kind: 'simulate', symbol, amount: Number((text.match(/\$?([\d,]{3,})/)?.[1] || '10000').replace(/,/g, '')) }
  if (symbol) return { kind: /health|balance sheet|fundamental|break\s*down|valuation|earnings/.test(lower) ? 'health' : 'analysis', symbol, period: /\btoday\b/.test(lower) ? 'today' : 'week' }
  if (/sentiment|market|sector|index|indices/.test(lower)) return { kind: 'sentiment' }
  if (/diversif|portfolio|allocat|rebalanc/.test(lower)) return { kind: 'diversify' }
  if (/health|break\s*down|fundamental/.test(lower)) return { kind: 'pickCompany' }
  return { kind: 'unknown' }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function streamText(emit, text, signal) {
  const words = text.split(/(\s+)/)
  for (let i = 0; i < words.length; i += 6) {
    if (signal?.aborted) return
    emit('text', { text: words.slice(i, i + 6).join('') })
    await sleep(28)
  }
}

function stockParagraphs(card, kind, period) {
  const q = card.quote
  const f = card.fundamentals || {}
  const name = card.profile.short || q.symbol
  const pct = period === 'week' && card.weekChangePct != null ? card.weekChangePct : q.changePct
  const when = period === 'week' && card.weekChangePct != null ? 'this week' : 'today'
  const pos52 = q.high52 && q.low52 ? (q.price - q.low52) / (q.high52 - q.low52) : 0.5
  const out = [
    `${name} is trading at **$${fmt(q.price)}**, ${pct >= 0 ? 'up' : 'down'} ${fmt(Math.abs(pct))}% ${when}, ` +
      `with today's range between $${fmt(q.dayLow)} and $${fmt(q.dayHigh)}. It sits at ${Math.round(pos52 * 100)}% of its 52-week range ($${fmt(q.low52)}–$${fmt(q.high52)}).`,
  ]
  if (f.marketCap) {
    out.push(
      `At a $${fmtCompact(f.marketCap)} market cap, the stock trades at ${f.trailingPE ? fmt(f.trailingPE, 1) + 'x trailing' : 'n/a trailing'}` +
        `${f.forwardPE ? ` and ${fmt(f.forwardPE, 1)}x forward earnings` : ' earnings'}. ` +
        (f.revenueGrowth != null ? `Revenue grew ${fmt(f.revenueGrowth, 1)}% year over year` : 'Growth data is limited') +
        (f.profitMargin != null ? ` with a ${fmt(f.profitMargin, 1)}% net margin.` : '.'),
    )
  }
  if (kind === 'health' && f.totalCash != null) {
    out.push(
      `**Balance sheet:** $${fmtCompact(f.totalCash)} cash against $${fmtCompact(f.totalDebt || 0)} debt` +
        `${f.freeCashflow ? `, and $${fmtCompact(f.freeCashflow)} of free cash flow` : ''}. ` +
        (f.returnOnEquity != null ? `Return on equity is ${fmt(f.returnOnEquity, 1)}%.` : ''),
    )
  }
  if (f.targetMeanPrice) {
    const upside = ((f.targetMeanPrice - q.price) / q.price) * 100
    out.push(
      `${f.analystCount || 'Covering'} analysts have a mean target of $${fmt(f.targetMeanPrice)} (${upside >= 0 ? '+' : ''}${fmt(upside, 1)}% from here), ` +
        `with a consensus of *${String(f.recommendation || 'n/a').replace('_', ' ')}*.`,
    )
  }
  out.push(
    pos52 > 0.7
      ? 'Momentum is strong, but trading near the top of the range leaves less margin for disappointment on the next earnings print.'
      : pos52 < 0.3
        ? 'The stock is closer to its lows, so the question is whether fundamentals justify a rebound or the market is pricing in more downside.'
        : 'Price action is mid-range, so upcoming earnings and guidance are likely to set the next leg.',
  )
  return out.join('\n\n')
}

export async function runDemo(text, emit, signal) {
  const intent = parseIntent(text)
  emit('status', { text: 'Thinking' })
  await sleep(500)

  if (intent.kind === 'analysis' || intent.kind === 'health') {
    let symbol = intent.symbol
    const toolId = 'demo-stock'
    emit('tool', { id: toolId, label: `Pulling ${symbol} price action and fundamentals`, state: 'running' })
    let card = await getStockCard(symbol)
    if (!card) {
      const resolved = await resolveSymbol(text.replace(/[^\w\s-]/g, ' ').split(/\s+/).find((w) => w.length > 2) || symbol)
      if (resolved && resolved !== symbol) card = await getStockCard((symbol = resolved))
    }
    emit('tool', { id: toolId, label: `Pulling ${symbol} price action and fundamentals`, state: card ? 'done' : 'error' })
    if (!card) {
      await streamText(emit, `I couldn't find market data for **${symbol}**. Check the ticker, or ask about a company by name.`, signal)
      return emit('done', {})
    }
    if (intent.kind === 'health' && !card.fundamentals) {
      try {
        card.fundamentals = await api.fundamentals(symbol)
      } catch {
        /* optional */
      }
    }
    emit('card', { id: toolId, card })
    if (intent.kind === 'health' && card.fundamentals) emit('card', { id: 'demo-fund', card: { type: 'fundamentals', data: card.fundamentals } })
    await sleep(900)
    await streamText(emit, stockParagraphs(card, intent.kind, intent.period), signal)
    emit('sources', { items: [{ title: 'Yahoo Finance', url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}` }] })
    return emit('done', {})
  }

  if (intent.kind === 'compare') {
    const label = `Comparing ${intent.symbols.join(', ')}`
    emit('tool', { id: 'demo-cmp', label, state: 'running' })
    try {
      const { rows } = await api.compare(intent.symbols.slice(0, 4))
      emit('tool', { id: 'demo-cmp', label, state: 'done' })
      emit('card', { id: 'demo-cmp', card: { type: 'compare', rows } })
      const best = [...rows].sort((a, b) => b.y1 - a.y1)[0]
      await streamText(emit, `Over the past year, **${best.name}** led this group with a ${fmt(best.y1)}% return. Higher returns came with higher volatility — compare the "Vol" column before reading too much into the winner.`, signal)
    } catch {
      await streamText(emit, 'Comparison data is unavailable right now.', signal)
    }
    return emit('done', {})
  }

  if (intent.kind === 'simulate') {
    const label = `Simulating $${intent.amount} in ${intent.symbol}`
    emit('tool', { id: 'demo-sim', label, state: 'running' })
    try {
      const sim = await api.simulate({ symbol: intent.symbol, amount: intent.amount, years: 5 })
      emit('tool', { id: 'demo-sim', label, state: 'done' })
      emit('card', { id: 'demo-sim', card: { type: 'simulation', data: sim } })
      await streamText(emit, `$${fmt(sim.amount, 0)} invested five years ago would be worth about **$${fmt(sim.finalValue, 0)}** today (${fmt(sim.cagrPct, 1)}% a year), after a worst drawdown of ${fmt(sim.maxDrawdownPct, 1)}%. The forward range is illustrative, based on historical volatility.`, signal)
    } catch {
      await streamText(emit, 'Simulation data is unavailable right now.', signal)
    }
    return emit('done', {})
  }

  if (intent.kind === 'sentiment') {
    const label = 'Reading the tape across indexes and sectors'
    emit('tool', { id: 'demo-mkt', label, state: 'running' })
    const m = await getMarket()
    emit('tool', { id: 'demo-mkt', label, state: 'done' })
    const items = m.indexes.filter((i) => i.symbol !== '^VIX').slice(0, 3)
    emit('card', { id: 'demo-mkt', card: { type: 'market', items, sectors: m.sectors } })
    const avg = items.reduce((s, i) => s + i.changePct, 0) / items.length
    const sorted = [...m.sectors].sort((a, b) => (b.dayPct ?? b.pct) - (a.dayPct ?? a.pct))
    await streamText(
      emit,
      `Sentiment reads **${avg > 0.4 ? 'risk-on' : avg < -0.4 ? 'risk-off' : 'balanced'}**: the major indexes average ${fmt(avg)}% today.` +
        (sorted.length ? ` ${sorted[0].name} leads the sectors while ${sorted[sorted.length - 1].name} lags.` : '') +
        '\n\nLeadership from cyclical and growth sectors usually signals appetite for risk; defensives leading (staples, utilities, healthcare) signals caution.',
      signal,
    )
    return emit('done', {})
  }

  if (intent.kind === 'diversify') {
    const m = await getMarket()
    emit('card', { id: 'demo-sec', card: { type: 'market', items: [], sectors: m.sectors } })
    await streamText(
      emit,
      'A common framework:\n\n- Cap any single stock at **5–10%** and any sector at about **25%** of equities.\n- Pair growth sectors with lower-correlation ones (healthcare, staples, short-duration bonds).\n- Rebalance quarterly, or when a sector drifts more than 5 points from target.\n\nThis is general education, not personal advice — your mix should reflect your horizon and risk tolerance.',
      signal,
    )
    return emit('done', { chips: ['Analyze today’s market sentiment', 'Compare SPY with QQQ'] })
  }

  if (intent.kind === 'pickCompany') {
    await streamText(emit, 'Which company should I break down? Pick one below or type a name or ticker.', signal)
    return emit('done', { chips: ["Break down Nvidia's financial health", "Break down Apple's financial health", "Break down Microsoft's financial health"] })
  }

  await streamText(
    emit,
    "I'm running in **demo mode**, so I can only answer structured questions: a company or ticker (\"How did Nvidia do this week?\"), comparisons, simulations, market mood or diversification. Add an Anthropic API key on the server for full AI answers.",
    signal,
  )
  emit('done', { chips: ['Could you please help me share analysis for Nvidia this week?', "Analyze today's market sentiment", 'Compare NVDA vs AMD'] })
}
