// Tiny history router: usePath() + navigate() + <Link>. No dependency needed for a handful of routes.
import { createElement, useSyncExternalStore } from 'react'

const EVENT = 'nerve:navigate'

function subscribe(cb) {
  window.addEventListener('popstate', cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener('popstate', cb)
    window.removeEventListener(EVENT, cb)
  }
}

export function usePath() {
  return useSyncExternalStore(subscribe, () => location.pathname)
}

export function useQuery() {
  const search = useSyncExternalStore(subscribe, () => location.search)
  return new URLSearchParams(search)
}

export function navigate(to, { replace = false } = {}) {
  if (to === location.pathname + location.search + location.hash) return
  history[replace ? 'replaceState' : 'pushState'](null, '', to)
  window.dispatchEvent(new Event(EVENT))
  if (!to.includes('#')) window.scrollTo(0, 0)
}

export function Link({ to, onClick, children, ...rest }) {
  return createElement(
    'a',
    {
      href: to,
      ...rest,
      onClick: (e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || rest.target) return
        e.preventDefault()
        navigate(to)
      },
    },
    children,
  )
}
