import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

/** Accessible dialog: focus trap-lite, Escape to close, click-outside to close. */
export default function Modal({ title, subtitle, onClose, children, width = 440, footer }) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    const el = ref.current
    const first = el?.querySelector('input:not([type=checkbox]):not([disabled]), select, textarea') || el?.querySelector('button:not(.modal__close)')
    ;(first || el)?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll('button, input, select, textarea, a[href]')].filter((n) => !n.disabled)
        if (!items.length) return
        const [a, b] = [items[0], items[items.length - 1]]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} style={{ maxWidth: width }}>
        <div className="modal__head">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__sub">{subtitle}</p>}
          </div>
          <button className="ghost-btn modal__close" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
