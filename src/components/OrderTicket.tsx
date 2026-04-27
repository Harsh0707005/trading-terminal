import { useEffect, useMemo, useRef, useState } from 'react'
import { useTicksStore } from '../store/ticksStore'
import { useInstrumentsStore } from '../store/instrumentsStore'
import { useOrdersStore } from '../store/ordersStore'
import type { OrderType, Product, TransactionType, Validity, Variety } from '../types/kite'

type Props = { token: number | null }

export function OrderTicket({ token }: Props) {
  const version = useTicksStore((s) => s.version)
  void version
  const watchlist = useInstrumentsStore((s) => s.watchlist)
  const placeOrder = useOrdersStore((s) => s.placeOrder)
  const lastPlacedId = useOrdersStore((s) => s.lastPlacedId)
  const orderError = useOrdersStore((s) => s.error)

  const entry = useMemo(() => watchlist.find((w) => w.instrumentToken === token), [watchlist, token])
  const tick = token ? useTicksStore.getState().ticks.get(token) : undefined

  const [side, setSide] = useState<TransactionType | null>(null)
  const [orderType, setOrderType] = useState<OrderType>('LIMIT')
  const [product, setProduct] = useState<Product>('MIS')
  const [validity, setValidity] = useState<Validity>('DAY')
  const [variety, setVariety] = useState<Variety>('regular')
  const [quantity, setQuantity] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  const [triggerPrice, setTriggerPrice] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const lastTokenRef = useRef<number | null>(null)

  useEffect(() => {
    if (!token) {
      lastTokenRef.current = null
      return
    }
    if (lastTokenRef.current === token) return
    lastTokenRef.current = token
    setPrice(tick?.lastPrice != null ? tick.lastPrice.toFixed(2) : '')
    setTriggerPrice('')
    setConfirmation(null)
  }, [token, tick?.lastPrice])

  if (!entry || !token) {
    return <div className="empty-state"><p className="muted">Select an instrument to place orders.</p></div>
  }

  const quantityValue = quantity || String(entry.lotSize || 1)
  const priceValue = price || (tick?.lastPrice ? tick.lastPrice.toFixed(2) : '')

  const submit = async (transaction: TransactionType) => {
    setSubmitting(true)
    setConfirmation(null)
    const id = await placeOrder({
      variety,
      tradingsymbol: entry.tradingsymbol,
      exchange: entry.exchange as 'NSE',
      transaction_type: transaction,
      order_type: orderType,
      quantity: Number(quantityValue),
      product,
      validity,
      price: orderType === 'LIMIT' || orderType === 'SL' ? Number(priceValue) : undefined,
      trigger_price: orderType === 'SL' || orderType === 'SL-M' ? Number(triggerPrice) : undefined,
    })
    setSubmitting(false)
    if (id) setConfirmation(`Order placed: ${id}`)
  }

  return (
    <div className="ticket-card">
      <div className="ticket-header">
        <span>{entry.exchange}</span>
        <strong>{entry.tradingsymbol}</strong>
        <span className={`pill ${side === 'BUY' ? 'buy' : side === 'SELL' ? 'sell' : 'neutral'}`}>
          {side ?? 'SELECT SIDE'}
        </span>
      </div>
      <div className="price-card">
        <small>Last Traded Price</small>
        <strong>{tick?.lastPrice ? tick.lastPrice.toFixed(2) : '—'}</strong>
        <span className="muted">Bid {tick?.bids?.[0]?.price?.toFixed(2) ?? '—'} · Ask {tick?.offers?.[0]?.price?.toFixed(2) ?? '—'}</span>
      </div>

      <div className="side-toggle">
        <button
          type="button"
          className={side === 'BUY' ? 'buy-button active' : 'buy-button inactive-side'}
          aria-pressed={side === 'BUY'}
          onClick={() => setSide('BUY')}
        >
          BUY
        </button>
        <button
          type="button"
          className={side === 'SELL' ? 'sell-button active' : 'sell-button inactive-side'}
          aria-pressed={side === 'SELL'}
          onClick={() => setSide('SELL')}
        >
          SELL
        </button>
      </div>

      <div className="form-grid">
        <label>
          Variety
          <select value={variety} onChange={(e) => setVariety(e.target.value as Variety)}>
            <option value="regular">REGULAR</option>
            <option value="amo">AMO</option>
            <option value="co">COVER</option>
            <option value="iceberg">ICEBERG</option>
          </select>
        </label>
        <label>
          Order Type
          <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)}>
            <option value="LIMIT">LIMIT</option>
            <option value="MARKET">MARKET</option>
            <option value="SL">SL</option>
            <option value="SL-M">SL-M</option>
          </select>
        </label>
        <label>
          Product
          <select value={product} onChange={(e) => setProduct(e.target.value as Product)}>
            <option value="MIS">MIS</option>
            <option value="CNC">CNC</option>
            <option value="NRML">NRML</option>
            <option value="MTF">MTF</option>
          </select>
        </label>
        <label>
          Validity
          <select value={validity} onChange={(e) => setValidity(e.target.value as Validity)}>
            <option value="DAY">DAY</option>
            <option value="IOC">IOC</option>
            <option value="TTL">TTL</option>
          </select>
        </label>
        <label>
          Quantity
          <input value={quantityValue} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </label>
        <label>
          Price
          <input
            value={priceValue}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            disabled={orderType === 'MARKET' || orderType === 'SL-M'}
          />
        </label>
        {(orderType === 'SL' || orderType === 'SL-M') && (
          <label>
            Trigger Price
            <input value={triggerPrice} onChange={(e) => setTriggerPrice(e.target.value)} inputMode="decimal" />
          </label>
        )}
      </div>

      <div className="ticket-actions">
        <button
          type="button"
          className={side === 'BUY' ? 'buy-button active-action' : 'buy-button inactive-action'}
          disabled={submitting || side !== 'BUY'}
          onClick={() => submit('BUY')}
        >{submitting ? '…' : `Buy ${quantityValue}`}</button>
        <button
          type="button"
          className={side === 'SELL' ? 'sell-button active-action' : 'sell-button inactive-action'}
          disabled={submitting || side !== 'SELL'}
          onClick={() => submit('SELL')}
        >{submitting ? '…' : `Sell ${quantityValue}`}</button>
      </div>

      {confirmation && <p className="ok-line">{confirmation}</p>}
      {orderError && <p className="login-error">{orderError}</p>}
      {lastPlacedId && !confirmation && <p className="muted">Last order id: {lastPlacedId}</p>}
    </div>
  )
}
