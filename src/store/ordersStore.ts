import { create } from 'zustand'
import { kiteApi } from '../services/kiteApi'
import type { Holding, Order, PlaceOrderParams, Position } from '../types/kite'

type OrdersState = {
  orders: Order[]
  positions: { net: Position[]; day: Position[] }
  holdings: Holding[]
  loading: boolean
  error: string | null
  lastPlacedId: string | null
  refreshOrders: () => Promise<void>
  refreshPositions: () => Promise<void>
  refreshHoldings: () => Promise<void>
  refreshAll: () => Promise<void>
  placeOrder: (p: PlaceOrderParams) => Promise<string | null>
  cancelOrder: (variety: string, orderId: string) => Promise<void>
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  positions: { net: [], day: [] },
  holdings: [],
  loading: false,
  error: null,
  lastPlacedId: null,
  refreshOrders: async () => {
    try { set({ orders: await kiteApi.orders() }) } catch (e) { set({ error: (e as Error).message }) }
  },
  refreshPositions: async () => {
    try { set({ positions: await kiteApi.positions() }) } catch (e) { set({ error: (e as Error).message }) }
  },
  refreshHoldings: async () => {
    try { set({ holdings: await kiteApi.holdings() }) } catch (e) { set({ error: (e as Error).message }) }
  },
  refreshAll: async () => {
    set({ loading: true, error: null })
    await Promise.all([get().refreshOrders(), get().refreshPositions(), get().refreshHoldings()])
    set({ loading: false })
  },
  placeOrder: async (p) => {
    set({ error: null })
    try {
      const { order_id } = await kiteApi.placeOrder(p)
      set({ lastPlacedId: order_id })
      get().refreshOrders()
      return order_id
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },
  cancelOrder: async (variety, orderId) => {
    try {
      await kiteApi.cancelOrder(variety, orderId)
      get().refreshOrders()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },
}))
