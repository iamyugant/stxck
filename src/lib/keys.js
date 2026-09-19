export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const MOD = IS_MAC ? '⌘' : 'Ctrl'

/** True when focus is in a text field, so single-key shortcuts should not fire. */
export const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
