import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './App.css'
import { LoginPanel } from './components/LoginPanel'
import { SymbolSearch } from './components/SymbolSearch'
import { Watchlist } from './components/Watchlist'
import { OrderTicket } from './components/OrderTicket'
import { OrderBook } from './components/OrderBook'
import { MarketDepth } from './components/MarketDepth'
import { useAuthStore } from './store/authStore'
import { useInstrumentsStore } from './store/instrumentsStore'
import { useTicksStore } from './store/ticksStore'
import { useOrdersStore } from './store/ordersStore'

function App() {
  const session = useAuthStore((s) => s.session)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => { bootstrap() }, [bootstrap])

  if (!session) return <LoginPanel />
  return <Terminal />
}

function Terminal() {
  const session = useAuthStore((s) => s.session)!
  const logout = useAuthStore((s) => s.logout)

  const watchlist = useInstrumentsStore((s) => s.watchlist)
  const watchlists = useInstrumentsStore((s) => s.watchlists)
  const activeWatchlistIndex = useInstrumentsStore((s) => s.activeWatchlistIndex)
  const setActiveWatchlist = useInstrumentsStore((s) => s.setActiveWatchlist)
  const loadInstruments = useInstrumentsStore((s) => s.load)
  const loadWatchlistFromStorage = useInstrumentsStore((s) => s.loadWatchlistFromStorage)
  const instrumentsLoaded = useInstrumentsStore((s) => s.loaded)

  const startTicker = useTicksStore((s) => s.start)
  const stopTicker = useTicksStore((s) => s.stop)
  const tickerStatus = useTicksStore((s) => s.status)

  const refreshOrders = useOrdersStore((s) => s.refreshAll)

  const [selectedToken, setSelectedToken] = useState<number | null>(null)
  const [bottomDockHeight, setBottomDockHeight] = useState(148)
  const [textScale, setTextScale] = useState(() => {
    const saved = Number(localStorage.getItem('terminal.textScale'))
    return Number.isFinite(saved) && saved > 0 ? saved : 1
  })
  const activeToken =
    selectedToken != null && watchlist.some((w) => w.instrumentToken === selectedToken)
      ? selectedToken
      : (watchlist[0]?.instrumentToken ?? null)

  useEffect(() => {
    loadWatchlistFromStorage()
    loadInstruments()
    refreshOrders()
  }, [loadWatchlistFromStorage, loadInstruments, refreshOrders])

  useEffect(() => {
    startTicker(session.apiKey, session.accessToken)
    return () => stopTicker()
  }, [session.apiKey, session.accessToken, startTicker, stopTicker])

  useEffect(() => {
    localStorage.setItem('terminal.textScale', textScale.toFixed(2))
  }, [textScale])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      if (!event.metaKey && !event.ctrlKey && !isTextInput) {
        const tab = Number(event.key)
        if (Number.isInteger(tab) && tab >= 1 && tab <= 5) {
          event.preventDefault()
          setActiveWatchlist(tab - 1)
        }
      }

      if (!event.metaKey && !event.ctrlKey) return

      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setTextScale((scale) => Math.min(Number((scale + 0.08).toFixed(2)), 1.6))
        return
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setTextScale((scale) => Math.max(Number((scale - 0.08).toFixed(2)), 0.75))
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        setTextScale(1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveWatchlist])

  const tickerError = useTicksStore((s) => s.error)

  const statusDot = useMemo(() => {
    if (tickerStatus === 'connected') return { color: '#1ab14d', label: 'LIVE' }
    if (tickerStatus === 'connecting')   return { color: '#94a3b8', label: 'CONNECTING' }
    if (tickerStatus === 'reconnecting') return { color: '#94a3b8', label: 'RECONNECTING' }
    if (tickerStatus === 'error')        return { color: '#ef4444', label: 'ERROR' }
    return { color: '#6b7280', label: 'IDLE' }
  }, [tickerStatus])

  const resizeBottomDock = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = bottomDockHeight

    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight - (moveEvent.clientY - startY)
      const maxHeight = Math.max(180, Math.floor(window.innerHeight * 0.48))
      setBottomDockHeight(Math.min(Math.max(nextHeight, 96), maxHeight))
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      document.body.classList.remove('is-resizing-bottom')
    }

    document.body.classList.add('is-resizing-bottom')
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
  }

  const topBarHeight = Math.round(34 * textScale)
  const statusBarHeight = Math.round(24 * textScale)

  const terminalStyle = {
    gridTemplateRows: `${topBarHeight}px minmax(0, 1fr) 7px ${bottomDockHeight}px ${statusBarHeight}px`,
    '--terminal-text-scale': textScale,
  } satisfies CSSProperties & { '--terminal-text-scale': number }

  return (
    <main
      className="terminal-shell"
      style={terminalStyle}
    >
      <section className="classic-filter-strip" aria-label="Market watch filters">
        <div className="inline-search">
          <SymbolSearch />
        </div>
        <div className="account-summary">
          <span
            className={tickerStatus === 'connected' ? 'dot dot-pulse' : 'dot'}
            style={{ background: statusDot.color }}
          />
          <span>{session.userName} · {session.userId}</span>
          {!instrumentsLoaded && <span>Loading instruments...</span>}
          <span>WL {activeWatchlistIndex + 1}: {watchlist.length} watched</span>
          {tickerStatus !== 'connected' && (
            <span className="ticker-status-label">{statusDot.label}</span>
          )}
          {tickerStatus === 'error' && tickerError && (
            <span className="ticker-error-banner">Session expired</span>
          )}
          <button type="button" className="ghost-button compact" onClick={() => logout()}>Logout</button>
        </div>
      </section>

      <section className="workspace">
        <section className="market-panel" aria-label="Market watch">
          <div className="panel-title">
            <span className="panel-icon" aria-hidden="true">▣</span>
            <div>
              <h1>Watchlist {activeWatchlistIndex + 1}</h1>
              <p>Quantity is in Term of NSECDS- Lots - Market Watch</p>
            </div>
            <div className="watchlist-tabs" role="tablist" aria-label="Watchlist tabs">
              {watchlists.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  className={`watchlist-tab ${index === activeWatchlistIndex ? 'active' : ''}`}
                  aria-selected={index === activeWatchlistIndex}
                  onClick={() => setActiveWatchlist(index)}
                  title={`Switch to watchlist ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="window-controls" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
          <Watchlist selectedToken={activeToken} onSelect={setSelectedToken} />
        </section>

        <aside className="right-rail classic-tools" aria-label="Order ticket and depth">
          <OrderTicket token={activeToken} />
          <MarketDepth token={activeToken} />
        </aside>
      </section>

      <div
        className="bottom-resizer"
        role="separator"
        aria-label="Resize bottom section"
        aria-orientation="horizontal"
        onPointerDown={resizeBottomDock}
      />

      <section className="bottom-dock">
        <OrderBook />
      </section>

      <footer className="status-bar">
        <span>{new Date().toLocaleTimeString()}</span>
        <span>·</span>
        <span>Kite Connect v3</span>
        <span>·</span>
        <span>{tickerStatus === 'connected' ? 'streaming' : tickerStatus}</span>
      </footer>
    </main>
  )
}

export default App
