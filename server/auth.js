// Email + password auth: scrypt hashes, HMAC-signed session cookies, reset tokens.
// Users persist to DATA_DIR/users.json (atomic writes). No external services required.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { z } from 'zod'
import { sendPasswordReset } from './mailer.js'

const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const COOKIE = 'nerve_session'
const REMEMBER_MS = 30 * 86400e3
const SESSION_MS = 24 * 3600e3
const isProd = process.env.NODE_ENV === 'production'

fs.mkdirSync(DATA_DIR, { recursive: true })

/* ------------------------------------------------------------------ secret */
function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  const file = path.join(DATA_DIR, '.session-secret')
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    const s = crypto.randomBytes(48).toString('base64url')
    fs.writeFileSync(file, s, { mode: 0o600 })
    return s
  }
}
const SECRET = loadSecret()

/* ------------------------------------------------------------------- store */
const users = new Map()
try {
  for (const u of JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))) users.set(u.id, u)
} catch {
  /* first run */
}
let writing = Promise.resolve()
function persist() {
  const snapshot = JSON.stringify([...users.values()], null, 1)
  writing = writing.then(async () => {
    const tmp = `${USERS_FILE}.${process.pid}.tmp`
    await fs.promises.writeFile(tmp, snapshot, { mode: 0o600 })
    await fs.promises.rename(tmp, USERS_FILE)
  })
  return writing
}
const byEmail = (email) => [...users.values()].find((u) => u.email === email)

/* ---------------------------------------------------------------- hashing */
const scrypt = (pw, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))),
  )

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(pw, salt)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

async function verifyPassword(pw, stored) {
  const [, salt, hash] = String(stored).split('$')
  if (!salt || !hash) return false
  const key = await scrypt(pw, Buffer.from(salt, 'base64'))
  const expected = Buffer.from(hash, 'base64')
  return expected.length === key.length && crypto.timingSafeEqual(expected, key)
}
// Equalize timing for unknown emails.
const DUMMY_HASH = await hashPassword(crypto.randomBytes(12).toString('hex'))

/* ---------------------------------------------------------------- sessions */
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url')

function issueSession(res, user, remember) {
  const exp = Date.now() + (remember ? REMEMBER_MS : SESSION_MS)
  const payload = Buffer.from(JSON.stringify({ uid: user.id, v: user.sessionVersion, exp })).toString('base64url')
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    ...(remember ? { maxAge: REMEMBER_MS } : {}),
  })
}

function readSession(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE]
  if (!raw) return null
  const [payload, sig] = raw.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const { uid, v, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    const user = users.get(uid)
    if (!user || exp < Date.now() || v !== user.sessionVersion) return null
    return user
  } catch {
    return null
  }
}

function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  createdAt: u.createdAt,
  onboarded: Boolean(u.onboarded),
  interests: u.interests || [],
})

/* -------------------------------------------------------------- middleware */
export function attachUser(req, res, next) {
  req.user = readSession(req)
  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.', auth: true })
  next()
}

/** Reject cross-site state-changing requests (defense in depth on top of SameSite=Lax). */
export function sameOrigin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next()
  const origin = req.headers.origin
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-site request blocked' })
    } catch {
      return res.status(403).json({ error: 'Bad origin' })
    }
  }
  if (!String(req.headers['content-type'] || '').includes('application/json') && req.headers['content-length'] !== '0') {
    return res.status(415).json({ error: 'JSON required' })
  }
  next()
}

/* --------------------------------------------------------------- throttling */
const attempts = new Map()
function throttled(key, limit = 8, windowMs = 15 * 60e3) {
  const now = Date.now()
  const arr = (attempts.get(key) || []).filter((t) => now - t < windowMs)
  attempts.set(key, arr)
  return arr.length >= limit
}
const fail = (key) => attempts.set(key, [...(attempts.get(key) || []), Date.now()])
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of attempts) if (!v.some((t) => now - t < 3600e3)) attempts.delete(k)
}, 600e3).unref()

/* ------------------------------------------------------------------ schemas */
const Email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254)
const Password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'That password is too long')
  .refine((p) => /[a-zA-Z]/.test(p) && /\d|[^a-zA-Z]/.test(p), 'Mix letters with numbers or symbols')
const Name = z.string().trim().min(1, 'Tell us your name').max(80)

function parse(schema, body, res) {
  const r = schema.safeParse(body ?? {})
  if (r.success) return r.data
  const fields = {}
  for (const issue of r.error.issues) fields[issue.path[0]] ??= issue.message
  res.status(400).json({ error: Object.values(fields)[0] || 'Invalid input', fields })
  return null
}

/* ------------------------------------------------------------------- routes */
export const authRouter = express.Router()

authRouter.get('/me', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ user: req.user ? publicUser(req.user) : null })
})

authRouter.post('/signup', async (req, res) => {
  const data = parse(z.object({ name: Name, email: Email, password: Password, remember: z.boolean().optional() }), req.body, res)
  if (!data) return
  if (throttled(`signup:${req.ip}`, 10, 3600e3)) return res.status(429).json({ error: 'Too many sign-ups from this network. Try again later.' })
  if (byEmail(data.email)) {
    return res.status(409).json({ error: 'An account with this email already exists.', fields: { email: 'Already registered — log in instead?' } })
  }
  fail(`signup:${req.ip}`)
  const user = {
    id: crypto.randomUUID(),
    name: data.name,
    email: data.email,
    password: await hashPassword(data.password),
    createdAt: Date.now(),
    sessionVersion: 1,
    onboarded: false,
  }
  users.set(user.id, user)
  await persist()
  issueSession(res, user, data.remember ?? true)
  res.status(201).json({ user: publicUser(user) })
})

authRouter.post('/login', async (req, res) => {
  const data = parse(z.object({ email: Email, password: z.string().min(1, 'Enter your password').max(200), remember: z.boolean().optional() }), req.body, res)
  if (!data) return
  const key = `login:${req.ip}:${data.email}`
  if (throttled(key)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes or reset your password.' })
  const user = byEmail(data.email)
  const ok = await verifyPassword(data.password, user?.password || DUMMY_HASH)
  if (!user || !ok) {
    fail(key)
    return res.status(401).json({ error: 'That email and password don’t match.' })
  }
  attempts.delete(key)
  issueSession(res, user, data.remember ?? true)
  res.json({ user: publicUser(user) })
})

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})

authRouter.post('/forgot', async (req, res) => {
  const data = parse(z.object({ email: Email }), req.body, res)
  if (!data) return
  if (throttled(`forgot:${req.ip}`, 5, 3600e3)) return res.status(429).json({ error: 'Too many requests. Try again later.' })
  fail(`forgot:${req.ip}`)
  const user = byEmail(data.email)
  let devLink
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url')
    user.reset = { hash: crypto.createHash('sha256').update(token).digest('hex'), exp: Date.now() + 3600e3 }
    await persist()
    const link = `${req.protocol}://${req.get('host')}/reset?token=${token}`
    await sendPasswordReset(user, link)
    if (!isProd) devLink = link
  }
  // Same response whether or not the account exists.
  res.json({ ok: true, ...(devLink ? { devLink } : {}) })
})

authRouter.post('/reset', async (req, res) => {
  const data = parse(z.object({ token: z.string().min(20).max(200), password: Password }), req.body, res)
  if (!data) return
  const hash = crypto.createHash('sha256').update(data.token).digest('hex')
  const user = [...users.values()].find((u) => u.reset?.hash === hash && u.reset.exp > Date.now())
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' })
  user.password = await hashPassword(data.password)
  user.sessionVersion += 1 // signs out every other device
  delete user.reset
  await persist()
  issueSession(res, user, true)
  res.json({ user: publicUser(user) })
})

authRouter.patch('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' })
  const data = parse(
    z.object({ name: Name.optional(), onboarded: z.boolean().optional(), interests: z.array(z.string().max(40)).max(20).optional() }),
    req.body,
    res,
  )
  if (!data) return
  Object.assign(req.user, data)
  await persist()
  res.json({ user: publicUser(req.user) })
})

authRouter.post('/password', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' })
  const data = parse(z.object({ current: z.string().min(1, 'Enter your current password'), next: Password }), req.body, res)
  if (!data) return
  if (!(await verifyPassword(data.current, req.user.password))) {
    return res.status(400).json({ error: 'Current password is incorrect.', fields: { current: 'Incorrect password' } })
  }
  req.user.password = await hashPassword(data.next)
  req.user.sessionVersion += 1
  await persist()
  issueSession(res, req.user, true)
  res.json({ ok: true })
})

authRouter.delete('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' })
  const data = parse(z.object({ password: z.string().min(1, 'Enter your password') }), req.body, res)
  if (!data) return
  if (!(await verifyPassword(data.password, req.user.password))) {
    return res.status(400).json({ error: 'Password is incorrect.', fields: { password: 'Incorrect password' } })
  }
  users.delete(req.user.id)
  await persist()
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})
