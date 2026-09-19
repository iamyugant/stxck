import { lazy, Suspense, useEffect } from 'react'
import { useAuth } from './lib/auth.jsx'
import { Link, navigate, usePath } from './lib/router.js'
import { LogoLoader } from './components/Logos.jsx'
import Landing from './components/landing/Landing.jsx'
import { ForgotScreen, LoginScreen, ResetScreen, SignupScreen } from './components/auth/AuthScreens.jsx'

const App = lazy(() => import('./App.jsx'))
const Welcome = lazy(() => import('./components/auth/Welcome.jsx'))

const TITLES = {
  '/': 'Stxck · AI Stock Analyst',
  '/login': 'Log in · Stxck',
  '/signup': 'Create account · Stxck',
  '/forgot': 'Reset password · Stxck',
  '/reset': 'Choose a new password · Stxck',
  '/welcome': 'Welcome · Stxck',
}

function Splash() {
  return (
    <div className="splash">
      <LogoLoader size={36} label="Loading Stxck" />
    </div>
  )
}

function Redirect({ to }) {
  useEffect(() => navigate(to, { replace: true }), [to])
  return <Splash />
}

function NotFound() {
  return (
    <div className="splash splash--404">
      <LogoLoader size={32} still />
      <h1>This page doesn’t exist</h1>
      <p>The link may be broken or the page may have moved.</p>
      <Link to="/" className="btn btn--primary">
        Go to Stxck
      </Link>
    </div>
  )
}

export default function Root() {
  const path = usePath()
  const { user, loading } = useAuth()

  useEffect(() => {
    document.title = TITLES[path] || (path.startsWith('/app') ? 'Stxck' : 'Stxck · AI Stock Analyst')
  }, [path])

  if (loading) return <Splash />
  const home = user ? (user.onboarded ? '/app' : '/welcome') : '/login'

  if (path === '/') return <Landing />
  if (path === '/login') return user ? <Redirect to={home} /> : <LoginScreen />
  if (path === '/signup') return user ? <Redirect to={home} /> : <SignupScreen />
  if (path === '/forgot') return user ? <Redirect to={home} /> : <ForgotScreen />
  if (path === '/reset') return <ResetScreen />

  if (path === '/welcome') {
    if (!user) return <Redirect to="/signup" />
    return (
      <Suspense fallback={<Splash />}>
        <Welcome />
      </Suspense>
    )
  }

  if (path === '/app' || path.startsWith('/app/')) {
    if (!user) return <Redirect to={`/login?next=${encodeURIComponent(path)}`} />
    if (!user.onboarded) return <Redirect to="/welcome" />
    return (
      <Suspense fallback={<Splash />}>
        <App key={user.id} />
      </Suspense>
    )
  }

  return <NotFound />
}
