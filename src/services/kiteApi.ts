import type {
  Holding,
  Margins,
  Order,
  PlaceOrderParams,
  Position,
} from '../types/kite'

type ApiEnvelope<T> = { status: 'success' | 'error'; data: T; message?: string }

function unwrap<T>(env: ApiEnvelope<T>): T {
  if (env.status !== 'success') throw new Error(env.message || 'Kite API error')
  return env.data
}

export const kiteApi = {
  async profile() {
    const env = await window.kite.request<ApiEnvelope<{ user_id: string; user_name: string; email: string; user_type: string; broker: string; exchanges: string[]; products: string[]; order_types: string[] }>>({
      path: '/user/profile',
    })
    return unwrap(env)
  },

  async margins(segment?: 'equity' | 'commodity') {
    const path = segment ? `/user/margins/${segment}` : '/user/margins'
    const env = await window.kite.request<ApiEnvelope<Margins | { equity: Margins; commodity: Margins }>>({ path })
    return unwrap(env)
  },

  async orders() {
    const env = await window.kite.request<ApiEnvelope<Order[]>>({ path: '/orders' })
    return unwrap(env)
  },

  async orderHistory(orderId: string) {
    const env = await window.kite.request<ApiEnvelope<Order[]>>({ path: `/orders/${orderId}` })
    return unwrap(env)
  },

  async trades() {
    const env = await window.kite.request<ApiEnvelope<unknown[]>>({ path: '/trades' })
    return unwrap(env)
  },

  async placeOrder(p: PlaceOrderParams) {
    const { variety, ...rest } = p
    const env = await window.kite.request<ApiEnvelope<{ order_id: string }>>({
      method: 'POST',
      path: `/orders/${variety}`,
      form: rest as Record<string, unknown>,
    })
    return unwrap(env)
  },

  async modifyOrder(variety: string, orderId: string, fields: Partial<PlaceOrderParams>) {
    const env = await window.kite.request<ApiEnvelope<{ order_id: string }>>({
      method: 'PUT',
      path: `/orders/${variety}/${orderId}`,
      form: fields as Record<string, unknown>,
    })
    return unwrap(env)
  },

  async cancelOrder(variety: string, orderId: string) {
    const env = await window.kite.request<ApiEnvelope<{ order_id: string }>>({
      method: 'DELETE',
      path: `/orders/${variety}/${orderId}`,
    })
    return unwrap(env)
  },

  async holdings() {
    const env = await window.kite.request<ApiEnvelope<Holding[]>>({ path: '/portfolio/holdings' })
    return unwrap(env)
  },

  async positions() {
    const env = await window.kite.request<ApiEnvelope<{ net: Position[]; day: Position[] }>>({
      path: '/portfolio/positions',
    })
    return unwrap(env)
  },

  async ltp(instruments: string[]) {
    const env = await window.kite.request<ApiEnvelope<Record<string, { instrument_token: number; last_price: number }>>>({
      path: '/quote/ltp',
      query: { i: instruments },
    })
    return unwrap(env)
  },

  async ohlc(instruments: string[]) {
    const env = await window.kite.request<ApiEnvelope<Record<string, { instrument_token: number; last_price: number; ohlc: { open: number; high: number; low: number; close: number } }>>>({
      path: '/quote/ohlc',
      query: { i: instruments },
    })
    return unwrap(env)
  },

  async quote(instruments: string[]) {
    const env = await window.kite.request<ApiEnvelope<Record<string, unknown>>>({
      path: '/quote',
      query: { i: instruments },
    })
    return unwrap(env)
  },
}
