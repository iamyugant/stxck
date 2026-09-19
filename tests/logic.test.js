import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyTrade, freshPortfolio } from '../src/lib/trading.js'
import { parseIntent } from '../src/lib/analyst.js'
import { returnsFrom, seriesStats } from '../server/yahoo.js'
import { runTool, shortName, TOOLS } from '../server/tools.js'

test('paper trading: buy averages cost, sell realizes P&L, guards overdraft and oversell', () => {
  let p = freshPortfolio()
  let r = applyTrade(p, { symbol: 'NVDA', side: 'buy', quantity: 10, price: 100 }, 1)
  assert.ok(r.ok)
  p = r.portfolio
  r = applyTrade(p, { symbol: 'NVDA', side: 'buy', quantity: 10, price: 200 }, 2)
  p = r.portfolio
  assert.equal(p.positions.NVDA.quantity, 20)
  assert.equal(p.positions.NVDA.avgCost, 150)
  assert.equal(p.cash, 100000 - 3000)

  r = applyTrade(p, { symbol: 'NVDA', side: 'sell', quantity: 5, price: 170 }, 3)
  assert.ok(r.ok)
  assert.equal(r.portfolio.trades[0].realized, 100)
  assert.equal(r.portfolio.positions.NVDA.quantity, 15)

  assert.equal(applyTrade(p, { symbol: 'NVDA', side: 'sell', quantity: 50, price: 170 }).ok, false)
  assert.equal(applyTrade(p, { symbol: 'AAPL', side: 'buy', quantity: 1e6, price: 200 }).ok, false)
  assert.equal(applyTrade(p, { symbol: 'AAPL', side: 'buy', quantity: -1, price: 200 }).ok, false)

  r = applyTrade(p, { symbol: 'NVDA', side: 'sell', quantity: 20, price: 150 }, 4)
  assert.equal(r.portfolio.positions.NVDA, undefined)
  assert.equal(r.portfolio.cash, 100000)
})

test('demo intent parsing', () => {
  assert.deepEqual(parseIntent('Could you please help me share analysis for Nvidia this week?'), { kind: 'analysis', symbol: 'NVDA', period: 'week' })
  assert.equal(parseIntent("Break down Apple's financial health").kind, 'health')
  assert.deepEqual(parseIntent('Compare NVDA vs AMD').symbols, ['NVDA', 'AMD'])
  assert.equal(parseIntent("Analyze today's market sentiment").kind, 'sentiment')
  assert.equal(parseIntent('Suggest a better diversification strategy').kind, 'diversify')
  assert.equal(parseIntent('hello there').kind, 'unknown')
  assert.equal(parseIntent('What if I invested $5,000 in MSFT').amount, 5000)
})

test('series statistics: return, drawdown, volatility', () => {
  const day = 86400e3
  const pts = [100, 110, 90, 120].map((v, i) => ({ t: i * day, v }))
  const s = seriesStats(pts)
  assert.equal(s.returnPct, 20)
  assert.equal(s.high, 120)
  assert.equal(s.low, 90)
  assert.ok(Math.abs(s.maxDrawdownPct - ((90 - 110) / 110) * 100) < 1e-9)
  assert.ok(s.annualizedVolatilityPct > 0)
})

test('returnsFrom uses the last close before Jan 1 for YTD', () => {
  const pts = [
    { t: Date.UTC(2021, 5, 1), v: 50 },
    { t: Date.UTC(2025, 8, 1), v: 80 },
    { t: Date.UTC(2025, 11, 31), v: 100 },
    { t: Date.UTC(2026, 5, 1), v: 120 },
  ]
  const r = returnsFrom(pts)
  assert.equal(r.ytd, 20)
  assert.equal(r.y5, 140)
})

test('tool definitions are valid and sorted; bad input is rejected without network', async () => {
  const names = TOOLS.map((t) => t.name)
  assert.deepEqual(names, [...names].sort())
  for (const t of TOOLS) {
    assert.equal(t.input_schema.type, 'object')
    assert.ok(t.description.length > 20)
  }
  const bad = await runTool('get_stock_snapshot', { symbol: '<script>' })
  assert.equal(bad.isError, true)
  const unknown = await runTool('drop_tables', {})
  assert.equal(unknown.isError, true)
  const missing = await runTool('compare_performance', { symbols: [] })
  assert.equal(missing.isError, true)
})

test('shortName strips corporate suffixes', () => {
  assert.equal(shortName('NVIDIA Corporation'), 'Nvidia')
  assert.equal(shortName('Apple Inc.'), 'Apple')
  assert.equal(shortName('Microsoft Corporation'), 'Microsoft')
})

import { marketStatus } from '../src/lib/marketHours.js'
import { chatToMarkdown } from '../src/lib/exportChat.js'

test('market hours: sessions, weekends and holidays in New York time', () => {
  // 2026-09-18 is a Friday; EDT is UTC-4.
  const at = (iso) => marketStatus(new Date(iso))
  assert.equal(at('2026-09-18T14:00:00Z').state, 'open') // 10:00 ET
  assert.equal(at('2026-09-18T14:00:00Z').detail, 'Closes in 6h 0m')
  assert.equal(at('2026-09-18T12:00:00Z').state, 'pre') // 08:00 ET
  assert.equal(at('2026-09-18T21:30:00Z').state, 'after') // 17:30 ET
  assert.equal(at('2026-09-19T02:00:00Z').state, 'closed') // 22:00 ET Friday
  const sat = at('2026-09-19T15:00:00Z')
  assert.equal(sat.state, 'closed')
  assert.match(sat.detail, /Mon 9:30 AM/)
  const labor = at('2026-09-07T15:00:00Z') // Labor Day
  assert.equal(labor.label, 'Market holiday')
  assert.match(labor.detail, /tomorrow 9:30 AM/)
})

test('chat export renders messages, cards and sources as Markdown', () => {
  const md = chatToMarkdown({
    title: 'NVDA week',
    messages: [
      { role: 'user', text: 'How did Nvidia do?' },
      {
        role: 'assistant',
        parts: [
          { type: 'card', card: { type: 'stock', quote: { symbol: 'NVDA', price: 222.27, changePct: 1.34, low52: 164.27, high52: 236.54 } } },
          { type: 'text', text: 'Up on the week.' },
        ],
        sources: [{ title: 'Yahoo Finance', url: 'https://finance.yahoo.com/quote/NVDA' }],
      },
    ],
  })
  assert.match(md, /^# NVDA week/)
  assert.match(md, /\*\*You:\*\* How did Nvidia do\?/)
  assert.match(md, /\*\*NVDA\*\* \$222\.27 \(\+1\.34% today\)/)
  assert.match(md, /- \[Yahoo Finance\]\(https:\/\/finance\.yahoo\.com\/quote\/NVDA\)/)
})
