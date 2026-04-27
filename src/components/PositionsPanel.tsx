import { useEffect, useMemo } from 'react'
import { useOrdersStore } from '../store/ordersStore'
import { useTicksStore } from '../store/ticksStore'
import type { Position } from '../types/kite'

type Props = {
  selectedToken: number | null
  onSelect: (token: number) => void
}

export function PositionsPanel({ selectedToken, onSelect }: Props) {
  const positions = useOrdersStore((s) => s.positions)
  const subscribe = useTicksStore((s) => s.subscribe)
  const ticks = useTicksStore((s) => s.ticks)
  const tickVersion = useTicksStore((s) => s.version)
  void tickVersion

  useEffect(() => {
    const tokenMap = new Map<number, string>()
    for (const position of positions.net) tokenMap.set(position.instrument_token, position.exchange)
    if (!tokenMap.size) return
    const tokens = [...tokenMap.keys()]
    const segments: Record<number, string> = {}
    for (const [token, exchange] of tokenMap) segments[token] = exchange
    subscribe(tokens, 'quote', segments)
  }, [positions.net, subscribe])

  const livePositions = useMemo(
    () => positions.net.map((position) => withLivePosition(position, ticks.get(position.instrument_token)?.lastPrice)),
    [positions.net, ticks],
  )

  if (!livePositions.length) {
    return <div className="empty-state"><p className="muted">No open positions.</p></div>
  }

  const totals = livePositions.reduce(
    (acc, position) => ({
      quantity: acc.quantity + (position.quantity || 0),
      pnl: acc.pnl + (position.pnl || 0),
    }),
    { quantity: 0, pnl: 0 },
  )

  return (
    <div className="portfolio-table-stack">
      <div className="market-table-wrap">
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
            {livePositions.map((position) => (
              <tr
                key={`${position.exchange}-${position.tradingsymbol}-${position.product}`}
                className={selectedToken === position.instrument_token ? 'active-row' : ''}
                onClick={() => onSelect(position.instrument_token)}
              >
                <td><strong>{position.tradingsymbol}</strong> <span className="muted">{position.exchange}</span></td>
                <td>{position.product}</td>
                <td className="number">{position.quantity}</td>
                <td className="number">{position.average_price?.toFixed(2)}</td>
                <td className="number">{position.last_price?.toFixed(2)}</td>
                <td className={`number ${position.pnl >= 0 ? 'positive' : 'negative'}`}>{position.pnl?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-total-bar">
        <span>Total</span>
        <span>Qty: {totals.quantity}</span>
        <span className={totals.pnl >= 0 ? 'positive' : 'negative'}>P&L: {formatMoney(totals.pnl)}</span>
      </div>
    </div>
  )
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

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
