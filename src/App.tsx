import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import './App.css'
import { LoginPanel } from './components/LoginPanel'
import { SymbolSearch } from './components/SymbolSearch'
import { Watchlist } from './components/Watchlist'
import { StocksDirectory } from './components/StocksDirectory'
import { OrdersPanel } from './components/OrdersPanel'
import { PositionsPanel } from './components/PositionsPanel'
import { HoldingsPanel } from './components/HoldingsPanel'
import { OrderTicket } from './components/OrderTicket'
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
  const byToken = useInstrumentsStore((s) => s.byToken)
  const activeWatchlistIndex = useInstrumentsStore((s) => s.activeWatchlistIndex)
  const setActiveWatchlist = useInstrumentsStore((s) => s.setActiveWatchlist)
  const loadInstruments = useInstrumentsStore((s) => s.load)
  const loadWatchlistFromStorage = useInstrumentsStore((s) => s.loadWatchlistFromStorage)
  const instrumentsLoaded = useInstrumentsStore((s) => s.loaded)

  const startTicker = useTicksStore((s) => s.start)
  const stopTicker = useTicksStore((s) => s.stop)
  const subscribeTicks = useTicksStore((s) => s.subscribe)
  const tickerStatus = useTicksStore((s) => s.status)

  const refreshOrders = useOrdersStore((s) => s.refreshAll)

  const [selectedToken, setSelectedToken] = useState<number | null>(null)
  const [marketView, setMarketView] = useState<'watchlist' | 'stocks' | 'orders' | 'positions' | 'holdings'>('watchlist')
  const [detailsVisible, setDetailsVisible] = useState(false)
  const [textScale, setTextScale] = useState(() => {
    const saved = Number(localStorage.getItem('terminal.textScale'))
    return Number.isFinite(saved) && saved > 0 ? saved : 1
  })
  const activeToken = selectedToken ?? (watchlist[0]?.instrumentToken ?? null)

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
    if (tickerStatus !== 'connected' && tickerStatus !== 'reconnecting') return
    const tokenMap = new Map<number, string>()
    for (const list of watchlists) {
      for (const item of list) tokenMap.set(item.instrumentToken, item.segment)
    }
    if (!tokenMap.size) return
    const tokens = [...tokenMap.keys()]
    const segments: Record<number, string> = {}
    for (const [token, segment] of tokenMap) segments[token] = segment
    subscribeTicks(tokens, 'full', segments)
  }, [watchlists, tickerStatus, subscribeTicks])

  useEffect(() => {
    if (!activeToken) return
    if (tickerStatus !== 'connected' && tickerStatus !== 'reconnecting') return
    const segment = byToken.get(activeToken)?.segment
    subscribeTicks([activeToken], 'full', segment ? { [activeToken]: segment } : undefined)
  }, [activeToken, byToken, subscribeTicks, tickerStatus])

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
      if (event.key === 'F1') {
        event.preventDefault()
        if (!activeToken) return
        setDetailsVisible((visible) => !visible)
        return
      }
      if (event.key === 'F2') {
        event.preventDefault()
        setMarketView('orders')
        return
      }
      if (event.key === 'F3') {
        event.preventDefault()
        setMarketView('positions')
        return
      }
      if (event.key === 'F4') {
        event.preventDefault()
        setMarketView('holdings')
        return
      }
      if (event.key === 'F5') {
        event.preventDefault()
        setMarketView('stocks')
        return
      }
      if (event.key === 'Escape') {
        if (detailsVisible) {
          event.preventDefault()
          setDetailsVisible(false)
          return
        }
        if (
          marketView === 'stocks' ||
          marketView === 'orders' ||
          marketView === 'positions' ||
          marketView === 'holdings'
        ) {
          event.preventDefault()
          setMarketView('watchlist')
          return
        }
      }
      if (!event.metaKey && !event.ctrlKey && !isTextInput) {
        const tab = Number(event.key)
        if (Number.isInteger(tab) && tab >= 1 && tab <= 5) {
          event.preventDefault()
          setActiveWatchlist(tab - 1)
          return
        }
        if (event.key.length === 1 && /[a-z]/i.test(event.key) && !event.altKey) {
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('terminal:quick-search', { detail: { key: event.key } }))
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
  }, [activeToken, detailsVisible, marketView, setActiveWatchlist])

  const tickerError = useTicksStore((s) => s.error)

  const statusDot = useMemo(() => {
    if (tickerStatus === 'connected') return { color: '#1ab14d', label: 'LIVE' }
    if (tickerStatus === 'connecting')   return { color: '#94a3b8', label: 'CONNECTING' }
    if (tickerStatus === 'reconnecting') return { color: '#94a3b8', label: 'RECONNECTING' }
    if (tickerStatus === 'error')        return { color: '#ef4444', label: 'ERROR' }
    return { color: '#6b7280', label: 'IDLE' }
  }, [tickerStatus])

  const topBarHeight = Math.round(34 * textScale)
  const statusBarHeight = Math.round(24 * textScale)

  const terminalStyle = {
    gridTemplateRows: `${topBarHeight}px minmax(0, 1fr) ${statusBarHeight}px`,
    '--terminal-text-scale': textScale,
  } satisfies CSSProperties & { '--terminal-text-scale': number }
  const workspaceStyle = {
    gridTemplateColumns: 'minmax(0, 1fr)',
  } satisfies CSSProperties

  return (
    <main
      className="terminal-shell"
      style={terminalStyle}
    >
      <section className="classic-filter-strip" aria-label="Market watch filters">
        <div className="inline-search">
          <div className="search-and-view-toggle">
            <SymbolSearch />
          </div>
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

      <section className="workspace" style={workspaceStyle}>
        <section className="market-panel" aria-label="Market watch">
          <div className="panel-title">
            <span className="panel-icon" aria-hidden="true">▣</span>
            <div>
              <h1>
                {marketView === 'watchlist'
                  ? `Watchlist ${activeWatchlistIndex + 1}`
                  : marketView === 'stocks'
                    ? 'Stocks'
                    : marketView === 'orders'
                      ? 'Orders'
                      : marketView === 'positions'
                        ? 'Positions'
                        : 'Holdings'}
              </h1>
              <p>
                {marketView === 'watchlist'
                  ? 'Quantity is in Term of NSECDS- Lots - Market Watch'
                  : marketView === 'stocks'
                    ? 'All instruments grouped alphabetically'
                    : marketView === 'orders'
                      ? 'All orders for current session'
                      : marketView === 'positions'
                        ? 'All current open positions'
                        : 'All holdings in your account'}
              </p>
            </div>
            {marketView === 'watchlist' && (
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
            )}
            <div className="window-controls" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
          {marketView === 'watchlist' ? (
            <Watchlist selectedToken={activeToken} onSelect={setSelectedToken} />
          ) : marketView === 'stocks' ? (
            <StocksDirectory selectedToken={activeToken} onSelect={setSelectedToken} />
          ) : marketView === 'positions' ? (
            <PositionsPanel selectedToken={activeToken} onSelect={setSelectedToken} />
          ) : marketView === 'holdings' ? (
            <HoldingsPanel selectedToken={activeToken} onSelect={setSelectedToken} />
          ) : (
            <OrdersPanel selectedToken={activeToken} onSelect={setSelectedToken} />
          )}
        </section>

      </section>

      {detailsVisible && activeToken && (
        <div
          className="details-modal-backdrop"
          role="button"
          tabIndex={-1}
          aria-label="Close details"
          onClick={() => setDetailsVisible(false)}
        >
          <aside
            className="details-modal"
            aria-label="Order ticket and depth"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="details-modal-head">
              <strong>Instrument Details</strong>
              <button
                type="button"
                className="ghost-button compact"
                onClick={() => setDetailsVisible(false)}
              >
                Close
              </button>
            </div>
            <div className="details-modal-body">
              <OrderTicket token={activeToken} />
              <MarketDepth token={activeToken} />
            </div>
          </aside>
        </div>
      )}

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
