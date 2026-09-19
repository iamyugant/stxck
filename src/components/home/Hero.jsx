import Icon from '../Icon.jsx'
import GlobeField from './GlobeField.jsx'

const PROMPTS = [
  { text: 'Analyze today’s market sentiment', icon: 'bars', tone: 'sky' },
  { text: 'Suggest a better diversification strategy', icon: 'fileSearch', tone: 'yellow' },
  { text: 'Break down a company’s financial health', icon: 'landmark', tone: 'green' },
]

export default function Hero({ onPrompt }) {
  return (
    <section className="hero">
      <GlobeField size={250} />
      <h1 className="hero__title">
        Your stock analyst,
        <br />
        <span className="dim">powered by Stxck.</span>
      </h1>
      <p className="hero__sub">Stxck turns every question into actionable stock insights</p>
      <div className="prompt-cards">
        {PROMPTS.map((p, i) => (
          <button
            key={p.text}
            className={`prompt-card prompt-card--${p.tone}`}
            style={{ animationDelay: `${120 + i * 70}ms` }}
            onClick={() => onPrompt(p.text)}
          >
            <span className="prompt-card__text">{p.text}</span>
            <Icon name={p.icon} size={20} className="prompt-card__icon" />
          </button>
        ))}
      </div>
    </section>
  )
}
