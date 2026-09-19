import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setStorageScope } from './storage.js'

const AuthContext = createContext(null)

async function call(path, method = 'GET', body) {
  const res = await fetch(`/api/auth${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Try again.'), { status: res.status, fields: data.fields || {} })
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out

  const apply = useCallback((u) => {
    if (u) setStorageScope(u.id)
    setUser(u)
    return u
  }, [])

  useEffect(() => {
    call('/me')
      .then((d) => apply(d.user))
      .catch(() => apply(null))
    // Any API call that finds the session gone signs the UI out.
    const onExpired = () => {
      try {
        sessionStorage.setItem('stxck:expired', '1')
      } catch {
        /* storage unavailable */
      }
      setUser(null)
    }
    window.addEventListener('nerve:unauthorized', onExpired)
    return () => window.removeEventListener('nerve:unauthorized', onExpired)
  }, [apply])

  const value = useMemo(
    () => ({
      user,
      loading: user === undefined,
      signup: (body) => call('/signup', 'POST', body).then((d) => apply(d.user)),
      login: (body) => call('/login', 'POST', body).then((d) => apply(d.user)),
      logout: () => call('/logout', 'POST', {}).finally(() => setUser(null)),
      forgot: (email) => call('/forgot', 'POST', { email }),
      reset: (token, password) => call('/reset', 'POST', { token, password }).then((d) => apply(d.user)),
      update: (patch) => call('/me', 'PATCH', patch).then((d) => apply(d.user)),
      changePassword: (current, next) => call('/password', 'POST', { current, next }),
      deleteAccount: (password) => call('/me', 'DELETE', { password }).then(() => setUser(null)),
    }),
    [user, apply],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export const useAuth = () => useContext(AuthContext)
