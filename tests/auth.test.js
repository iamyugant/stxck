import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Boots the real server (production mode) against a throwaway data dir.
const PORT = 5300 + Math.floor(Math.random() * 500)
const BASE = `http://localhost:${PORT}`
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nerve-auth-'))
let proc
let logs = ''

before(async () => {
  proc = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, NODE_ENV: 'test', ANTHROPIC_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout.on('data', (d) => (logs += d))
  proc.stderr.on('data', (d) => (logs += d))
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`server did not start:\n${logs}`)
})

after(() => {
  proc?.kill()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

function client() {
  let cookie = ''
  return async (p, method = 'GET', body, headers = {}) => {
    const res = await fetch(BASE + p, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0]
    return { status: res.status, data: await res.json().catch(() => ({})), setCookie: set }
  }
}

test('protected routes reject anonymous users', async () => {
  const c = client()
  assert.equal((await c('/api/quotes?symbols=NVDA')).status, 401)
  assert.equal((await c('/api/chat', 'POST', { text: 'hi' })).status, 401)
  assert.deepEqual((await c('/api/auth/me')).data, { user: null })
})

test('signup → session → logout → login → wrong password', async () => {
  const c = client()
  const weak = await c('/api/auth/signup', 'POST', { name: 'Ada', email: 'ada@example.com', password: 'short' })
  assert.equal(weak.status, 400)
  assert.ok(weak.data.fields.password)

  const s = await c('/api/auth/signup', 'POST', { name: 'Ada Lovelace', email: 'ADA@example.com', password: 'engines 1843' })
  assert.equal(s.status, 201)
  assert.equal(s.data.user.email, 'ada@example.com')
  assert.match(s.setCookie, /HttpOnly/i)
  assert.match(s.setCookie, /SameSite=Lax/i)
  assert.equal((await c('/api/auth/me')).data.user.name, 'Ada Lovelace')

  const dup = await c('/api/auth/signup', 'POST', { name: 'X', email: 'ada@example.com', password: 'engines 1843' })
  assert.equal(dup.status, 409)

  const p = await c('/api/auth/me', 'PATCH', { onboarded: true, interests: ['learning'] })
  assert.equal(p.data.user.onboarded, true)

  await c('/api/auth/logout', 'POST', {})
  assert.equal((await c('/api/auth/me')).data.user, null)

  const bad = await c('/api/auth/login', 'POST', { email: 'ada@example.com', password: 'nope nope 1' })
  assert.equal(bad.status, 401)
  const ghost = await c('/api/auth/login', 'POST', { email: 'ghost@example.com', password: 'nope nope 1' })
  assert.equal(ghost.data.error, bad.data.error, 'unknown email and wrong password look identical')

  const ok = await c('/api/auth/login', 'POST', { email: 'ada@example.com', password: 'engines 1843' })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.user.onboarded, true)

  // Passwords are hashed at rest.
  const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'))
  assert.ok(stored[0].password.startsWith('scrypt$'))
  assert.ok(!JSON.stringify(stored).includes('engines 1843'))
})

test('cross-site POSTs are refused', async () => {
  const c = client()
  const r = await c('/api/auth/login', 'POST', { email: 'ada@example.com', password: 'x' }, { origin: 'https://evil.example' })
  assert.equal(r.status, 403)
})

test('password reset: generic response, single-use token, old sessions revoked', async () => {
  const old = client()
  await old('/api/auth/login', 'POST', { email: 'ada@example.com', password: 'engines 1843' })

  const anon = client()
  const unknown = await anon('/api/auth/forgot', 'POST', { email: 'nobody@example.com' })
  assert.deepEqual(unknown.data, { ok: true })
  const f = await anon('/api/auth/forgot', 'POST', { email: 'ada@example.com' })
  const token = new URL(f.data.devLink).searchParams.get('token')
  assert.ok(token.length > 20)

  const r = await anon('/api/auth/reset', 'POST', { token, password: 'difference 2' })
  assert.equal(r.status, 200)
  assert.equal((await anon('/api/auth/reset', 'POST', { token, password: 'another 33' })).status, 400)
  assert.equal((await old('/api/auth/me')).data.user, null, 'old session revoked')
  assert.equal((await anon('/api/auth/me')).data.user.email, 'ada@example.com')
})

test('delete account requires the password', async () => {
  const c = client()
  await c('/api/auth/login', 'POST', { email: 'ada@example.com', password: 'difference 2' })
  assert.equal((await c('/api/auth/me', 'DELETE', { password: 'wrong' })).status, 400)
  assert.equal((await c('/api/auth/me', 'DELETE', { password: 'difference 2' })).status, 200)
  assert.equal((await c('/api/auth/login', 'POST', { email: 'ada@example.com', password: 'difference 2' })).status, 401)
})
