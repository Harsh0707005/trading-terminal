import { useMemo } from 'react'
import { useOrdersStore } from '../store/ordersStore'

type Props = {
  selectedToken: number | null
  onSelect: (token: number) => void
}

export function OrdersPanel({ selectedToken, onSelect }: Props) {
  const orders = useOrdersStore((s) => s.orders)
  const cancelOrder = useOrdersStore((s) => s.cancelOrder)

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const aTs = toEpochMs(a.order_timestamp ?? a.exchange_timestamp)
        const bTs = toEpochMs(b.order_timestamp ?? b.exchange_timestamp)
        if (aTs !== bTs) return bTs - aTs
        return b.order_id.localeCompare(a.order_id)
      }),
    [orders],
  )

  if (!sortedOrders.length) {
    return <div className="empty-state"><p className="muted">No orders for the day.</p></div>
  }

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
          {sortedOrders.map((order) => (
            <tr
              key={order.order_id}
              className={selectedToken === order.instrument_token ? 'active-row' : ''}
              onClick={() => onSelect(order.instrument_token)}
            >
              <td>{order.order_timestamp?.slice(11, 19) ?? '—'}</td>
              <td><strong>{order.tradingsymbol}</strong> <span className="muted">{order.exchange}</span></td>
              <td className={order.transaction_type === 'BUY' ? 'positive' : 'negative'}>{order.transaction_type}</td>
              <td>{order.order_type}</td>
              <td>{order.product}</td>
              <td className="number">{order.quantity}</td>
              <td className="number">{order.filled_quantity}</td>
              <td className="number">{order.price?.toFixed(2)}</td>
              <td className="number">{order.average_price?.toFixed(2)}</td>
              <td><span className={`status-pill status-${order.status?.toLowerCase()}`}>{order.status}</span></td>
              <td>
                {(order.status === 'OPEN' || order.status === 'TRIGGER PENDING') && (
                  <button
                    type="button"
                    className="row-action"
                    onClick={(event) => {
                      event.stopPropagation()
                      void cancelOrder(order.variety, order.order_id)
                    }}
                  >
                    Cancel
                  </button>
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
