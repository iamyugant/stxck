import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/shell/TopBar.jsx'
import Icon from './components/Icon.jsx'
import IconRail from './components/shell/IconRail.jsx'
import { AccountButton, MobileDrawer } from './components/shell/Account.jsx'
import { isTyping, MOD } from './lib/keys.js'
import { useAuth } from './lib/auth.jsx'
import { LogoLoader } from './components/ui/States.jsx'
import { OfflineBanner } from './components/ui/Live.jsx'
import { navigate } from './lib/router.js'
import Composer from './components/shell/Composer.jsx'
import PixelField from './components/shell/PixelField.jsx'
import Hero from './components/home/Hero.jsx'
import { AssistantMessage, UserBubble } from './components/chat/Messages.jsx'
import InsightRail from './components/rails/InsightRail.jsx'
import SummaryRail from './components/rails/SummaryRail.jsx'
import { useChat } from './lib/useChat.js'
import { useAccount } from './lib/useAccount.js'
import { getWatchItems } from './lib/market.js'
import { usePersistentState } from './lib/storage.js'

const ScreenerView = lazy(() => import('./components/views/ScreenerView.jsx'))
const ChartsView = lazy(() => import('./components/views/ChartsView.jsx'))
const PortfolioView = lazy(() => import('./components/views/PortfolioView.jsx'))
const HistoryView = lazy(() => import('./components/views/HistoryView.jsx'))
const TradeTicket = lazy(() => import('./components/modals/TradeTicket.jsx'))
const SimulateModal = lazy(() => import('./components/modals/SimulateModal.jsx'))
const AlertModal = lazy(() => import('./components/modals/AlertModal.jsx'))
const SettingsModal = lazy(() => import('./components/modals/SettingsModal.jsx'))
const UpgradeModal = lazy(() => import('./components/modals/InfoModals.jsx').then((m) => ({ default: m.UpgradeModal })))
const CommandPalette = lazy(() => import('./components/shell/CommandPalette.jsx'))
const CookieModal = lazy(() => import('./components/modals/InfoModals.jsx').then((m) => ({ default: m.CookieModal })))

const WIDE = '(min-width: 1200px)'

export default function App() {
  const { user, logout } = useAuth()
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [rawPrefs, setPrefs] = usePersistentState('prefs', { model: 'Stxck 2o', web: true, deep: false })
  // Preferences saved before the rebrand still say "Nerve 2o".
  const prefs = useMemo(() => ({ ...rawPrefs, model: String(rawPrefs.model || 'Stxck 2o').replace(/^Nerve/, 'Stxck') }), [rawPrefs])
  const [view, setView] = useState('chat')
  const [chartSymbol, setChartSymbol] = usePersistentState('chartSymbol', 'NVDA')
  const [railOpen, setRailOpen] = useState(() => window.matchMedia(WIDE).matches)
  const [railChoice, setRailChoice] = useState({ symbol: null, tab: 'insight' })
  const [watchItems, setWatchItems] = useState({})
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [focusKey, setFocusKey] = useState(0)
  const toastTimer = useRef(0)

  const notify = useCallback((text) => {
    clearTimeout(toastTimer.current)
    const tone = /fail|couldn|error|not enough|unavailable|isn.t|blocked|denied/i.test(text)
      ? 'error'
      : /added|saved|bought|sold|set|copied|enabled|updated|changed|deleted|removed|reset|on the|thanks/i.test(text)
        ? 'success'
        : 'info'
    setToast({ text, tone, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const account = useAccount({ notify })
  const { watchlist, portfolio, toggleWatch, addAlert } = account
  const openModal = useCallback((type, props = {}) => setModal({ type, props }), [])

  /* ------------------------------------------------------------------ chat */
  const ctxRef = useRef(null)
  useEffect(() => {
    ctxRef.current = {
      name: user?.name,
      interests: user?.interests || [],
      watchlist,
      portfolio: {
        cash: portfolio.cash,
        positions: Object.entries(portfolio.positions).map(([symbol, p]) => ({ symbol, quantity: p.quantity, avgCost: +p.avgCost.toFixed(2) })),
      },
    }
  }, [watchlist, portfolio, user])
  const getContext = useCallback(() => ctxRef.current, [])

  const onAction = useCallback(
    (a) => {
      if (a.type === 'watch') toggleWatch(a.symbol, true)
      else if (a.type === 'alert') addAlert(a)
      else if (a.type === 'trade') openModal('trade', { symbol: a.symbol, side: a.side, quantity: a.quantity })
    },
    [toggleWatch, addAlert, openModal],
  )

  const settings = useMemo(() => ({ model: prefs.model, web: prefs.web, deep: prefs.deep }), [prefs])
  const chat = useChat({ getContext, onAction, settings })
  const { messages, busy, send } = chat

  const ask = useCallback(
    (text) => {
      if (busy) return notify('Wait for the current answer to finish')
      setView('chat')
      send(text)
      if (!window.matchMedia(WIDE).matches) setRailOpen(false)
    },
    [busy, send, notify],
  )
  const analyze = useCallback((symbol) => ask(`Could you please help me share analysis for ${symbol} this week?`), [ask])

  const newChat = () => {
    chat.newChat()
    setView('chat')
    setAtBottom(true)
    setFocusKey((k) => k + 1)
  }
  const newChatRef = useRef(newChat)
  useEffect(() => {
    newChatRef.current = newChat
  })

  /* ------------------------------------------------------------- watchlist */
  const watchKey = watchlist.join(',')
  useEffect(() => {
    let alive = true
    const loadItems = () => getWatchItems(watchKey ? watchKey.split(',') : []).then((items) => alive && setWatchItems(items))
    loadItems()
    const id = setInterval(loadItems, 60e3)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [watchKey])

  /* ------------------------------------------------------- summary rail */
  const summary = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const card = messages[i].parts?.find((p) => p.type === 'card' && p.card.type === 'stock')?.card
      if (card) return card.profile
    }
    return null
  }, [messages])
  // A new analyzed ticker switches the rail to its Summary until the user picks a tab.
  const summarySymbol = summary?.symbol || null
  const railTab = railChoice.symbol === summarySymbol ? railChoice.tab : summarySymbol ? 'summary' : 'insight'
  const setRailTab = (tab) => setRailChoice({ symbol: summarySymbol, tab })

  /* ------------------------------------------------------------ scrolling */
  const scrollRef = useRef(null)
  const innerRef = useRef(null)
  const stickRef = useRef(true)
  const hasThread = messages.length > 0 && view === 'chat'
  useLayoutEffect(() => {
    const inner = innerRef.current
    const outer = scrollRef.current
    if (!inner || !outer) return
    stickRef.current = true
    outer.scrollTop = outer.scrollHeight
    const ro = new ResizeObserver(() => {
      if (stickRef.current) outer.scrollTop = outer.scrollHeight
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [hasThread, chat.active?.id])
  useEffect(() => {
    if (busy) stickRef.current = true
  }, [busy])

  const onScroll = (e) => {
    const el = e.currentTarget
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stickRef.current = near
    if (near !== atBottom) setAtBottom(near)
  }
  const jumpToLatest = () => {
    const el = scrollRef.current
    if (!el) return
    stickRef.current = true
    setAtBottom(true)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  /* -------------------------------------------------- shortcuts & title */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (e.key === '/' && !isTyping(document.activeElement) && !modal) {
        e.preventDefault()
        setView('chat')
        setFocusKey((k) => k + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  const activeTitle = chat.active?.title
  useEffect(() => {
    const names = { screener: 'Screener', charts: 'Charts', portfolio: 'Portfolio', history: 'History' }
    document.title = view === 'chat' ? (activeTitle ? `${activeTitle} · Stxck` : 'Stxck') : `${names[view]} · Stxck`
  }, [view, activeTitle])

  const paletteActions = useMemo(
    () => [
      { id: 'a-new', icon: 'pencil', label: 'New chat', run: () => newChatRef.current() },
      { id: 'a-screener', icon: 'grid', label: 'Screener', run: () => setView('screener') },
      { id: 'a-charts', icon: 'bars', label: 'Charts', run: () => setView('charts') },
      { id: 'a-portfolio', icon: 'briefcase', label: 'Paper portfolio', keywords: 'positions p&l', run: () => setView('portfolio') },
      { id: 'a-history', icon: 'clock', label: 'Chat history', run: () => setView('history') },
      { id: 'a-trade', icon: 'plus', label: 'New paper trade', keywords: 'buy sell order', run: () => openModal('trade', {}) },
      { id: 'a-sim', icon: 'chart', label: 'Investment simulator', keywords: 'backtest', run: () => openModal('simulate', {}) },
      { id: 'a-rail', icon: 'panel', label: 'Toggle insight panel', run: () => setRailOpen((o) => !o) },
      { id: 'a-settings', icon: 'settings', label: 'Settings', run: () => openModal('settings') },
    ],
    [openModal],
  )

  const msgCtx = {
    watchlist,
    onToggleWatch: toggleWatch,
    onOpen: openModal,
    onSend: ask,
    onRetry: chat.retry,
    notify,
    busy,
  }

  const signOut = async () => {
    chat.stop()
    await logout()
    navigate('/login', { replace: true })
  }
  const onNav = (id) => {
    if (id === 'new') newChat()
    else if (id === 'settings') openModal('settings')
    else setView(id)
  }
  const navActive = view === 'chat' ? (messages.length ? null : 'chat') : view
  const showSummary = railTab === 'summary' && summary

  return (
    <div className="page">
      <OfflineBanner />
      <PixelField className="pixel-field--page" />
      <div className={`app-window ${railOpen ? 'rail-open' : 'rail-closed'}`}>
        <PixelField className="pixel-field--window" cell={10} intensity={0.55} />
        <TopBar
          model={prefs.model}
          onModel={(m) => {
            setPrefs({ ...prefs, model: m })
            notify(`Switched to ${m}`)
          }}
          ai={chat.ai}
          railOpen={railOpen}
          onToggleRail={() => setRailOpen((o) => !o)}
          onUpgrade={() => openModal('upgrade')}
          onHome={newChat}
          notifications={account.notifications}
          onReadAll={() => account.setNotifications((all) => all.map((n) => ({ ...n, read: true })))}
          onClearNotifications={() => account.setNotifications([])}
          onOpenSettings={() => openModal('settings')}
          onOpenDrawer={() => setDrawer(true)}
          onOpenPalette={() => setPalette(true)}
          shortcut={`${MOD} K`}
        />
        <IconRail
          active={navActive}
          onSelect={onNav}
          account={<AccountButton user={user} onSettings={() => openModal('settings')} onUpgrade={() => openModal('upgrade')} onLogout={signOut} />}
        />

        <main className="main" id="main">
          <Suspense fallback={<div className="view-loading"><LogoLoader size={24} label="Loading" /></div>}>
            {view === 'screener' && (
              <div className="view-scroll">
                <ScreenerView
                  watchlist={watchlist}
                  onToggleWatch={toggleWatch}
                  onAnalyze={analyze}
                  onChart={(s) => {
                    setChartSymbol(s)
                    setView('charts')
                  }}
                />
              </div>
            )}
            {view === 'charts' && (
              <div className="view-scroll">
                <ChartsView
                  symbol={chartSymbol}
                  onSymbol={setChartSymbol}
                  watchlist={watchlist}
                  onToggleWatch={toggleWatch}
                  onOpen={openModal}
                  onAnalyze={analyze}
                />
              </div>
            )}
            {view === 'portfolio' && (
              <div className="view-scroll">
                <PortfolioView
                  portfolio={portfolio}
                  onOpen={openModal}
                  onAnalyze={analyze}
                  onReset={account.resetPortfolio}
                  equityHistory={account.equityHistory}
                  onRecordEquity={account.recordEquity}
                  alerts={account.alerts}
                  onRemoveAlert={account.removeAlert}
                />
              </div>
            )}
            {view === 'history' && (
              <div className="view-scroll">
                <HistoryView
                  chats={chat.chats}
                  activeId={chat.active?.id}
                  onOpen={(id) => {
                    chat.openChat(id)
                    setView('chat')
                  }}
                  onDelete={(id) => {
                    chat.deleteChat(id)
                    notify('Conversation deleted')
                  }}
                  onRename={chat.renameChat}
                  onNew={newChat}
                />
              </div>
            )}
          </Suspense>

          {view === 'chat' &&
            (messages.length === 0 ? (
              <div className="main__home">
                <Hero onPrompt={ask} />
              </div>
            ) : (
              <div className="thread" ref={scrollRef} onScroll={onScroll}>
                <div className="thread__inner" ref={innerRef} aria-live="polite">
                  {messages.map((m, i) =>
                    m.role === 'user' ? (
                      <UserBubble key={m.id} msg={m} />
                    ) : (
                      <AssistantMessage key={m.id} msg={m} ctx={msgCtx} isLast={i === messages.length - 1} />
                    ),
                  )}
                </div>
              </div>
            ))}
          {view === 'chat' && messages.length > 0 && !atBottom && (
            <button className="jump-latest" onClick={jumpToLatest}>
              <Icon name="chevronDown" size={14} /> {busy ? 'Streaming' : 'Latest'}
            </button>
          )}
          {view === 'chat' && (
            <Composer
              onSend={(text, files) => {
                stickRef.current = true
                send(text, files)
              }}
              onStop={chat.stop}
              busy={busy}
              deep={prefs.deep}
              onDeep={() => {
                setPrefs({ ...prefs, deep: !prefs.deep })
                notify(prefs.deep ? 'Deep Research off' : 'Deep Research on: slower, more thorough answers')
              }}
              web={prefs.web}
              onWeb={() => {
                setPrefs({ ...prefs, web: !prefs.web })
                notify(prefs.web ? 'Web search off' : 'Web search on')
              }}
              notify={notify}
              onCookies={() => openModal('cookies')}
              focusKey={focusKey}
            />
          )}
        </main>

        <aside className={`rail ${railOpen ? 'is-open' : ''}`} aria-label="Insights">
          <div className="rail__panel" key={showSummary ? `s-${summary.symbol}` : 'insight'}>
            {summary && (
              <div className="rail-tabs" role="tablist">
                <button role="tab" aria-selected={railTab === 'summary'} className={railTab === 'summary' ? 'is-active' : ''} onClick={() => setRailTab('summary')}>
                  {summary.symbol} Summary
                </button>
                <button role="tab" aria-selected={railTab === 'insight'} className={railTab === 'insight' ? 'is-active' : ''} onClick={() => setRailTab('insight')}>
                  Insight
                </button>
              </div>
            )}
            {showSummary ? (
              <SummaryRail profile={summary} onClose={() => setRailOpen(false)} onViewMore={() => ask(`Break down ${summary.short || summary.symbol}'s financial health`)} />
            ) : (
              <InsightRail
                symbols={watchlist}
                items={watchItems}
                onRemove={toggleWatch}
                onOpen={analyze}
                onAdd={(s) => toggleWatch(s, true)}
                onAnalyze={analyze}
                onClose={() => setRailOpen(false)}
              />
            )}
          </div>
        </aside>
        {railOpen && <button className="rail-scrim" aria-label="Close panel" onClick={() => setRailOpen(false)} />}
      </div>

      <MobileDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        user={user}
        active={navActive}
        onNav={onNav}
        chats={chat.chats}
        onOpenChat={(id) => {
          chat.openChat(id)
          setView('chat')
        }}
        onSettings={() => openModal('settings')}
        onLogout={signOut}
      />

      <Suspense fallback={null}>
        {palette && (
          <CommandPalette
            onClose={() => setPalette(false)}
            actions={paletteActions}
            chats={chat.chats}
            onAsk={ask}
            onTicker={(s) => {
              setChartSymbol(s)
              setView('charts')
            }}
            onOpenChat={(id) => {
              chat.openChat(id)
              setView('chat')
            }}
          />
        )}
        {modal?.type === 'trade' && (
          <TradeTicket initial={modal.props} portfolio={portfolio} onExecute={account.executeTrade} onClose={() => setModal(null)} />
        )}
        {modal?.type === 'simulate' && (
          <SimulateModal
            initialSymbol={modal.props.symbol}
            onClose={() => setModal(null)}
            onAsk={(t) => {
              setModal(null)
              ask(t)
            }}
          />
        )}
        {modal?.type === 'alert' && (
          <AlertModal
            symbol={modal.props.symbol}
            price={modal.props.price}
            alerts={account.alerts}
            onAdd={addAlert}
            onRemove={account.removeAlert}
            onClose={() => setModal(null)}
          />
        )}
        {modal?.type === 'settings' && (
          <SettingsModal
            user={user}
            onLogout={signOut}
            ai={chat.ai}
            prefs={prefs}
            setPrefs={setPrefs}
            onClearChats={() => {
              chat.setChats([])
              chat.newChat()
              notify('All chats deleted')
            }}
            onResetPortfolio={account.resetPortfolio}
            onClose={() => setModal(null)}
            notify={notify}
          />
        )}
        {modal?.type === 'upgrade' && <UpgradeModal onClose={() => setModal(null)} notify={notify} />}
        {modal?.type === 'cookies' && <CookieModal onClose={() => setModal(null)} notify={notify} />}
      </Suspense>

      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status" key={toast.id}>
          <Icon name={toast.tone === 'error' ? 'xCircle' : toast.tone === 'success' ? 'checkCircle' : 'info'} size={17} weight="fill" />
          {toast.text}
        </div>
      )}
    </div>
  )
}
