const cache = new Map()

async function request(path, { ttl = 0, ...init } = {}) {
  const key = init.method && init.method !== 'GET' ? null : path
  const hit = key && cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.data
  const res = await fetch(path, {
    ...init,
    headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    signal: init.signal || AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && data.auth) window.dispatchEvent(new Event('nerve:unauthorized'))
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, data })
  if (key && ttl) cache.set(key, { at: Date.now(), data })
  return data
}

export const api = {
  tape: () => request('/api/public/tape', { ttl: 30e3 }),
  health: () => request('/api/health'),
  stock: (symbol) => request(`/api/stock/${encodeURIComponent(symbol)}`, { ttl: 30e3 }),
  series: (symbol, tf) => request(`/api/series/${encodeURIComponent(symbol)}?tf=${tf}`, { ttl: 30e3 }),
  fundamentals: (symbol) => request(`/api/fundamentals/${encodeURIComponent(symbol)}`, { ttl: 600e3 }),
  quotes: (symbols) =>
    symbols.length ? request(`/api/quotes?symbols=${symbols.map(encodeURIComponent).join(',')}`, { ttl: 20e3 }) : Promise.resolve({}),
  market: () => request('/api/market', { ttl: 60e3 }),
  compare: (symbols, benchmark = true) =>
    request(`/api/compare?symbols=${symbols.map(encodeURIComponent).join(',')}&benchmark=${benchmark ? 1 : 0}`, { ttl: 300e3 }),
  search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`, { ttl: 300e3 }),
  screener: () => request('/api/screener', { ttl: 60e3, signal: AbortSignal.timeout(45000) }),
  simulate: (body) => request('/api/simulate', { method: 'POST', body: JSON.stringify(body) }),
}

// Rejects with `.demo = true` when the server has no AI key, so the caller can fall back to demo mode.
export async function streamChat(body, onEvent, signal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 401 && data.auth) window.dispatchEvent(new Event('nerve:unauthorized'))
    throw Object.assign(new Error(data.error || `Chat failed (${res.status})`), { status: res.status, demo: data.demo })
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let sep
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      let type = 'message'
      let data = ''
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: ')) type = line.slice(7)
        else if (line.startsWith('data: ')) data += line.slice(6)
      }
      if (data) onEvent(type, JSON.parse(data))
    }
  }
}
