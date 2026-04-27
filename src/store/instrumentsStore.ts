import { create } from 'zustand'
import type { Instrument } from '../types/kite'

type WatchlistEntry = {
  instrumentToken: number
  tradingsymbol: string
  exchange: string
  segment: string
  lotSize: number
  tickSize: number
}

type InstrumentsState = {
  loaded: boolean
  loading: boolean
  error: string | null
  // Index by instrument token for fast lookups
  byToken: Map<number, Instrument>
  // Sample subset for search (we keep at most ~20k after filtering for memory)
  searchPool: Instrument[]
  watchlists: WatchlistEntry[][]
  activeWatchlistIndex: number
  watchlist: WatchlistEntry[]
  load: () => Promise<void>
  search: (query: string, limit?: number) => Instrument[]
  addToWatchlist: (i: Instrument) => void
  removeFromWatchlist: (token: number) => void
  setActiveWatchlist: (index: number) => void
  loadWatchlistFromStorage: () => void
  exportWatchlists: () => string
  importWatchlists: (payload: unknown) => void
}

const WATCHLIST_KEY = 'kite.watchlists.v2'
const LEGACY_WATCHLIST_KEY = 'kite.watchlist.v1'
const WATCHLIST_COUNT = 5
const WATCHLIST_EXPORT_VERSION = 1

function emptyWatchlists(): WatchlistEntry[][] {
  return Array.from({ length: WATCHLIST_COUNT }, () => [])
}

function isWatchlistEntry(value: unknown): value is WatchlistEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<WatchlistEntry>
  return (
    typeof entry.instrumentToken === 'number' &&
    typeof entry.tradingsymbol === 'string' &&
    typeof entry.exchange === 'string' &&
    typeof entry.segment === 'string' &&
    typeof entry.lotSize === 'number' &&
    typeof entry.tickSize === 'number'
  )
}

function normalizeWatchlists(raw: unknown): WatchlistEntry[][] {
  const nextWatchlists = emptyWatchlists()
  if (!Array.isArray(raw)) return nextWatchlists
  for (let i = 0; i < Math.min(raw.length, WATCHLIST_COUNT); i += 1) {
    const maybeList = raw[i]
    if (!Array.isArray(maybeList)) continue
    nextWatchlists[i] = maybeList.filter(isWatchlistEntry)
  }
  return nextWatchlists
}

export const useInstrumentsStore = create<InstrumentsState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  byToken: new Map(),
  searchPool: [],
  watchlists: emptyWatchlists(),
  activeWatchlistIndex: 0,
  watchlist: [],
  load: async () => {
    if (get().loading || get().loaded) return
    set({ loading: true, error: null })
    try {
      const list = await window.kite.fetchInstruments({})
      const byToken = new Map<number, Instrument>()
      for (const i of list) byToken.set(i.instrumentToken, i)
      set({ byToken, searchPool: list, loaded: true, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },
  search: (query, limit = 50) => {
    const q = query.trim().toUpperCase()
    if (!q) return []
    const pool = get().searchPool
    const out: Instrument[] = []
    for (const i of pool) {
      if (i.tradingsymbol?.toUpperCase().includes(q)) {
        out.push(i)
        if (out.length >= limit) break
      }
    }
    return out
  },
  addToWatchlist: (i) => {
    const { watchlists, activeWatchlistIndex } = get()
    const cur = watchlists[activeWatchlistIndex] ?? []
    if (cur.some((w) => w.instrumentToken === i.instrumentToken)) return
    const nextActive: WatchlistEntry[] = [
      ...cur,
      {
        instrumentToken: i.instrumentToken,
        tradingsymbol: i.tradingsymbol,
        exchange: i.exchange,
        segment: i.segment,
        lotSize: i.lotSize,
        tickSize: i.tickSize,
      },
    ]
    const nextWatchlists = watchlists.map((list, idx) => (idx === activeWatchlistIndex ? nextActive : list))
    set({ watchlists: nextWatchlists, watchlist: nextActive })
    try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(nextWatchlists)) } catch { void 0 }
  },
  removeFromWatchlist: (token) => {
    const { watchlists, activeWatchlistIndex } = get()
    const nextActive = (watchlists[activeWatchlistIndex] ?? []).filter((w) => w.instrumentToken !== token)
    const nextWatchlists = watchlists.map((list, idx) => (idx === activeWatchlistIndex ? nextActive : list))
    set({ watchlists: nextWatchlists, watchlist: nextActive })
    try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(nextWatchlists)) } catch { void 0 }
  },
  setActiveWatchlist: (index) => {
    if (index < 0 || index >= WATCHLIST_COUNT) return
    const watchlists = get().watchlists
    set({ activeWatchlistIndex: index, watchlist: watchlists[index] ?? [] })
  },
  loadWatchlistFromStorage: () => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        const nextWatchlists = normalizeWatchlists(parsed)
        set({ watchlists: nextWatchlists, watchlist: nextWatchlists[0], activeWatchlistIndex: 0 })
        return
      }
      const legacy = localStorage.getItem(LEGACY_WATCHLIST_KEY)
      if (legacy) {
        const first = JSON.parse(legacy) as WatchlistEntry[]
        const nextWatchlists = emptyWatchlists()
        nextWatchlists[0] = Array.isArray(first) ? first : []
        set({ watchlists: nextWatchlists, watchlist: nextWatchlists[0], activeWatchlistIndex: 0 })
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(nextWatchlists))
      }
    } catch { void 0 }
  },
  exportWatchlists: () => JSON.stringify({
    version: WATCHLIST_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    watchlists: get().watchlists,
  }, null, 2),
  importWatchlists: (payload) => {
    const maybeObject = payload && typeof payload === 'object' ? payload as { watchlists?: unknown } : null
    const source = maybeObject && 'watchlists' in maybeObject ? maybeObject.watchlists : payload
    const nextWatchlists = normalizeWatchlists(source)
    set({
      watchlists: nextWatchlists,
      watchlist: nextWatchlists[get().activeWatchlistIndex] ?? [],
    })
    try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(nextWatchlists)) } catch { void 0 }
  },
}))

export type { WatchlistEntry }
