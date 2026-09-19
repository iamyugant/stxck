import { useEffect, useState } from 'react'
import Icon, { Trend } from '../Icon.jsx'
import PixelField from '../shell/PixelField.jsx'
import { CompanyLogo } from '../Logos.jsx'
import Sparkline from '../Sparkline.jsx'
import { BrandMark, ProductPreview, TickerTape } from './Brand.jsx'
import { useTape } from '../../lib/tape.js'
import { Link } from '../../lib/router.js'
import { useAuth } from '../../lib/auth.jsx'
import { fmt, fmtPct } from '../../lib/format.js'

const NAV = [
  ['#product', 'Product'],
  ['#how', 'How it works'],
  ['#pricing', 'Pricing'],
  ['#faq', 'FAQ'],
]

const CAPABILITIES = [
  ['chat', 'Conversational research', 'Ask in plain English about a company, a sector or the market. Follow up like you would with an analyst.'],
  ['chart', 'Live price cards', 'Every answer about a stock comes with an interactive chart across eight timeframes and the stats that matter.'],
  ['landmark', 'Fundamentals, decoded', 'Margins, growth, cash and debt, EPS surprises and analyst targets — summarized, not dumped.'],
  ['grid', 'Screener', 'Scan large caps by day move, year-to-date and distance from highs. Filter by sector in one tap.'],
  ['briefcase', 'Paper portfolio', '$100,000 in virtual cash, filled at live prices. See how an idea would have played out.'],
  ['bell', 'Alerts and simulations', 'Get notified when a price crosses your level, or backtest a position in seconds.'],
]

const FAQ = [
  ['Is Stxck financial advice?', 'No. Stxck is a research and education tool. It explains data and trade-offs so you can decide for yourself, and it won’t tell you what you personally should buy or sell.'],
  ['Where does the market data come from?', 'Quotes, charts and fundamentals come from public market-data sources and may be delayed. Every answer lists the tools and sources it used.'],
  ['Do paper trades use real money?', 'Never. Your paper portfolio starts with $100,000 of virtual cash and fills market orders at live prices. No brokerage is connected.'],
  ['What does Deep Research do?', 'It lets the analyst search more sources and think longer before answering. It’s slower, and best for multi-company or “why is this moving” questions.'],
  ['How is my data handled?', 'Chats, watchlist and portfolio are stored on your device and tied to your account. Passwords are salted and hashed; we never store them in plain text.'],
]

function Nav() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const cta = user ? (
    <Link to="/app" className="btn btn--primary btn--sm">
      Open Stxck
    </Link>
  ) : (
    <>
      <Link to="/login" className="btn btn--quiet btn--sm">
        Log in
      </Link>
      <Link to="/signup" className="btn btn--primary btn--sm">
        Sign up
      </Link>
    </>
  )
  return (
    <header className={`site-nav ${scrolled || open ? 'is-scrolled' : ''}`}>
      <div className="site-nav__inner">
        <BrandMark />
        <nav className="site-nav__links" aria-label="Sections">
          {NAV.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="site-nav__cta">{cta}</div>
        <button className="icon-btn site-nav__burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'x' : 'menu'} size={18} />
        </button>
      </div>
      {open && (
        <div className="site-nav__sheet" onClick={() => setOpen(false)}>
          {NAV.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
          <div className="site-nav__sheet-cta">{cta}</div>
        </div>
      )}
    </header>
  )
}

function Spotlight({ kicker, title, body, children, flip }) {
  return (
    <div className={`spot ${flip ? 'spot--flip' : ''}`}>
      <div className="spot__copy">
        <p className="kicker">{kicker}</p>
        <h3 className="spot__title">{title}</h3>
        <p className="spot__body">{body}</p>
      </div>
      <div className="spot__visual">{children}</div>
    </div>
  )
}

function TrailMock() {
  const steps = ['Pulling NVDA and AMD price action', 'Reading NVDA financial statements', 'Scanning headlines for NVDA']
  return (
    <div className="mock">
      <div className="mock__bubble">Why did Nvidia outperform AMD this quarter?</div>
      <ul className="tool-trail mock__trail">
        {steps.map((s) => (
          <li key={s} className="is-done">
            <span className="tool-trail__dot">
              <Icon name="checkCircle" size={15} weight="fill" />
            </span>
            {s}
          </li>
        ))}
      </ul>
      <div className="mock__refs">
        <span>
          <Icon name="link" size={13} /> 6 sources
        </span>
        <span>Yahoo Finance · Nvidia IR · Reuters</span>
      </div>
    </div>
  )
}

function PortfolioMock({ tape }) {
  const rows = ['NVDA', 'AAPL', 'MSFT'].map((s) => tape.find((t) => t.symbol === s)).filter(Boolean)
  return (
    <div className="mock">
      <p className="muted-label">Paper portfolio</p>
      <p className="mock__big">$100,000.00</p>
      <div className="alloc-bar">
        <span style={{ width: '34%', background: 'var(--sky)' }} />
        <span style={{ width: '22%', background: 'var(--yellow)' }} />
        <span style={{ width: '18%', background: 'var(--up)' }} />
        <span style={{ width: '26%', background: 'var(--gray-600)' }} />
      </div>
      <div className="mock__rows">
        {rows.map((r) => (
          <div key={r.symbol} className="mock__row">
            <CompanyLogo symbol={r.symbol} size={26} />
            <span className="mock__sym">{r.symbol}</span>
            <Sparkline values={[3, 4, 3.5, 5, 4.6, 5.4, 5.1, 6, 5.7, 6.4].map((v) => (r.changePct >= 0 ? v : 7 - v))} width={64} height={22} color={r.changePct >= 0 ? 'var(--up)' : 'var(--down)'} />
            <span className="mock__px">${fmt(r.price)}</span>
            <span className={`mock__chg ${r.changePct >= 0 ? 'is-up' : 'is-down'}`}>
              <Trend up={r.changePct >= 0} /> {fmtPct(Math.abs(r.changePct)).replace('+', '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const tape = useTape()
  const primary = user ? { to: '/app', label: 'Open Stxck' } : { to: '/signup', label: 'Create free account' }
  return (
    <div className="site">
      <Nav />
      <TickerTape tape={tape} />
      <main>
        <section className="hero-x">
          <div className="hero-x__copy">
            <p className="kicker">AI stock research</p>
            <h1 className="hero-x__title">
              Your stock analyst,
              <br />
              <span className="dim">powered by Stxck.</span>
            </h1>
            <p className="hero-x__sub">
              Ask about any stock or the whole market. Stxck pulls live prices, fundamentals and news, explains what matters, and lets you
              test the idea with a paper portfolio.
            </p>
            <div className="hero-x__cta">
              <Link to={primary.to} className="btn btn--primary btn--xl">
                {primary.label}
              </Link>
              {!user && (
                <Link to="/login" className="btn btn--ghost btn--xl">
                  Log in
                </Link>
              )}
            </div>
            <p className="hero-x__fine">Free to start. No card required.</p>
          </div>
          <div className="hero-x__visual">
            <ProductPreview tape={tape} />
          </div>
        </section>

        <section id="product" className="section">
          <div className="section__head section__head--left">
            <p className="kicker">Product</p>
            <h2 className="section__title">Research, charts and practice trading in one place.</h2>
          </div>
          <div className="caps">
            {CAPABILITIES.map(([icon, title, body]) => (
              <article key={title} className="cap">
                <Icon name={icon} size={22} className="cap__icon" />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section section--spot">
          <Spotlight
            kicker="Transparent by design"
            title="Answers that show their work."
            body="Every response lists the data tools it called and the sources it read, so you can check the numbers behind the narrative."
          >
            <TrailMock />
          </Spotlight>
          <Spotlight
            flip
            kicker="Paper trading"
            title="Practice without the risk."
            body="Turn any answer into a paper trade. Track positions, P&L and allocation at live prices before you put real money anywhere."
          >
            <PortfolioMock tape={tape} />
          </Spotlight>
        </section>

        <section id="how" className="section">
          <div className="section__head section__head--left">
            <p className="kicker">How it works</p>
            <h2 className="section__title">Three steps. No spreadsheets.</h2>
          </div>
          <ol className="steps">
            {[
              ['Ask', 'Type or dictate a question about a stock, a sector or the whole market.'],
              ['Review', 'Stxck pulls live data and the latest headlines, then explains what matters and why.'],
              ['Act', 'Add it to your watchlist, set an alert, run a simulation or place a paper trade.'],
            ].map(([t, b], k) => (
              <li key={t} className="step">
                <span className="step__n">0{k + 1}</span>
                <h3>{t}</h3>
                <p>{b}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="section">
          <div className="section__head section__head--left">
            <p className="kicker">Pricing</p>
            <h2 className="section__title">Start free. Upgrade when you need more depth.</h2>
          </div>
          <div className="price-grid">
            <div className="price-card">
              <div className="price-card__top">
                <h3>Free</h3>
                <p className="price-card__price">
                  $0<span> / month</span>
                </p>
                <p className="price-card__desc">Everything you need to research and practise.</p>
              </div>
              <ul>
                {['AI analyst chat', 'Live quotes, charts and fundamentals', 'Screener and sector view', '$100k paper portfolio', 'Price alerts'].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={14} /> {f}
                  </li>
                ))}
              </ul>
              <Link to={user ? '/app' : '/signup'} className="btn btn--ghost btn--lg btn--block">
                {user ? 'Open Stxck' : 'Create free account'}
              </Link>
            </div>
            <div className="price-card is-pro">
              <div className="price-card__top">
                <h3>
                  Pro <span className="badge badge--soon">Coming soon</span>
                </h3>
                <p className="price-card__price">
                  $19<span> / month</span>
                </p>
                <p className="price-card__desc">For deeper, longer research sessions.</p>
              </div>
              <ul>
                {['Everything in Free', 'Unlimited Deep Research', 'Stxck Reasoning model', 'Email alerts in the background', 'Report exports'].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={14} /> {f}
                  </li>
                ))}
              </ul>
              <Link to={user ? '/app' : '/signup'} className="btn btn--primary btn--lg btn--block">
                Join the waitlist
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className="section">
          <div className="faq-wrap">
            <div className="section__head section__head--left">
              <p className="kicker">FAQ</p>
              <h2 className="section__title">Questions, answered.</h2>
            </div>
            <div className="faq">
              {FAQ.map(([q, a]) => (
                <details key={q} className="faq__item">
                  <summary>
                    {q}
                    <Icon name="plus" size={16} />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-band">
          <PixelField className="cta-band__pixels" cell={10} intensity={0.6} />
          <div className="cta-band__inner">
            <h2>Your next idea deserves a second opinion.</h2>
            <p>Create a free account and ask Stxck your first question in under a minute.</p>
            <Link to={primary.to} className="btn btn--primary btn--xl">
              {primary.label}
            </Link>
          </div>
        </section>
      </main>
      <footer className="site-foot">
        <div className="site-foot__inner">
          <div className="site-foot__brand">
            <BrandMark />
            <p>AI stock research with live market data.</p>
          </div>
          <nav aria-label="Footer" className="site-foot__cols">
            <div>
              <p className="muted-label">Product</p>
              <a href="#product">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <p className="muted-label">Account</p>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
              <Link to="/forgot">Reset password</Link>
            </div>
          </nav>
        </div>
        <p className="site-foot__legal">
          © {new Date().getFullYear()} Stxck. Stxck provides research and educational content, not investment advice. Market data may be
          delayed. Paper trading uses virtual money.
        </p>
      </footer>
    </div>
  )
}
