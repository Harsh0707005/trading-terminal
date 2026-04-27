import { useEffect } from 'react'
import { useInstrumentsStore } from '../store/instrumentsStore'
import { useTicksStore } from '../store/ticksStore'
import type { Tick } from '../types/kite'

type Props = {
  selectedToken: number | null
  onSelect: (token: number) => void
}

export function Watchlist({ selectedToken, onSelect }: Props) {
  const watchlist = useInstrumentsStore((s) => s.watchlist)
  const removeFromWatchlist = useInstrumentsStore((s) => s.removeFromWatchlist)
  const subscribe = useTicksStore((s) => s.subscribe)
  const unsubscribe = useTicksStore((s) => s.unsubscribe)
  const ticks = useTicksStore((s) => s.ticks)
  const version = useTicksStore((s) => s.version)
  void version
  const status = useTicksStore((s) => s.status)

  useEffect(() => {
    if (status !== 'connected' && status !== 'reconnecting') return
    if (!watchlist.length) return
    const tokens = watchlist.map((w) => w.instrumentToken)
    const segments: Record<number, string> = {}
    for (const w of watchlist) segments[w.instrumentToken] = w.segment
    // Buy/Sell price and qty require full mode depth packets.
    subscribe(tokens, 'full', segments)
    return () => {
      // do not unsubscribe on every render — only on token list change
    }
  }, [watchlist, selectedToken, status, subscribe])

  if (!watchlist.length) {
    return (
      <div className="empty-state">
        <p>No instruments yet.</p>
        <p className="muted">Use the search above to add symbols. Live ticks start automatically.</p>
      </div>
    )
  }

  return (
    <div className="market-table-wrap">
      <table className="market-table">
        <thead>
          <tr>
            <th>Exchange</th>
            <th>Symbol</th>
            <th>Ser/Exp</th>
            <th className="number">Buy Qty</th>
            <th className="number">Buy Price</th>
            <th className="number">Sell Price</th>
            <th className="number">Sell Qty</th>
            <th className="number">High</th>
            <th className="number">Low</th>
            <th className="number">Open</th>
            <th className="number">Close</th>
            <th className="number">% Change</th>
            <th className="number">Last Traded Price</th>
            <th className="number">Volume</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {watchlist.map((w) => {
            const tick = ticks.get(w.instrumentToken)
            const change = computeChange(tick)
            const bid = tick?.bids?.[0]
            const ask = tick?.offers?.[0]
            return (
              <tr
                key={w.instrumentToken}
                className={selectedToken === w.instrumentToken ? 'active-row' : ''}
                onClick={() => onSelect(w.instrumentToken)}
              >
                <td>{w.exchange}</td>
                <td className="symbol-cell"><strong>{w.tradingsymbol}</strong></td>
                <td>{seriesLabel(w.segment, w.tradingsymbol)}</td>
                <td className="number highlight-buy">{bid?.quantity?.toLocaleString('en-IN') ?? '—'}</td>
                <td className="number">{fmt(bid?.price)}</td>
                <td className="number highlight-sell">{fmt(ask?.price)}</td>
                <td className="number">{ask?.quantity?.toLocaleString('en-IN') ?? '—'}</td>
                <td className="number">{fmt(tick?.high)}</td>
                <td className="number">{fmt(tick?.low)}</td>
                <td className="number">{fmt(tick?.open)}</td>
                <td className="number">{fmt(tick?.close)}</td>
                <td className={`number ${change >= 0 ? 'positive' : 'negative'}`}>
                  {tick?.lastPrice != null ? change.toFixed(2) : '—'}
                </td>
                <td className="number last-price">{fmt(tick?.lastPrice)}</td>
                <td className="number">{tick?.volume?.toLocaleString('en-IN') ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    className="row-action"
                    title="Remove"
                    onClick={(e) => { e.stopPropagation(); unsubscribe([w.instrumentToken]); removeFromWatchlist(w.instrumentToken) }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {status !== 'connected' && <p className="status-line muted">Ticker: {status}</p>}
    </div>
  )
}

function computeChange(tick: Tick | undefined): number {
  if (!tick || tick.lastPrice == null || !tick.close) return 0
  return ((tick.lastPrice - tick.close) / tick.close) * 100
}

function fmt(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function seriesLabel(segment: string, symbol: string): string {
  if (segment === 'NSE' || segment === 'BSE') return 'EQ'
  const compactExpiry = symbol.match(/\d{2}[A-Z]{3}\d{2}/)?.[0]
  return compactExpiry ?? segment
}
