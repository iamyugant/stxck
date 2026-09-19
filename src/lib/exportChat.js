import { fmt } from './format.js'

// Cards are summarised in words so an exported chat still makes sense on its own.
function cardSummary(card) {
  switch (card.type) {
    case 'stock': {
      const q = card.quote
      return `> **${q.symbol}** $${fmt(q.price)} (${q.changePct >= 0 ? '+' : ''}${fmt(q.changePct)}% today) · 52W ${fmt(q.low52)}–${fmt(q.high52)}`
    }
    case 'compare':
      return ['| Ticker | YTD | 1Y | 5Y |', '| --- | --- | --- | --- |', ...card.rows.map((r) => `| ${r.symbol} | ${fmt(r.ytd)}% | ${fmt(r.y1)}% | ${fmt(r.y5)}% |`)].join('\n')
    case 'simulation':
      return `> $${fmt(card.data.amount, 0)} in ${card.data.symbol} since ${card.data.startDate} → $${fmt(card.data.finalValue, 0)} (${fmt(card.data.cagrPct, 1)}%/yr)`
    case 'fundamentals':
      return `> ${card.data.name}: market cap $${fmt((card.data.marketCap || 0) / 1e9, 1)}B, P/E ${fmt(card.data.trailingPE, 1)}`
    default:
      return ''
  }
}

export function chatToMarkdown(chat) {
  const lines = [`# ${chat.title}`, '', `_Exported from Stxck on ${new Date().toLocaleString()}. Research and education only — not investment advice._`, '']
  for (const m of chat.messages) {
    if (m.role === 'user') {
      lines.push(`**You:** ${m.text}`, '')
    } else {
      lines.push('**Stxck:**', '')
      for (const p of m.parts || []) lines.push(p.type === 'text' ? p.text : cardSummary(p.card), '')
      if (m.sources?.length) lines.push('Sources:', ...m.sources.map((s) => `- [${s.title || s.url}](${s.url})`), '')
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

export function downloadChat(chat) {
  const blob = new Blob([chatToMarkdown(chat)], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const slug = chat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'chat'
  Object.assign(document.createElement('a'), { href: url, download: `stxck-${slug}.md` }).click()
  URL.revokeObjectURL(url)
}

