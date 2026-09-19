import { useEffect, useRef, useState } from 'react'

// Keys are scoped per signed-in user: nerve:u:<id>:<key>
let PREFIX = 'nerve:anon:'

/** Point storage at a user. Pre-account data (from before sign-in existed) moves to the first user. */
export function setStorageScope(userId) {
  PREFIX = `nerve:u:${userId}:`
  try {
    const legacy = Object.keys(localStorage).filter((k) => /^nerve:[a-zA-Z]+$/.test(k))
    const hasOwn = Object.keys(localStorage).some((k) => k.startsWith(PREFIX))
    if (legacy.length && !hasOwn) {
      for (const k of legacy) localStorage.setItem(PREFIX + k.slice(6), localStorage.getItem(k))
    }
    legacy.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* storage unavailable */
  }
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* storage unavailable */
  }
}

/** useState that survives reloads. Writes are debounced to keep streaming cheap. */
export function usePersistentState(key, initial, delay = 250) {
  const [value, setValue] = useState(() => load(key, typeof initial === 'function' ? initial() : initial))
  const timer = useRef(0)
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(key, value), delay)
    return () => clearTimeout(timer.current)
  }, [key, value, delay])
  return [value, setValue]
}

export const uid = (p = 'c') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
