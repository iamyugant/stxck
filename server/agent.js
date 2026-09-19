import Anthropic from '@anthropic-ai/sdk'
import { runTool, toolLabel, TOOLS } from './tools.js'

export const MODEL = process.env.STXCK_MODEL || process.env.NERVE_MODEL || 'claude-opus-5'
const MAX_TURNS = 10

let client = null
export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
}
function getClient() {
  if (!client) client = new Anthropic()
  return client
}
// Called when .env changes so the next request picks up a new API key.
export function resetClient() {
  client = null
}
export function setClientForTesting(fake) {
  client = fake
}

// Frozen: anything volatile (date, portfolio) goes in the second system block.
const SYSTEM = `You are Stxck, an AI stock analyst inside a trading-research app. You help people understand stocks, markets and portfolios.

How to work:
- Use tools for every market number. Never state a price, return, ratio or date from memory; if a tool fails, say the data is unavailable.
- When a question is about a specific company, call get_stock_snapshot so the user sees the live price card. Add get_fundamentals for financial-health, valuation or earnings questions, get_price_history for trend/volatility questions, compare_performance for comparisons, get_market_overview for market mood or sectors, get_news for "why is it moving" questions.
- If the ticker is ambiguous, use search_ticker first.
- Run independent tool calls in parallel.
- Only call add_to_watchlist, set_price_alert or propose_paper_trade when the user explicitly asks for that action. Trades are paper trades with simulated money and need the user's confirmation in a ticket.

How to answer:
- The UI already renders cards for tool results (price card with chart and stats, comparison table, fundamentals, market cards, simulations). Don't repeat every number from a card; interpret it.
- Lead with the answer. Use short paragraphs; use **bold** sparingly, bullet lists for 3+ parallel items, and a small markdown table only when it adds something the cards don't show.
- Be balanced: cover what supports and what argues against a view, and name the key risks.
- You provide research and education, not personalized investment advice. Don't tell the user what they personally should buy or sell; you can explain how investors typically evaluate a decision. Keep any disclaimer to one short sentence, and only when a recommendation is implied.
- If the user asks about something outside markets and investing, answer briefly and steer back to what you can help with.`

const EFFORT = { 'Stxck 2o': 'medium', 'Stxck 2o mini': 'low', 'Stxck Reasoning': 'high' }

const sessions = new Map()
const SESSION_TTL = 24 * 3600e3

export function getSession(id) {
  const s = sessions.get(id)
  if (!s || Date.now() - s.at > SESSION_TTL) return null
  return s
}
function saveSession(id, messages) {
  sessions.set(id, { messages, at: Date.now() })
  if (sessions.size > 1000) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].at - b[1].at)[0][0]
    sessions.delete(oldest)
  }
}

// Used when the server has lost the session (restart or TTL): rebuild context from what the client can see.
function historyFromTranscript(transcript = []) {
  const out = []
  for (const t of transcript.slice(-20)) {
    const text = String(t.text || '').slice(0, 8000)
    if (!text) continue
    const role = t.role === 'user' ? 'user' : 'assistant'
    if (out.length === 0 && role !== 'user') continue
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += `\n\n${text}`
    else out.push({ role, content: text })
  }
  if (out.length && out[out.length - 1].role === 'user') out.pop()
  return out
}

function contextBlock(context = {}) {
  const lines = [`Today is ${new Date().toUTCString()}.`]
  if (context.name) lines.push(`The user's name is ${String(context.name).slice(0, 80)}.`)
  if (context.interests?.length) {
    const styles = { 'long-term': 'long-term investing', active: 'active trading', income: 'income and dividends', learning: 'learning the basics (explain terms simply)' }
    lines.push(`User's investing style: ${context.interests.map((i) => styles[i] || i).join(', ')}. Tailor emphasis accordingly.`)
  }
  if (context.watchlist?.length) lines.push(`User watchlist: ${context.watchlist.join(', ')}.`)
  if (context.portfolio) {
    const p = context.portfolio
    const pos = (p.positions || []).map((x) => `${x.symbol} ${x.quantity} sh @ $${x.avgCost}`).join('; ')
    lines.push(`User paper portfolio: cash $${Math.round(p.cash)}; positions: ${pos || 'none'}.`)
  }
  return lines.join('\n')
}

// emit(event, data) events: status, thinking, text, tool, card, sources, action, done, error
export async function runAgent({ conversationId, userContent, transcript, context, settings, emit, signal }) {
  const stored = getSession(conversationId)
  const history = stored ? stored.messages : historyFromTranscript(transcript)
  const messages = [...history, { role: 'user', content: userContent }]
  const effort = settings.deep ? 'high' : EFFORT[settings.model] || 'medium'

  const tools = [...TOOLS]
  if (settings.web || settings.deep) {
    tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: settings.deep ? 8 : 3 })
  }

  const system = [
    { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: contextBlock(context) },
  ]

  let usage = { input: 0, output: 0, cacheRead: 0 }
  let jsonRetries = 0

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    emit('status', { text: turn === 0 ? 'Thinking' : 'Putting it together' })
    const stream = getClient().beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 32000,
        system,
        tools,
        messages,
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: { effort },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal },
    )

    const toolInputs = new Map()
    let message
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const b = event.content_block
          if (b.type === 'tool_use') {
            toolInputs.set(event.index, b.name)
            emit('tool', { id: b.id, name: b.name, label: toolLabel(b.name, {}), state: 'start' })
          } else if (b.type === 'server_tool_use' && b.name === 'web_search') {
            emit('status', { text: 'Searching the web' })
          } else if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
            emit('sources', {
              items: b.content.filter((r) => r.type === 'web_search_result').map((r) => ({ title: r.title, url: r.url })),
            })
          }
        } else if (event.type === 'content_block_delta') {
          const d = event.delta
          if (d.type === 'text_delta') emit('text', { text: d.text })
          else if (d.type === 'thinking_delta') emit('thinking', { text: d.thinking })
          else if (d.type === 'citations_delta' && d.citation?.url) {
            emit('sources', { items: [{ title: d.citation.title, url: d.citation.url }] })
          }
        }
      }
      message = await stream.finalMessage()
      jsonRetries = 0
    } catch (err) {
      if (err instanceof Anthropic.APIError || signal?.aborted || jsonRetries++ >= 2) throw err
      continue // unparseable streamed tool input: re-issue the turn
    }

    usage.input += message.usage.input_tokens || 0
    usage.output += message.usage.output_tokens || 0
    usage.cacheRead += message.usage.cache_read_input_tokens || 0

    if (message.stop_reason === 'refusal') {
      emit('text', { text: "\n\nI can't help with that request. I can analyze stocks, markets, sectors or your paper portfolio instead." })
      break
    }

    messages.push({ role: 'assistant', content: message.content })
    if (message.stop_reason === 'pause_turn') continue

    const toolUses = message.content.filter((b) => b.type === 'tool_use')
    if (!toolUses.length) break
    if (message.stop_reason === 'max_tokens') {
      emit('error', { message: 'The response was cut off. Try a narrower question.' })
      break
    }

    const results = await Promise.all(
      toolUses.map(async (tu) => {
        emit('tool', { id: tu.id, name: tu.name, label: toolLabel(tu.name, tu.input), state: 'running' })
        const out = await runTool(tu.name, tu.input)
        emit('tool', { id: tu.id, name: tu.name, label: toolLabel(tu.name, tu.input), state: out.isError ? 'error' : 'done' })
        if (out.card) emit('card', { id: tu.id, card: out.card })
        if (out.sources?.length) emit('sources', { items: out.sources })
        if (out.action) emit('action', out.action)
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(out.result),
          ...(out.isError ? { is_error: true } : {}),
        }
      }),
    )
    messages.push({ role: 'user', content: results })
  }

  // A turn must end on an assistant message to be a valid prefix for the next one.
  if (messages[messages.length - 1].role === 'assistant') saveSession(conversationId, messages)
  emit('done', { usage })
}
