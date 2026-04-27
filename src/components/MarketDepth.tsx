import { useTicksStore } from '../store/ticksStore'
import type { Tick } from '../types/kite'

type Props = { token: number | null }

export function MarketDepth({ token }: Props) {
  // re-render on every tick batch
  const version = useTicksStore((s) => s.version)
  void version
  const tick = token ? useTicksStore.getState().ticks.get(token) : undefined
  return (
    <div className="depth-card">
      <div className="depth-header">
        <span>Bid</span>
        <span>Ask</span>
      </div>
      <div className="depth-grid">
        <DepthSide tick={tick} side="bid" />
        <DepthSide tick={tick} side="ask" />
      </div>
      <div className="depth-totals">
        <span className="positive">Total Buy: {tick?.buyQuantity?.toLocaleString('en-IN') ?? '—'}</span>
        <span className="negative">Total Sell: {tick?.sellQuantity?.toLocaleString('en-IN') ?? '—'}</span>
      </div>
    </div>
  )
}

function DepthSide({ tick, side }: { tick: Tick | undefined; side: 'bid' | 'ask' }) {
  const rows = (side === 'bid' ? tick?.bids : tick?.offers) ?? []
  const filled = rows.length ? rows : Array.from({ length: 5 }, () => ({ price: 0, quantity: 0, orders: 0 }))
  return (
    <div className={`depth-side ${side}`}>
      <table>
        <thead>
          <tr>
            <th>Qty</th>
            <th>Orders</th>
            <th className="right">Price</th>
          </tr>
        </thead>
        <tbody>
          {filled.map((r, i) => (
            <tr key={i}>
              <td>{r.quantity ? r.quantity.toLocaleString('en-IN') : '—'}</td>
              <td>{r.orders || '—'}</td>
              <td className="right">{r.price ? fmt(r.price) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function fmt(v: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}
