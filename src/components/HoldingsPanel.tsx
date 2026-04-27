import { useEffect, useMemo } from 'react'
import { useOrdersStore } from '../store/ordersStore'
import { useTicksStore } from '../store/ticksStore'
import type { Holding } from '../types/kite'

type Props = {
  selectedToken: number | null
  onSelect: (token: number) => void
}

export function HoldingsPanel({ selectedToken, onSelect }: Props) {
  const holdings = useOrdersStore((s) => s.holdings)
  const subscribe = useTicksStore((s) => s.subscribe)
  const ticks = useTicksStore((s) => s.ticks)
  const tickVersion = useTicksStore((s) => s.version)
  void tickVersion

  useEffect(() => {
    const tokenMap = new Map<number, string>()
    for (const holding of holdings) tokenMap.set(holding.instrument_token, holding.exchange)
    if (!tokenMap.size) return
    const tokens = [...tokenMap.keys()]
    const segments: Record<number, string> = {}
    for (const [token, exchange] of tokenMap) segments[token] = exchange
    subscribe(tokens, 'quote', segments)
  }, [holdings, subscribe])

  const liveHoldings = useMemo(
    () => holdings.map((holding) => withLiveHolding(holding, ticks.get(holding.instrument_token)?.lastPrice)),
    [holdings, ticks],
  )

  if (!liveHoldings.length) {
    return <div className="empty-state"><p className="muted">No holdings.</p></div>
  }

  const totals = liveHoldings.reduce(
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
            {liveHoldings.map((holding) => (
              <tr
                key={`${holding.exchange}-${holding.tradingsymbol}`}
                className={selectedToken === holding.instrument_token ? 'active-row' : ''}
                onClick={() => onSelect(holding.instrument_token)}
              >
                <td><strong>{holding.tradingsymbol}</strong> <span className="muted">{holding.exchange}</span></td>
                <td className="number">{holding.quantity}</td>
                <td className="number">{holding.average_price?.toFixed(2)}</td>
                <td className="number">{holding.last_price?.toFixed(2)}</td>
                <td className={`number ${holding.pnl >= 0 ? 'positive' : 'negative'}`}>{holding.pnl?.toFixed(2)}</td>
                <td className={`number ${holding.day_change_percentage >= 0 ? 'positive' : 'negative'}`}>
                  {holding.day_change_percentage?.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
