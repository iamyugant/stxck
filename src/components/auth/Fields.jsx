import { useId, useState } from 'react'
import Icon from '../Icon.jsx'

export function TextField({ label, error, hint, right, className = '', ...input }) {
  const id = useId()
  return (
    <div className={`af ${error ? 'has-error' : ''} ${className}`}>
      <div className="af__row">
        <label htmlFor={id} className="af__label">
          {label}
        </label>
        {right}
      </div>
      <input
        id={id}
        className="af__input"
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...input}
      />
      {(error || hint) && (
        <p id={`${id}-msg`} className={error ? 'af__error' : 'af__hint'} role={error ? 'alert' : undefined}>
          {error ? (
            <>
              <Icon name="alert" size={13} /> {error}
            </>
          ) : (
            hint
          )}
        </p>
      )}
    </div>
  )
}

/** Score 0–4 from length and character variety. */
function passwordScore(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++
  else if (/\d|[^a-zA-Z0-9]/.test(pw) && pw.length >= 10) s++
  return Math.min(4, s)
}
const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

export function PasswordField({ label = 'Password', error, meter, right, ...input }) {
  const id = useId()
  const [show, setShow] = useState(false)
  const score = passwordScore(input.value)
  return (
    <div className={`af ${error ? 'has-error' : ''}`}>
      <div className="af__row">
        <label htmlFor={id} className="af__label">
          {label}
        </label>
        {right}
      </div>
      <div className="af__pw">
        <input
          id={id}
          className="af__input"
          type={show ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-msg`}
          {...input}
        />
        <button type="button" className="af__eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {meter && input.value && (
        <div className="pw-meter" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={i <= score ? `is-on s${score}` : ''} />
          ))}
          <em>{LABELS[score]}</em>
        </div>
      )}
      <p id={`${id}-msg`} className={error ? 'af__error' : 'af__hint'} role={error ? 'alert' : undefined}>
        {error ? (
          <>
            <Icon name="alert" size={13} /> {error}
          </>
        ) : meter ? (
          'At least 8 characters, mixing letters with numbers or symbols.'
        ) : null}
      </p>
    </div>
  )
}

function Eye() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function EyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20" />
    </svg>
  )
}

export function SubmitButton({ loading, children, ...rest }) {
  return (
    <button type="submit" className="btn btn--primary btn--lg btn--block auth-submit" disabled={loading} aria-busy={loading} {...rest}>
      {loading ? <span className="spinner spinner--dark" aria-hidden="true" /> : children}
    </button>
  )
}
