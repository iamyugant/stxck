import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, streamChat } from './api.js'
import { runDemo } from './analyst.js'
import { uid, usePersistentState } from './storage.js'

const EMPTY = []
const MAX_FILE = 10 * 1024 * 1024
const TEXT_EXT = /\.(txt|csv|tsv|json|md|xml|html?)$/i
const MEDIA = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'])

function readAs(file, mode) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    if (mode === 'text') r.readAsText(file)
    else r.readAsDataURL(file)
  })
}

async function encodeFiles(files) {
  const out = []
  const notes = []
  for (const f of files) {
    if (f.size > MAX_FILE) {
      notes.push(`${f.name} (over 10 MB, skipped)`)
    } else if (MEDIA.has(f.type)) {
      const url = await readAs(f, 'data')
      out.push({ name: f.name, kind: 'media', mediaType: f.type, data: String(url).split(',')[1] })
    } else if (f.type.startsWith('text/') || TEXT_EXT.test(f.name)) {
      out.push({ name: f.name, kind: 'text', data: await readAs(f, 'text') })
    } else {
      notes.push(`${f.name} (${f.type || 'unknown type'} can't be read by the analyst)`)
    }
  }
  return { payload: out, notes }
}

export const textOf = (msg) =>
  msg.role === 'user' ? msg.text : (msg.parts || []).filter((p) => p.type === 'text').map((p) => p.text).join('')

export function useChat({ getContext, onAction, settings }) {
  const [chats, setChats] = usePersistentState('chats', [], 600)
  const [activeId, setActiveId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [ai, setAi] = useState(null) // null = unknown, then { enabled, model }
  const abortRef = useRef(null)
  const bufRef = useRef({ chatId: null, msgId: null, text: '', raf: 0 })

  // Replies interrupted by a reload can't resume; mark them stopped once on mount.
  useEffect(() => {
    setChats((all) =>
      all.some((c) => c.messages.some((m) => m.status === 'streaming'))
        ? all.map((c) => ({ ...c, messages: c.messages.map((m) => (m.status === 'streaming' ? { ...m, status: 'stopped' } : m)) }))
        : all,
    )
  }, [setChats])

  // Re-check when the tab regains focus, so adding a server key switches off demo mode without a reload.
  useEffect(() => {
    const check = () =>
      api
        .health()
        .then((h) => setAi((prev) => (prev?.enabled === h.ai && prev?.model === h.model ? prev : { enabled: h.ai, model: h.model })))
        .catch(() => setAi((prev) => prev || { enabled: false, model: null }))
    check()
    const onFocus = () => document.visibilityState === 'visible' && check()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const id = setInterval(check, 30e3)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      clearInterval(id)
    }
  }, [])

  const active = useMemo(() => chats.find((c) => c.id === activeId) || null, [chats, activeId])
  const messages = useMemo(() => active?.messages || EMPTY, [active])

  const patchMsg = useCallback(
    (chatId, msgId, fn) => {
      setChats((all) =>
        all.map((c) =>
          c.id !== chatId ? c : { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)) },
        ),
      )
    },
    [setChats],
  )

  // Text deltas arrive per token; coalesce them to one state update per frame.
  const flushText = useCallback(() => {
    const b = bufRef.current
    b.raf = 0
    if (!b.text) return
    const text = b.text
    b.text = ''
    patchMsg(b.chatId, b.msgId, (m) => {
      const parts = [...m.parts]
      const last = parts[parts.length - 1]
      if (last?.type === 'text') parts[parts.length - 1] = { ...last, text: last.text + text }
      else parts.push({ type: 'text', text })
      return { ...m, parts }
    })
  }, [patchMsg])

  const run = useCallback(
    async (chatId, msgId, text, files, transcript) => {
      const controller = new AbortController()
      abortRef.current = controller
      setBusy(true)
      bufRef.current = { chatId, msgId, text: '', raf: 0 }

      const onEvent = (type, data) => {
        if (type === 'text') {
          bufRef.current.text += data.text
          if (!bufRef.current.raf) bufRef.current.raf = requestAnimationFrame(flushText)
          return
        }
        flushText()
        switch (type) {
          case 'status':
            patchMsg(chatId, msgId, (m) => ({ ...m, statusText: data.text }))
            break
          case 'thinking':
            patchMsg(chatId, msgId, (m) => ({ ...m, thinking: ((m.thinking || '') + data.text).slice(-600) }))
            break
          case 'tool':
            patchMsg(chatId, msgId, (m) => {
              const tools = m.tools.filter((t) => t.id !== data.id)
              const prev = m.tools.find((t) => t.id === data.id)
              return {
                ...m,
                statusText: data.label,
                tools: [...tools, { ...prev, ...data, label: data.state === 'start' && prev ? prev.label : data.label }],
              }
            })
            break
          case 'card':
            patchMsg(chatId, msgId, (m) => ({ ...m, parts: [...m.parts, { type: 'card', id: data.id, card: data.card }] }))
            break
          case 'sources':
            patchMsg(chatId, msgId, (m) => {
              const seen = new Set(m.sources.map((s) => s.url))
              const add = data.items.filter((s) => s.url && !seen.has(s.url) && seen.add(s.url))
              return { ...m, sources: [...m.sources, ...add].slice(0, 20) }
            })
            break
          case 'action':
            onAction?.(data)
            break
          case 'error':
            patchMsg(chatId, msgId, (m) => ({ ...m, status: 'error', error: data.message }))
            break
          case 'done':
            patchMsg(chatId, msgId, (m) => ({ ...m, status: m.status === 'error' ? 'error' : 'done', chips: data.chips || [], usage: data.usage }))
            break
        }
      }

      try {
        const useAi = ai?.enabled !== false
        if (useAi) {
          try {
            const { payload, notes } = await encodeFiles(files)
            const body = {
              conversationId: chatId,
              text: notes.length ? `${text}\n\n(Attachments not readable: ${notes.join('; ')})` : text,
              files: payload,
              transcript,
              context: getContext?.(),
              settings,
            }
            await streamChat(body, onEvent, controller.signal)
          } catch (err) {
            if (!err.demo) throw err
            setAi({ enabled: false, model: null })
            await runDemo(text, onEvent, controller.signal)
          }
        } else {
          await runDemo(text, onEvent, controller.signal)
        }
        flushText()
        patchMsg(chatId, msgId, (m) => (m.status === 'streaming' ? { ...m, status: 'done' } : m))
      } catch (err) {
        flushText()
        if (controller.signal.aborted) {
          patchMsg(chatId, msgId, (m) => ({ ...m, status: 'stopped' }))
        } else {
          patchMsg(chatId, msgId, (m) => ({
            ...m,
            status: 'error',
            error: err.status === 429 ? 'You’re sending messages quickly. Wait a moment and try again.' : 'Connection lost while generating. Try again.',
          }))
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setBusy(false)
      }
    },
    [ai, flushText, getContext, onAction, patchMsg, settings],
  )

  const send = useCallback(
    (text, files = []) => {
      if (busy || !text.trim()) return
      let chatId = activeId
      const transcript = messages.map((m) => ({ role: m.role, text: textOf(m) }))
      const user = { id: uid('m'), role: 'user', text, files: files.map((f) => f.name) }
      const asst = { id: uid('m'), role: 'assistant', status: 'streaming', parts: [], tools: [], sources: [], statusText: 'Thinking', createdAt: Date.now() }
      if (!chatId) {
        chatId = uid('chat')
        const chat = { id: chatId, title: text.slice(0, 72), createdAt: Date.now(), updatedAt: Date.now(), messages: [user, asst] }
        setChats((all) => [chat, ...all].slice(0, 100))
        setActiveId(chatId)
      } else {
        setChats((all) => all.map((c) => (c.id === chatId ? { ...c, updatedAt: Date.now(), messages: [...c.messages, user, asst] } : c)))
      }
      run(chatId, asst.id, text, files, transcript)
    },
    [activeId, busy, messages, run, setChats],
  )

  const retry = useCallback(() => {
    if (busy || !active) return
    const msgs = active.messages
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    // Drop the failed turn and resend it as a fresh turn.
    const idx = msgs.lastIndexOf(lastUser)
    setChats((all) => all.map((c) => (c.id === active.id ? { ...c, messages: msgs.slice(0, idx) } : c)))
    setTimeout(() => send(lastUser.text), 0)
  }, [active, busy, send, setChats])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const newChat = useCallback(() => {
    abortRef.current?.abort()
    setActiveId(null)
  }, [])

  const openChat = useCallback((id) => {
    abortRef.current?.abort()
    setActiveId(id)
  }, [])

  const deleteChat = useCallback(
    (id) => {
      setChats((all) => all.filter((c) => c.id !== id))
      if (id === activeId) setActiveId(null)
    },
    [activeId, setChats],
  )

  const renameChat = useCallback((id, title) => setChats((all) => all.map((c) => (c.id === id ? { ...c, title } : c))), [setChats])

  return { chats, active, messages, busy, ai, send, stop, retry, newChat, openChat, deleteChat, renameChat, setChats }
}
