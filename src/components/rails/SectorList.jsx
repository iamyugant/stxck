import Icon, { Trend } from '../Icon.jsx'
import { fmt } from '../../lib/format.js'

export default function SectorList({ sectors, showTarget = false }) {
  return (
    <div className="sector-list">
      {sectors.map((s, i) => {
        const up = s.pct >= 0
        return (
          <div className="sector" key={s.key}>
            <div className="sector__row">
              <span className="sector__name">
                <Icon name={s.icon} size={15} />
                {s.name}
              </span>
              <span className="sector__value">{showTarget ? `${Math.round(s.target * 100)}% target` : fmt(s.value)}</span>
            </div>
            <div className="sector__track">
              <div
                className={`sector__fill ${up ? 'is-up' : 'is-down'}`}
                style={{ '--fill': `${(showTarget ? s.target : s.fill) * 100}%`, animationDelay: `${i * 90}ms` }}
              >
                <span className={`sector__pill ${up ? 'is-up' : 'is-down'}`}>
                  <Trend up={up} /> {fmt(Math.abs(s.pct))}%
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
