import { create } from 'zustand'
import { KiteTicker, type TickerStatus } from '../services/kiteTicker'
import type { Tick } from '../types/kite'
import { useAuthStore } from './authStore'

type TicksState = {
  ticker: KiteTicker | null
  status: TickerStatus
  error: string | null
  ticks: Map<number, Tick>
  // bumped on every tick batch so subscribers re-render
  version: number
  start: (apiKey: string, accessToken: string) => void
  stop: () => void
  subscribe: (tokens: number[], mode?: 'ltp' | 'quote' | 'full', segments?: Record<number, string>) => void
  unsubscribe: (tokens: number[]) => void
  setMode: (tokens: number[], mode: 'ltp' | 'quote' | 'full') => void
  receiveTicks: (incoming: Tick[]) => void
}

function mergeTicks(incoming: Tick[]) {
  const state = useTicksStore.getState()
  const map = state.ticks
  for (const tick of incoming) {
    const prev = map.get(tick.instrumentToken)
    map.set(tick.instrumentToken, prev ? { ...prev, ...tick } : tick)
  }
  useTicksStore.setState({ ticks: map, version: state.version + 1 })
}

export const useTicksStore = create<TicksState>((set, get) => ({
  ticker: null,
  status: 'idle',
  error: null,
  ticks: new Map(),
  version: 0,
  start: (apiKey, accessToken) => {
    if (get().ticker) return
    const ticker = new KiteTicker({
      apiKey,
      accessToken,
      events: {
        onStatus: (status, error) => set({ status, error: error ?? null }),
        onAuthError: () => { useAuthStore.getState().logout() },
        onTicks: mergeTicks,
      },
    })
    set({ ticker })
    ticker.connect()
  },
  stop: () => {
    get().ticker?.disconnect()
    set({ ticker: null, status: 'closed', ticks: new Map() })
  },
  subscribe: (tokens, mode = 'quote', segments) => {
    get().ticker?.subscribe(tokens, mode, segments)
  },
  unsubscribe: (tokens) => {
    get().ticker?.unsubscribe(tokens)
    const map = get().ticks
    for (const t of tokens) map.delete(t)
    set({ ticks: map, version: get().version + 1 })
  },
  setMode: (tokens, mode) => {
    get().ticker?.setMode(tokens, mode)
  },
  receiveTicks: mergeTicks,
}))
