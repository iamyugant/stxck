import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSession, runAgent, setClientForTesting } from '../server/agent.js'

// Minimal stand-in for the SDK's MessageStream: async-iterable events + finalMessage().
function fakeStream(events, message) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e
    },
    finalMessage: async () => message,
  }
}

function fakeClient(turns) {
  const calls = []
  return {
    calls,
    beta: {
      messages: {
        stream(params) {
          calls.push(structuredClone(params))
          const t = turns.shift()
          if (!t) throw new Error('unexpected extra turn')
          return fakeStream(t.events, t.message)
        },
      },
    },
  }
}

const usage = { input_tokens: 10, output_tokens: 5 }

test('agent runs a tool turn, returns tool_result, then streams text and saves the session', async () => {
  const client = fakeClient([
    {
      events: [{ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tu_1', name: 'get_stock_snapshot', input: {} } }],
      message: {
        stop_reason: 'tool_use',
        usage,
        content: [{ type: 'tool_use', id: 'tu_1', name: 'get_stock_snapshot', input: { symbol: 'not a ticker!' } }],
      },
    },
    {
      events: [
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'That ticker ' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'is invalid.' } },
      ],
      message: { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'That ticker is invalid.' }] },
    },
  ])
  setClientForTesting(client)

  const events = []
  await runAgent({
    conversationId: 'test_conv_1',
    userContent: [{ type: 'text', text: 'How is not a ticker! doing?' }],
    context: { watchlist: ['NVDA'] },
    settings: { model: 'Stxck 2o', web: false, deep: false },
    emit: (type, data) => events.push([type, data]),
  })

  const types = events.map((e) => e[0])
  assert.ok(types.includes('tool'))
  assert.equal(events.filter((e) => e[0] === 'text').map((e) => e[1].text).join(''), 'That ticker is invalid.')
  assert.equal(types[types.length - 1], 'done')

  // Second request carries the tool_result (an is_error, since validation failed) in one user message.
  const second = client.calls[1].messages
  const toolResultMsg = second[second.length - 1]
  assert.equal(toolResultMsg.role, 'user')
  assert.equal(toolResultMsg.content[0].type, 'tool_result')
  assert.equal(toolResultMsg.content[0].tool_use_id, 'tu_1')
  assert.equal(toolResultMsg.content[0].is_error, true)

  // Request shape: adaptive thinking, effort, fallbacks, cached system prefix, eager tool streaming.
  const p = client.calls[0]
  assert.equal(p.thinking.type, 'adaptive')
  assert.equal(p.output_config.effort, 'medium')
  assert.equal(p.fallbacks, 'default')
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01'])
  assert.equal(p.system[0].cache_control.type, 'ephemeral')
  assert.match(p.system[1].text, /NVDA/)
  assert.ok(p.tools.every((t) => t.eager_input_streaming === true))
  assert.ok(!p.tools.some((t) => t.type === 'web_search_20260209'))

  const saved = getSession('test_conv_1')
  assert.equal(saved.messages.at(-1).role, 'assistant')
  assert.equal(saved.messages.length, 4)
})

test('follow-up turn reuses the stored session history; deep research enables web search at high effort', async () => {
  const client = fakeClient([{ events: [], message: { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'ok' }] } }])
  setClientForTesting(client)
  await runAgent({
    conversationId: 'test_conv_1',
    userContent: [{ type: 'text', text: 'And now?' }],
    settings: { model: 'Stxck 2o', web: false, deep: true },
    emit: () => {},
  })
  const p = client.calls[0]
  assert.equal(p.messages.length, 5)
  assert.equal(p.output_config.effort, 'high')
  assert.ok(p.tools.some((t) => t.type === 'web_search_20260209' && t.max_uses === 8))
})

test('refusal stops the loop with a friendly message and does not run tools', async () => {
  const client = fakeClient([
    {
      events: [],
      message: { stop_reason: 'refusal', usage, content: [{ type: 'tool_use', id: 'x', name: 'get_news', input: { query: 'x' } }] },
    },
  ])
  setClientForTesting(client)
  const events = []
  await runAgent({
    conversationId: 'test_conv_2',
    userContent: [{ type: 'text', text: 'hi' }],
    settings: { model: 'Stxck 2o' },
    emit: (t, d) => events.push([t, d]),
  })
  assert.equal(client.calls.length, 1)
  assert.ok(events.some(([t, d]) => t === 'text' && /can't help/.test(d.text)))
  assert.ok(!events.some(([t]) => t === 'card'))
})

test('rebuilds history from the client transcript when the server has no session', async () => {
  const client = fakeClient([{ events: [], message: { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'ok' }] } }])
  setClientForTesting(client)
  await runAgent({
    conversationId: 'test_conv_fresh',
    userContent: [{ type: 'text', text: 'follow up' }],
    transcript: [
      { role: 'assistant', text: 'orphan greeting is dropped' },
      { role: 'user', text: 'first question' },
      { role: 'assistant', text: 'first answer' },
    ],
    settings: {},
    emit: () => {},
  })
  const msgs = client.calls[0].messages
  assert.deepEqual(
    msgs.map((m) => m.role),
    ['user', 'assistant', 'user'],
  )
  assert.equal(msgs[0].content, 'first question')
})
