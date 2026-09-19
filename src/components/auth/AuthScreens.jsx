import { useState } from 'react'
import Icon from '../Icon.jsx'
import { BrandMark, ProductPreview } from '../landing/Brand.jsx'
import { useTape } from '../../lib/tape.js'
import { Notice } from '../ui/States.jsx'
import { PasswordField, SubmitButton, TextField } from './Fields.jsx'
import { useAuth } from '../../lib/auth.jsx'
import { Link, navigate, useQuery } from '../../lib/router.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Same rule the server enforces: letters plus a number or symbol.
const PW_MIX = /^(?=.*[a-zA-Z])(?=.*[^a-zA-Z]).+$/

function AuthLayout({ children }) {
  const tape = useTape()
  return (
    <div className="auth">
      <div className="auth__main">
        <header className="auth__top">
          <BrandMark />
          <Link to="/" className="auth__back">
            <Icon name="chevronLeft" size={15} /> Back to site
          </Link>
        </header>
        <div className="auth__card">{children}</div>
        <p className="auth__legal">Research and education only — not investment advice. Paper trades use virtual money.</p>
      </div>
      <aside className="auth__panel" aria-hidden="true">
        <div className="auth__panel-inner">
          <p className="kicker">Stxck</p>
          <h2 className="auth__panel-title">
            Ask anything.
            <br />
            <span className="dim">Get the whole picture.</span>
          </h2>
          <ProductPreview tape={tape} compact />
          <ul className="auth__points">
            <li>
              <Icon name="chat" size={18} /> An analyst that pulls live prices, fundamentals and news
            </li>
            <li>
              <Icon name="briefcase" size={18} /> $100,000 paper portfolio to test every idea
            </li>
            <li>
              <Icon name="bell" size={18} /> Alerts, screeners and simulations in one place
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

/** Move focus to the first invalid field after React paints the errors. */
const focusFirstError = (e) => {
  const form = e.currentTarget
  requestAnimationFrame(() => form.querySelector('[aria-invalid="true"], .check.has-error input')?.focus())
}

function FormError({ message }) {
  if (!message) return null
  return (
    <div className="form-banner">
      <Notice tone="error" compact>
        {message}
      </Notice>
    </div>
  )
}

/* ------------------------------------------------------------------ login */
export function LoginScreen() {
  const { login } = useAuth()
  const next = useQuery().get('next')
  const [form, setForm] = useState({ email: '', password: '', remember: true })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState('')
  const [loading, setLoading] = useState(false)
  // Set by the auth provider when an API call finds the session gone.
  const [expired] = useState(() => {
    try {
      const v = sessionStorage.getItem('stxck:expired') === '1'
      sessionStorage.removeItem('stxck:expired')
      return v
    } catch {
      return false
    }
  })

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address'
    if (!form.password) errs.password = 'Enter your password'
    setErrors(errs)
    setBanner('')
    if (Object.keys(errs).length) return focusFirstError(e)
    setLoading(true)
    try {
      const user = await login(form)
      navigate(user.onboarded ? (next && next.startsWith('/app') ? next : '/app') : '/welcome', { replace: true })
    } catch (err) {
      setBanner(err.message)
      setErrors(err.fields)
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth__title">Welcome back</h1>
      <p className="auth__sub">Log in to pick up where your research left off.</p>
      <form className="auth__form" onSubmit={submit} noValidate>
        {expired && !banner && (
          <div className="form-banner">
            <Notice tone="info" compact>
              Your session expired. Log in again to continue — your chats and portfolio are still here.
            </Notice>
          </div>
        )}
        <FormError message={banner} />
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          value={form.email}
          error={errors.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <PasswordField
          name="password"
          autoComplete="current-password"
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          right={
            <Link to="/forgot" className="af__link">
              Forgot password?
            </Link>
          }
        />
        <label className="check">
          <input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} />
          <span className="check__box" aria-hidden="true">
            <Icon name="check" size={12} stroke={2.6} />
          </span>
          Keep me signed in for 30 days
        </label>
        <SubmitButton loading={loading}>Log in</SubmitButton>
      </form>
      <p className="auth__switch">
        New to Stxck? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  )
}

/* ----------------------------------------------------------------- signup */
export function SignupScreen() {
  const { signup } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', agree: false })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [banner, setBanner] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = (f) => {
    const errs = {}
    if (!f.name.trim()) errs.name = 'Tell us your name'
    if (!EMAIL_RE.test(f.email.trim())) errs.email = 'Enter a valid email address'
    if (f.password.length < 8) errs.password = 'Use at least 8 characters'
    else if (!PW_MIX.test(f.password)) errs.password = 'Mix letters with numbers or symbols'
    if (!f.agree) errs.agree = 'Please confirm to continue'
    return errs
  }
  const liveErrors = validate(form)
  const shown = (k) => (touched[k] ? errors[k] || liveErrors[k] : errors[k])

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(form)
    setTouched({ name: true, email: true, password: true, agree: true })
    setErrors(errs)
    setBanner('')
    if (Object.keys(errs).length) return focusFirstError(e)
    setLoading(true)
    try {
      await signup({ name: form.name, email: form.email, password: form.password, remember: true })
      navigate('/welcome', { replace: true })
    } catch (err) {
      setBanner(err.status === 409 ? '' : err.message)
      setErrors(err.fields)
      setLoading(false)
    }
  }
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value })
    if (errors[k]) setErrors({ ...errors, [k]: undefined })
  }
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }))

  return (
    <AuthLayout>
      <h1 className="auth__title">Create your account</h1>
      <p className="auth__sub">Free to start, with $100,000 in paper money to practise.</p>
      <form className="auth__form" onSubmit={submit} noValidate>
        <FormError message={banner} />
        <TextField label="Full name" name="name" autoComplete="name" autoFocus value={form.name} error={shown('name')} onChange={set('name')} onBlur={blur('name')} />
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          error={shown('email')}
          onChange={set('email')}
          onBlur={blur('email')}
        />
        {errors.email?.startsWith('Already') && (
          <p className="af__nudge">
            <Link to="/login">Log in instead →</Link>
          </p>
        )}
        <PasswordField name="password" autoComplete="new-password" meter value={form.password} error={shown('password')} onChange={set('password')} onBlur={blur('password')} />
        <label className={`check ${shown('agree') ? 'has-error' : ''}`}>
          <input type="checkbox" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} />
          <span className="check__box" aria-hidden="true">
            <Icon name="check" size={12} stroke={2.6} />
          </span>
          I understand Stxck is for research and education, not financial advice.
        </label>
        <SubmitButton loading={loading}>Create account</SubmitButton>
      </form>
      <p className="auth__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  )
}

/* ----------------------------------------------------------------- forgot */
export function ForgotScreen() {
  const { forgot } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address')
    setError('')
    setLoading(true)
    try {
      setSent(await forgot(email))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {sent ? (
        <div className="auth__done">
          <span className="auth__done-icon">
            <Icon name="mail" size={22} />
          </span>
          <h1 className="auth__title">Check your inbox</h1>
          <p className="auth__sub">
            If an account exists for <b>{email}</b>, we've sent a link to reset your password. It expires in one hour.
          </p>
          {sent.devLink && (
            <Link to={sent.devLink.replace(/^https?:\/\/[^/]+/, '')} className="btn btn--ghost btn--block">
              Open reset link (development)
            </Link>
          )}
          <p className="auth__switch">
            <Link to="/login">Back to log in</Link>
          </p>
        </div>
      ) : (
        <>
          <h1 className="auth__title">Reset your password</h1>
          <p className="auth__sub">Enter the email you signed up with and we'll send you a reset link.</p>
          <form className="auth__form" onSubmit={submit} noValidate>
            <TextField label="Email" type="email" autoComplete="email" inputMode="email" autoFocus value={email} error={error} onChange={(e) => setEmail(e.target.value)} />
            <SubmitButton loading={loading}>Send reset link</SubmitButton>
          </form>
          <p className="auth__switch">
            Remembered it? <Link to="/login">Log in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}

/* ------------------------------------------------------------------ reset */
export function ResetScreen() {
  const { reset } = useAuth()
  const token = useQuery().get('token') || ''
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (pw.length < 8) errs.password = 'Use at least 8 characters'
    else if (!PW_MIX.test(pw)) errs.password = 'Mix letters with numbers or symbols'
    if (confirm !== pw) errs.confirm = 'Passwords don’t match'
    setErrors(errs)
    if (Object.keys(errs).length || !token) return focusFirstError(e)
    setLoading(true)
    try {
      await reset(token, pw)
      navigate('/app', { replace: true })
    } catch (err) {
      setBanner(err.message)
      setErrors(err.fields)
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth__title">Choose a new password</h1>
      <p className="auth__sub">You'll be signed in right after, and other devices will be signed out.</p>
      <form className="auth__form" onSubmit={submit} noValidate>
        <FormError message={banner || (!token ? 'This reset link is missing its token. Request a new one.' : '')} />
        <PasswordField label="New password" autoComplete="new-password" autoFocus meter value={pw} error={errors.password} onChange={(e) => setPw(e.target.value)} />
        <PasswordField label="Confirm password" autoComplete="new-password" value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)} />
        <SubmitButton loading={loading}>Update password</SubmitButton>
      </form>
      <p className="auth__switch">
        Link expired? <Link to="/forgot">Request a new one</Link>
      </p>
    </AuthLayout>
  )
}
