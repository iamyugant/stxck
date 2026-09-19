import Icon from '../Icon.jsx'
import { NAV_ITEMS } from './nav.js'


export default function IconRail({ active, onSelect, account }) {
  return (
    <nav className="icon-rail" aria-label="Primary">
      <div className="icon-rail__group">
        {NAV_ITEMS.map((it) => (
          <button
            key={it.id}
            className={`rail-btn ${active === it.id ? 'is-active' : ''}`}
            onClick={() => onSelect(it.id)}
            aria-label={it.label}
            aria-current={active === it.id ? 'page' : undefined}
            data-tip={it.label}
          >
            <Icon name={it.icon} size={20} weight={active === it.id ? 'fill' : 'regular'} />
          </button>
        ))}
      </div>
      <div className="icon-rail__group">
        <button className="rail-btn" aria-label="Settings" data-tip="Settings" onClick={() => onSelect('settings')}>
          <Icon name="settings" size={20} />
        </button>
        {account}
      </div>
    </nav>
  )
}
