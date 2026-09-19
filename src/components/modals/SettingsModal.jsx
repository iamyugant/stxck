import { useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { clearAll, load } from '../../lib/storage.js'
import { useAuth } from '../../lib/auth.jsx'
import { navigate } from '../../lib/router.js'
import { downloadFile } from '../../lib/exportChat.js'
import { Avatar } from '../shell/Nav.jsx'
import { PasswordField, TextField } from '../auth/Fields.jsx'

function AccountSection({ user, onLogout, notify }) {
  const { update, changePassword, deleteAccount } = useAuth()
  const [name, setName] = useState(user.name)
  const [mode, setMode] = useState(null)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const saveName = async () => {
    if (!name.trim() || name.trim() === user.name) return setName(user.name)
    try {
      await update({ name: name.trim() })
      notify('Name updated')
    } catch (err) {
      notify(err.message)
      setName(user.name)
    }
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) return setErrors({ confirm: 'Passwords don’t match' })
    setBusy(true)
    try {
      await changePassword(pw.current, pw.next)
      notify('Password changed. Other devices were signed out.')
      setMode(null)
      setPw({ current: '', next: '', confirm: '' })
      setErrors({})
    } catch (err) {
      setErrors(Object.keys(err.fields).length ? { current: err.fields.current, next: err.fields.next } : { next: err.message })
    } finally {
      setBusy(false)
    }
  }

  const submitDelete = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await deleteAccount(pw.current)
      clearAll()
      navigate('/', { replace: true })
    } catch (err) {
      setErrors({ current: err.fields.password || err.message })
      setBusy(false)
    }
  }

  return (
    <section className="settings-sec">
      <h3>Account</h3>
      <div className="account-row">
        <Avatar user={user} size={44} />
        <div className="account-row__fields">
          <TextField label="Name" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          <span className="muted-block">{user.email} · member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
      {mode === 'password' && (
        <form className="inline-form" onSubmit={submitPassword}>
          <PasswordField label="Current password" autoComplete="current-password" value={pw.current} error={errors.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <PasswordField label="New password" autoComplete="new-password" meter value={pw.next} error={errors.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <PasswordField label="Confirm new password" autoComplete="new-password" value={pw.confirm} error={errors.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          <div className="btn-row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => (setMode(null), setErrors({}))}>Cancel</button>
            <button className="btn btn--primary btn--sm" disabled={busy}>Update password</button>
          </div>
        </form>
      )}
      {mode === 'delete' && (
        <form className="inline-form inline-form--danger" onSubmit={submitDelete}>
          <p>This permanently deletes your account and the data stored on this device. It can't be undone.</p>
          <PasswordField label="Confirm with your password" autoComplete="current-password" value={pw.current} error={errors.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <div className="btn-row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => (setMode(null), setErrors({}))}>Cancel</button>
            <button className="btn btn--danger btn--sm" disabled={busy || !pw.current}>Delete my account</button>
          </div>
        </form>
      )}
      {!mode && (
        <div className="btn-row">
          <button className="btn btn--ghost btn--sm" onClick={() => setMode('password')}>
            <Icon name="lock" size={14} /> Change password
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onLogout}>
            <Icon name="logout" size={14} /> Log out
          </button>
          <button className="btn btn--danger btn--sm" onClick={() => setMode('delete')}>
            Delete account
          </button>
        </div>
      )}
    </section>
  )
}

export default function SettingsModal({ user, onLogout, ai, prefs, setPrefs, onClearChats, onResetPortfolio, onClose, notify }) {
  const [confirm, setConfirm] = useState(null)
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'

  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      chats: load('chats', []),
      watchlist: load('watchlist', []),
      portfolio: load('portfolio', null),
      alerts: load('alerts', []),
    }
    downloadFile(`stxck-export-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json')
  }

  const danger = {
    chats: ['Delete all chats?', onClearChats],
    portfolio: ['Reset paper portfolio to $100,000?', onResetPortfolio],
    all: [
      'Erase everything on this device?',
      () => {
        clearAll()
        location.reload()
      },
    ],
  }

  return (
    <Modal title="Settings" onClose={onClose} width={520}>
      {user && <AccountSection user={user} onLogout={onLogout} notify={notify} />}
      <section className="settings-sec">
        <h3>AI analyst</h3>
        <div className={`status-line ${ai?.enabled ? 'is-ok' : 'is-warn'}`}>
          <span className="status-dot" />
          {ai == null ? 'Checking…' : ai.enabled ? `Connected · ${ai.model}` : 'Demo mode · template answers only'}
        </div>
        {ai && !ai.enabled && (
          <p className="muted-block">
            Set <code>ANTHROPIC_API_KEY</code> in the server's <code>.env</code> file and restart to enable the full AI analyst.
          </p>
        )}
        <label className="toggle-row">
          <span>
            <strong>Web search by default</strong>
            <span className="muted-block">Let the analyst search the web for recent news.</span>
          </span>
          <input type="checkbox" checked={prefs.web} onChange={(e) => setPrefs({ ...prefs, web: e.target.checked })} />
        </label>
        <label className="toggle-row">
          <span>
            <strong>Deep Research by default</strong>
            <span className="muted-block">Slower, more thorough answers with more sources.</span>
          </span>
          <input type="checkbox" checked={prefs.deep} onChange={(e) => setPrefs({ ...prefs, deep: e.target.checked })} />
        </label>
      </section>

      <section className="settings-sec">
        <h3>Notifications</h3>
        <div className="toggle-row">
          <span>
            <strong>Desktop alerts</strong>
            <span className="muted-block">
              {perm === 'granted' ? 'Enabled for price alerts.' : perm === 'denied' ? 'Blocked in your browser settings.' : 'Get a system notification when an alert fires.'}
            </span>
          </span>
          {perm === 'default' && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => Notification.requestPermission().then((p) => notify(p === 'granted' ? 'Desktop alerts enabled' : 'Desktop alerts not enabled'))}
            >
              Enable
            </button>
          )}
        </div>
      </section>

      <section className="settings-sec">
        <h3>Your data</h3>
        <p className="muted-block">Chats, watchlist, alerts and your paper portfolio are stored in this browser only.</p>
        <div className="btn-row">
          <button className="btn btn--ghost btn--sm" onClick={exportData}>
            <Icon name="download" size={14} /> Export JSON
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setConfirm('chats')}>
            Delete chats
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setConfirm('portfolio')}>
            Reset portfolio
          </button>
          <button className="btn btn--danger btn--sm" onClick={() => setConfirm('all')}>
            Erase all
          </button>
        </div>
        {confirm && (
          <div className="confirm-bar" role="alert">
            <span>{danger[confirm][0]}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn btn--danger btn--sm"
              onClick={() => {
                danger[confirm][1]()
                setConfirm(null)
              }}
            >
              Confirm
            </button>
          </div>
        )}
      </section>
      <p className="data-card__note">
        Stxck provides research and education, not investment advice. Market data from Yahoo Finance may be delayed.
      </p>
    </Modal>
  )
}
