import { memo, useMemo, useState } from 'react'
import Icon from '../Icon.jsx'
import AnalysisCard, { StatsGrid } from './AnalysisCard.jsx'
import { CompareCard, FundamentalsCard, MarketCard, SimulationCard } from './Cards.jsx'
import { renderMarkdown } from '../../lib/markdown.js'
import { textOf } from '../../lib/useChat.js'
import ErrorBoundary from '../ErrorBoundary.jsx'
import { LogoLoader, Notice, SkeletonText, Spinner } from '../ui/States.jsx'

export function UserBubble({ msg }) {
  return (
    <div className="msg-user">
      <div className="bubble">
        {msg.files?.length > 0 && (
          <div className="bubble__files">
            {msg.files.map((f) => (
              <span className="file-chip file-chip--static" key={f}>
                <Icon name="paperclip" size={12} />
                <span className="file-chip__name">{f}</span>
              </span>
            ))}
          </div>
        )}
        {msg.text}
      </div>
    </div>
  )
}

function Thinking({ line, thinking, hasTools }) {
  const detail = thinking?.split('\n').filter(Boolean).slice(-1)[0]
  return (
    <div className="thinking" aria-live="polite">
      {!hasTools && (
        <p className="thinking__status">
          <LogoLoader size={18} />
          <span>{line}</span>
        </p>
      )}
      {detail && <p className="thinking__detail">{detail}</p>}
      <div className="thinking__skeleton" aria-hidden="true">
        <SkeletonText lines={3} />
      </div>
    </div>
  )
}

function StepIcon({ state }) {
  if (state === 'done') return <Icon name="checkCircle" size={15} weight="fill" />
  if (state === 'error') return <Icon name="xCircle" size={15} weight="fill" />
  return <Spinner size={12} />
}

function ToolTrail({ tools, streaming }) {
  const [open, setOpen] = useState(false)
  if (!tools?.length) return null
  const failed = tools.filter((t) => t.state === 'error').length
  if (!streaming && !open) {
    return (
      <button className="tool-trail__toggle" onClick={() => setOpen(true)} aria-expanded="false">
        <Icon name={failed ? 'alert' : 'checkCircle'} size={13} weight="fill" style={failed ? { color: 'var(--warn)' } : undefined} />
        {tools.length} {tools.length === 1 ? 'step' : 'steps'}
        {failed ? ` · ${failed} unavailable` : ''}
        <Icon name="chevronDown" size={12} />
      </button>
    )
  }
  return (
    <ul className="tool-trail" aria-label="Analyst steps">
      {tools.map((t) => (
        <li key={t.id} className={`is-${t.state}`}>
          <span className="tool-trail__dot">
            <StepIcon state={t.state} />
          </span>
          {t.label}
          {t.state === 'error' && <span className="muted"> · unavailable</span>}
        </li>
      ))}
      {!streaming && (
        <li>
          <button className="link-btn" onClick={() => setOpen(false)}>
            Hide steps
          </button>
        </li>
      )}
    </ul>
  )
}

const Markdown = memo(function Markdown({ text, caret }) {
  const html = useMemo(() => renderMarkdown(text), [text])
  return <div className={`answer-text md ${caret ? 'has-caret' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
})

function CardPart({ card, ctx }) {
  switch (card.type) {
    case 'stock': {
      const sym = card.quote.symbol
      return (
        <div className="reveal stock-part">
          <AnalysisCard
            data={card}
            starred={ctx.watchlist.includes(sym)}
            onStar={() => ctx.onToggleWatch(sym)}
            onAlert={() => ctx.onOpen('alert', { symbol: sym, price: card.quote.price })}
            showChart
          />
          <StatsGrid quote={card.quote} stats={card.stats} />
        </div>
      )
    }
    case 'compare':
      return <div className="reveal"><CompareCard rows={card.rows} /></div>
    case 'fundamentals':
      return <div className="reveal"><FundamentalsCard data={card.data} /></div>
    case 'simulation':
      return <div className="reveal"><SimulationCard data={card.data} /></div>
    case 'market':
      return <div className="reveal"><MarketCard card={card} /></div>
    default:
      return null
  }
}

function Feedback({ text, sources, notify }) {
  const [vote, setVote] = useState(null)
  const [refs, setRefs] = useState(false)
  return (
    <>
      <div className="feedback reveal">
        <div className="feedback__group">
          <button
            className="ghost-btn"
            aria-label="Copy answer"
            onClick={() =>
              navigator.clipboard?.writeText(text).then(
                () => notify('Copied to clipboard'),
                () => notify('Copy failed'),
              )
            }
          >
            <Icon name="copy" size={16} />
          </button>
          <button
            className={`ghost-btn ${vote === 'up' ? 'is-on' : ''}`}
            aria-label="Good response"
            aria-pressed={vote === 'up'}
            onClick={() => {
              setVote(vote === 'up' ? null : 'up')
              if (vote !== 'up') notify('Thanks for the feedback')
            }}
          >
            <Icon name="thumbUp" size={16} />
          </button>
          <button
            className={`ghost-btn ${vote === 'down' ? 'is-on' : ''}`}
            aria-label="Bad response"
            aria-pressed={vote === 'down'}
            onClick={() => {
              setVote(vote === 'down' ? null : 'down')
              if (vote !== 'down') notify('Thanks, we’ll use this to improve')
            }}
          >
            <Icon name="thumbDown" size={16} />
          </button>
        </div>
        {sources?.length > 0 && (
          <button className={`refs-pill ${refs ? 'is-on' : ''}`} aria-expanded={refs} onClick={() => setRefs((r) => !r)}>
            <Icon name="link" size={13} />
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
            <Icon name="chevronDown" size={11} style={{ transform: refs ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
        )}
      </div>
      {refs && (
        <ol className="refs-list reveal">
          {sources.map((s, i) => (
            <li key={s.url}>
              <span className="refs-list__n">{i + 1}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title || s.url}
              </a>
              {s.publisher && <span className="muted">· {s.publisher}</span>}
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

function StockActions({ card, ctx }) {
  const sym = card.quote.symbol
  const short = card.profile.short || sym
  const starred = ctx.watchlist.includes(sym)
  return (
    <div className="action-row reveal" style={{ animationDelay: '80ms' }}>
      <button className={`action-btn ${starred ? 'is-on' : ''}`} onClick={() => ctx.onToggleWatch(sym)} aria-pressed={starred}>
        <Icon name={starred ? 'check' : 'star'} size={16} />
        {starred ? 'In Watchlist' : 'Add to Watchlist'}
      </button>
      <button className="action-btn" onClick={() => ctx.onOpen('simulate', { symbol: sym })}>
        <Icon name="bars" size={16} />
        Simulate
      </button>
      <button className="action-btn" onClick={() => ctx.onSend(`Compare ${sym} with its closest competitors and the S&P 500`)} disabled={ctx.busy}>
        <Icon name="compare" size={16} />
        Compare
      </button>
      <button className="action-btn action-btn--buy" onClick={() => ctx.onOpen('trade', { symbol: sym, side: 'buy' })}>
        <Icon name="briefcase" size={16} />
        Buy {short}
      </button>
    </div>
  )
}

/** Next questions that deepen an analysis without repeating the action row. */
function followUpsFor(card) {
  const sym = card.quote.symbol
  const name = card.profile.short || sym
  return [`What are the biggest risks for ${name} right now?`, `Break down ${name}'s financial health`, `How has ${sym} performed over the last 5 years?`]
}

export function AssistantMessage({ msg, ctx, isLast }) {
  const streaming = msg.status === 'streaming'
  const hasContent = msg.parts?.length > 0
  const stockCard = msg.parts?.find((p) => p.type === 'card' && p.card.type === 'stock')?.card
  const lastIdx = (msg.parts?.length || 0) - 1

  return (
    <div className="msg-ai">
      <ToolTrail tools={msg.tools} streaming={streaming} />
      {!hasContent && streaming && <Thinking line={msg.statusText || 'Thinking'} thinking={msg.thinking} hasTools={msg.tools?.length > 0} />}

      {msg.parts?.map((p, i) =>
        p.type === 'text' ? (
          <Markdown key={i} text={p.text} caret={streaming && i === lastIdx} />
        ) : (
          <ErrorBoundary inline key={p.id + i}>
            <CardPart card={p.card} ctx={ctx} />
          </ErrorBoundary>
        ),
      )}

      {streaming && hasContent && msg.parts[lastIdx].type === 'card' && (
        <p className="thinking__line thinking__line--inline">
          <LogoLoader size={14} />
          {msg.statusText || 'Writing'}
        </p>
      )}

      {msg.status === 'error' && (
        <Notice
          tone="error"
          title="Couldn’t finish this answer"
          action={
            isLast && (
              <button className="btn btn--ghost btn--sm" onClick={ctx.onRetry}>
                <Icon name="refresh" size={14} /> Try again
              </button>
            )
          }
        >
          {msg.error || 'Something went wrong.'}
        </Notice>
      )}
      {msg.status === 'stopped' && (
        <p className="stopped-note">
          <Icon name="stop" size={11} /> Stopped by you
        </p>
      )}

      {(msg.status === 'done' || msg.status === 'stopped') && hasContent && (
        <>
          <Feedback text={textOf(msg)} sources={msg.sources} notify={ctx.notify} />
          {stockCard && <StockActions card={stockCard} ctx={ctx} />}
        </>
      )}
      {msg.status === 'done' && isLast && (msg.chips?.length > 0 || stockCard) && (
        <div className="followups reveal" style={{ animationDelay: '160ms' }}>
          <span className="muted-label">Ask next</span>
          {(msg.chips?.length ? msg.chips : followUpsFor(stockCard)).map((c) => (
            <button key={c} className="followup" onClick={() => ctx.onSend(c)} disabled={ctx.busy}>
              {c}
              <Icon name="arrowUpRight" size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
