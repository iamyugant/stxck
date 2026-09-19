import Icon, { Trend } from '../Icon.jsx'
import { CompanyLogo } from '../Logos.jsx'
import Sparkline from '../Sparkline.jsx'
import { fmt, fmtSigned } from '../../lib/format.js'
import { Skeleton } from '../ui/States.jsx'
import { Flash } from '../ui/Live.jsx'

export default function WatchlistCard({ item, starred, onStar, onOpen, compact = false }) {
  const up = item.change >= 0
  return (
    <div className={`watch-card ${compact ? 'watch-card--compact' : ''}`}>
      {onOpen && <button className="watch-card__hit" onClick={onOpen} aria-label={`Analyze ${item.name}`} />}
      <div className="watch-card__head">
        <CompanyLogo symbol={item.symbol} size={32} />
        <div className="watch-card__id">
          <span className="eyebrow">{item.symbol.replace('^', '')}</span>
          <span className="watch-card__name">{item.name}</span>
        </div>
        {onStar && (
          <button
            className={`star-btn ${starred ? 'is-on' : ''}`}
            aria-label={starred ? `Remove ${item.symbol} from watchlist` : `Add ${item.symbol} to watchlist`}
            aria-pressed={starred}
            onClick={onStar}
          >
            <Icon name="star" size={16} stroke={1.4} />
          </button>
        )}
      </div>
      <div className="watch-card__foot">
        <Flash value={item.price} className="watch-card__price">
          {fmt(item.price)}
        </Flash>
        <span className={`delta-stack ${up ? 'is-up' : 'is-down'}`}>
          <span>{fmtSigned(item.change)}</span>
          <span className="delta-stack__pct">
            <Trend up={up} /> {fmtSigned(item.changePct)}%
          </span>
        </span>
        <Sparkline values={item.spark} color={up ? 'var(--up)' : 'var(--down)'} />
      </div>
    </div>
  )
}

export function WatchlistSkeleton() {
  return (
    <div className="watch-card watch-card--ghost" aria-hidden="true">
      <div className="watch-card__head">
        <Skeleton w={32} h={32} r={999} />
        <div className="watch-card__id" style={{ gap: 6 }}>
          <Skeleton w={36} h={8} />
          <Skeleton w={96} h={10} />
        </div>
      </div>
      <div className="watch-card__foot">
        <Skeleton w={72} h={18} />
        <Skeleton w={76} h={24} r={4} style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  )
}
