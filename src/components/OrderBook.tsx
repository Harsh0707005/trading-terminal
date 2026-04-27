import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useOrdersStore } from '../store/ordersStore'
import { useTicksStore } from '../store/ticksStore'
import type { Holding, Order, Position } from '../types/kite'

type BottomView = 'holdings' | 'positions' | 'orders'

type Props = {
  view: BottomView
  onViewChange: (view: BottomView) => void
  selectedToken: number | null
  onSelectToken: (token: number) => void
}

export function OrderBook({ view, onViewChange, selectedToken, onSelectToken }: Props) {
  const orders = useOrdersStore((s) => s.orders)
  const positions = useOrdersStore((s) => s.positions)
  const holdings = useOrdersStore((s) => s.holdings)
  const refreshAll = useOrdersStore((s) => s.refreshAll)
  const cancelOrder = useOrdersStore((s) => s.cancelOrder)
  const loading = useOrdersStore((s) => s.loading)
  const subscribe = useTicksStore((s) => s.subscribe)
  const ticks = useTicksStore((s) => s.ticks)
  const tickVersion = useTicksStore((s) => s.version)
  void tickVersion
  useEffect(() => {
    refreshAll()
    const id = setInterval(() => refreshAll(), 5000)
    return () => clearInterval(id)
  }, [refreshAll])

  useEffect(() => {
    const tokenMap = new Map<number, string>()
    for (const holding of holdings) tokenMap.set(holding.instrument_token, holding.exchange)
    for (const position of positions.net) tokenMap.set(position.instrument_token, position.exchange)
    if (!tokenMap.size) return
    const tokens = [...tokenMap.keys()]
    const segments: Record<number, string> = {}
    for (const [token, exchange] of tokenMap) segments[token] = exchange
    subscribe(tokens, 'quote', segments)
  }, [holdings, positions.net, subscribe])

  const liveHoldings = useMemo(
    () => holdings.map((holding) => withLiveHolding(holding, ticks.get(holding.instrument_token)?.lastPrice)),
    [holdings, ticks],
  )
  const livePositions = useMemo(
    () => positions.net.map((position) => withLivePosition(position, ticks.get(position.instrument_token)?.lastPrice)),
    [positions.net, ticks],
  )

  return (
    <section className="orderbook">
      <div className="orderbook-top-tabs">
        <button
          type="button"
          className={view === 'holdings' ? 'tab active' : 'tab'}
          onClick={() => onViewChange('holdings')}
        >
          Holdings
        </button>
        <button
          type="button"
          className={view === 'positions' ? 'tab active' : 'tab'}
          onClick={() => onViewChange('positions')}
        >
          Positions <span className="muted">({positions.net.length})</span>
        </button>
        <button
          type="button"
          className={view === 'orders' ? 'tab active' : 'tab'}
          onClick={() => onViewChange('orders')}
        >
          Orders <span className="muted">({orders.length})</span>
        </button>
        <button type="button" className="ghost-button compact" onClick={() => refreshAll()} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {view === 'holdings' ? (
        <div className="orders-single">
          <BottomPanel title="Holdings" count={holdings.length}>
            <HoldingsTable holdings={liveHoldings} selectedToken={selectedToken} onSelectToken={onSelectToken} />
          </BottomPanel>
        </div>
      ) : view === 'positions' ? (
        <div className="orders-single">
          <BottomPanel title="Positions" count={positions.net?.length ?? 0}>
            <PositionsTable positions={livePositions} selectedToken={selectedToken} onSelectToken={onSelectToken} />
          </BottomPanel>
        </div>
      ) : (
        <div className="orders-single">
          <BottomPanel title="Orders" count={orders.length}>
            <OrdersTable
              orders={orders}
              selectedToken={selectedToken}
              onSelectToken={onSelectToken}
              onCancel={cancelOrder}
            />
          </BottomPanel>
        </div>
      )}
    </section>
  )
}

function BottomPanel({
  title,
  count,
  action,
  children,
}: {
  title: string
  count: number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bottom-panel">
      <div className="bottom-panel-title">
        <span>{title}</span>
        <span className="muted">({count})</span>
        {action}
      </div>
      {children}
    </section>
  )
}

function OrdersTable({
  orders,
  selectedToken,
  onSelectToken,
  onCancel,
}: {
  orders: Order[]
  selectedToken: number | null
  onSelectToken: (token: number) => void
  onCancel: (variety: string, id: string) => void
}) {
  if (!orders.length) return <p className="empty-state muted">No orders for the day.</p>
  const sortedOrders = [...orders].sort((a, b) => {
    const aTs = toEpochMs(a.order_timestamp ?? a.exchange_timestamp)
    const bTs = toEpochMs(b.order_timestamp ?? b.exchange_timestamp)
    if (aTs !== bTs) return bTs - aTs
    return b.order_id.localeCompare(a.order_id)
  })

  return (
    <div className="market-table-wrap">
      <table className="market-table compact">
        <thead>
          <tr>
            <th>Time</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Type</th>
            <th>Product</th>
            <th className="number">Qty</th>
            <th className="number">Filled</th>
            <th className="number">Price</th>
            <th className="number">Avg</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedOrders.map((o) => (
            <tr
              key={o.order_id}
              className={selectedToken === o.instrument_token ? 'active-row' : ''}
              onClick={() => onSelectToken(o.instrument_token)}
            >
              <td>{o.order_timestamp?.slice(11, 19) ?? '—'}</td>
              <td><strong>{o.tradingsymbol}</strong> <span className="muted">{o.exchange}</span></td>
              <td className={o.transaction_type === 'BUY' ? 'positive' : 'negative'}>{o.transaction_type}</td>
              <td>{o.order_type}</td>
              <td>{o.product}</td>
              <td className="number">{o.quantity}</td>
              <td className="number">{o.filled_quantity}</td>
              <td className="number">{o.price?.toFixed(2)}</td>
              <td className="number">{o.average_price?.toFixed(2)}</td>
              <td><span className={`status-pill status-${o.status?.toLowerCase()}`}>{o.status}</span></td>
              <td>
                {(o.status === 'OPEN' || o.status === 'TRIGGER PENDING') && (
                  <button type="button" className="row-action" onClick={() => onCancel(o.variety, o.order_id)}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function toEpochMs(value: string | null | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  if (!Number.isNaN(ts)) return ts
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const fallback = Date.parse(normalized)
  return Number.isNaN(fallback) ? 0 : fallback
}

function PositionsTable({
  positions,
  selectedToken,
  onSelectToken,
}: {
  positions: Position[]
  selectedToken: number | null
  onSelectToken: (token: number) => void
}) {
  const totals = positions.reduce(
    (acc, position) => ({
      quantity: acc.quantity + (position.quantity || 0),
      pnl: acc.pnl + (position.pnl || 0),
    }),
    { quantity: 0, pnl: 0 },
  )

  return (
    <div className="portfolio-table-stack">
      <div className="market-table-wrap">
        {!positions.length ? (
          <p className="empty-state muted">No open positions.</p>
        ) : (
          <table className="market-table compact portfolio-tight-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Product</th>
                <th className="number">Qty</th>
                <th className="number">Avg</th>
                <th className="number">LTP</th>
                <th className="number">P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr
                  key={`${p.exchange}-${p.tradingsymbol}-${p.product}`}
                  className={selectedToken === p.instrument_token ? 'active-row' : ''}
                  onClick={() => onSelectToken(p.instrument_token)}
                >
                  <td><strong>{p.tradingsymbol}</strong> <span className="muted">{p.exchange}</span></td>
                  <td>{p.product}</td>
                  <td className="number">{p.quantity}</td>
                  <td className="number">{p.average_price?.toFixed(2)}</td>
                  <td className="number">{p.last_price?.toFixed(2)}</td>
                  <td className={`number ${p.pnl >= 0 ? 'positive' : 'negative'}`}>{p.pnl?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="panel-total-bar">
        <span>Total</span>
        <span>Qty: {totals.quantity}</span>
        <span className={totals.pnl >= 0 ? 'positive' : 'negative'}>P&L: {formatMoney(totals.pnl)}</span>
      </div>
    </div>
  )
}

function HoldingsTable({
  holdings,
  selectedToken,
  onSelectToken,
}: {
  holdings: Holding[]
  selectedToken: number | null
  onSelectToken: (token: number) => void
}) {
  const totals = holdings.reduce(
    (acc, holding) => ({
      quantity: acc.quantity + (holding.quantity || 0),
      value: acc.value + (holding.quantity || 0) * (holding.last_price || 0),
      pnl: acc.pnl + (holding.pnl || 0),
    }),
    { quantity: 0, value: 0, pnl: 0 },
  )

  return (
    <div className="portfolio-table-stack">
      <div className="market-table-wrap">
        {!holdings.length ? (
          <p className="empty-state muted">No holdings.</p>
        ) : (
          <table className="market-table compact portfolio-tight-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="number">Qty</th>
                <th className="number">Avg</th>
                <th className="number">LTP</th>
                <th className="number">P&L</th>
                <th className="number">Day %</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr
                  key={`${h.exchange}-${h.tradingsymbol}`}
                  className={selectedToken === h.instrument_token ? 'active-row' : ''}
                  onClick={() => onSelectToken(h.instrument_token)}
                >
                  <td><strong>{h.tradingsymbol}</strong> <span className="muted">{h.exchange}</span></td>
                  <td className="number">{h.quantity}</td>
                  <td className="number">{h.average_price?.toFixed(2)}</td>
                  <td className="number">{h.last_price?.toFixed(2)}</td>
                  <td className={`number ${h.pnl >= 0 ? 'positive' : 'negative'}`}>{h.pnl?.toFixed(2)}</td>
                  <td className={`number ${h.day_change_percentage >= 0 ? 'positive' : 'negative'}`}>{h.day_change_percentage?.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="panel-total-bar">
        <span>Total</span>
        <span>Qty: {totals.quantity}</span>
        <span>Value: {formatMoney(totals.value)}</span>
        <span className={totals.pnl >= 0 ? 'positive' : 'negative'}>P&L: {formatMoney(totals.pnl)}</span>
      </div>
    </div>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function withLiveHolding(holding: Holding, livePrice?: number): Holding {
  if (livePrice == null || Number.isNaN(livePrice)) return holding
  const close = holding.close_price || 0
  const pnl = (livePrice - holding.average_price) * holding.quantity
  const dayChange = livePrice - close
  const dayChangePercentage = close > 0 ? (dayChange / close) * 100 : 0
  return {
    ...holding,
    last_price: livePrice,
    pnl,
    day_change: dayChange,
    day_change_percentage: dayChangePercentage,
  }
}

function withLivePosition(position: Position, livePrice?: number): Position {
  if (livePrice == null || Number.isNaN(livePrice)) return position
  const multiplier = position.multiplier || 1
  const unrealised = (livePrice - position.average_price) * position.quantity * multiplier
  const realised = position.realised || 0
  return {
    ...position,
    last_price: livePrice,
    unrealised,
    pnl: realised + unrealised,
  }
}
