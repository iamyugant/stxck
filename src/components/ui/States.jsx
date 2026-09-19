import Icon from '../Icon.jsx'
import { BLOCK_RADIUS, LOGO_BLOCKS } from '../../lib/brand.js'

/** Brand loader: the Stxck blocks build up bottom-left to the breakout, then reset. */
export function LogoLoader({ size = 20, label, still = false }) {
  return (
    <span className={`logo-loader ${still ? 'is-still' : ''}`} role={label ? 'status' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
        {LOGO_BLOCKS.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.s}
            height={b.s}
            rx={BLOCK_RADIUS}
            className={b.tone === 'sky' ? 'is-sky' : ''}
            style={{ animationDelay: `${i * 110}ms` }}
          />
        ))}
      </svg>
    </span>
  )
}

export function Spinner({ size = 16, tone }) {
  return <span className={`spin ${tone ? `spin--${tone}` : ''}`} style={{ width: size, height: size }} aria-hidden="true" />
}

const TONE_ICON = { error: 'alert', warn: 'alert', info: 'info', success: 'checkCircle' }

/** Inline message block: error / warn / info / success. */
export function Notice({ tone = 'error', title, children, action, compact = false }) {
  return (
    <div className={`notice-box notice-box--${tone} ${compact ? 'is-compact' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={TONE_ICON[tone]} size={16} weight="fill" className="notice-box__icon" />
      <div className="notice-box__body">
        {title && <p className="notice-box__title">{title}</p>}
        {children && <div className="notice-box__text">{children}</div>}
      </div>
      {action && <div className="notice-box__action">{action}</div>}
    </div>
  )
}

/** Centered empty state with a quiet icon, one line of guidance and an optional action. */
export function EmptyState({ icon = 'sparkles', title, body, action, size = 'md' }) {
  return (
    <div className={`empty empty--${size}`}>
      <span className="empty__icon">
        <Icon name={icon} size={20} />
      </span>
      <p className="empty__title">{title}</p>
      {body && <p className="empty__body">{body}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}

export function Skeleton({ w = '100%', h = 12, r = 6, className = '', style }) {
  return <span className={`skel ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, widths = ['92%', '84%', '58%'] }) {
  return (
    <span className="skel-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={widths[i % widths.length]} h={10} />
      ))}
    </span>
  )
}

/** Card-shaped placeholder for the price card while data loads. */
export function StockCardSkeleton() {
  return (
    <div className="card stock-skel" aria-hidden="true">
      <div className="stock-skel__head">
        <Skeleton w={36} h={36} r={999} />
        <span className="stock-skel__id">
          <Skeleton w={90} h={9} />
          <Skeleton w={150} h={12} />
        </span>
      </div>
      <Skeleton w={130} h={28} r={6} style={{ marginTop: 20 }} />
      <Skeleton w={200} h={10} style={{ marginTop: 10 }} />
      <Skeleton w="100%" h={180} r={8} style={{ marginTop: 20 }} />
    </div>
  )
}
