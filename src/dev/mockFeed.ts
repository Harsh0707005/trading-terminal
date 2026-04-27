import { useInstrumentsStore, type WatchlistEntry } from '../store/instrumentsStore'
import { useTicksStore } from '../store/ticksStore'
import type { DepthEntry, MockFeedControl, Tick } from '../types/kite'

type MockFeedOptions = {
  intervalMs: number
  volatility: number
  depthLevels: number
}

const DEFAULT_OPTIONS: MockFeedOptions = {
  intervalMs: 650,
  volatility: 0.006,
  depthLevels: 5,
}

const prices = new Map<number, number>()
let intervalId: number | undefined

export function registerMockFeedControls() {
  if (!window.kite?.onMockFeedControl) return

  window.kite.onMockFeedControl((control) => {
    if (control.action === 'start') {
      startMockFeed(control.options)
      return
    }
    stopMockFeed()
  })
}

function startMockFeed(options?: MockFeedControl['options']) {
  stopMockFeed()
  const feedOptions = { ...DEFAULT_OPTIONS, ...sanitizeOptions(options) }

  useTicksStore.setState({ status: 'connected', error: null })
  intervalId = window.setInterval(() => {
    const watchlist = useInstrumentsStore.getState().watchlist
    if (!watchlist.length) return
    useTicksStore.getState().receiveTicks(watchlist.map((entry) => makeTick(entry, feedOptions)))
  }, feedOptions.intervalMs)
}

function stopMockFeed() {
  if (intervalId !== undefined) {
    window.clearInterval(intervalId)
    intervalId = undefined
  }
}

function sanitizeOptions(options?: MockFeedControl['options']): Partial<MockFeedOptions> {
  return {
    intervalMs: clamp(Number(options?.intervalMs) || DEFAULT_OPTIONS.intervalMs, 100, 5000),
    volatility: clamp(Number(options?.volatility) || DEFAULT_OPTIONS.volatility, 0.0005, 0.08),
    depthLevels: Math.round(clamp(Number(options?.depthLevels) || DEFAULT_OPTIONS.depthLevels, 1, 5)),
  }
}

function makeTick(entry: WatchlistEntry, options: MockFeedOptions): Tick {
  const lastPrice = nextPrice(entry, options.volatility)
  const close = prices.get(-entry.instrumentToken) ?? seedPrice(entry) * (1 + randomBetween(-0.015, 0.015))
  prices.set(-entry.instrumentToken, close)

  const open = close * (1 + randomBetween(-0.01, 0.01))
  const high = Math.max(open, close, lastPrice) * (1 + Math.random() * 0.012)
  const low = Math.min(open, close, lastPrice) * (1 - Math.random() * 0.012)
  const spread = Math.max(lastPrice * 0.00035, entry.tickSize || 0.05)
  const bidPrice = roundToTick(lastPrice - spread / 2, entry.tickSize)
  const askPrice = roundToTick(lastPrice + spread / 2, entry.tickSize)
  const lotSize = Math.max(entry.lotSize || 1, 1)

  return {
    instrumentToken: entry.instrumentToken,
    mode: 'full',
    lastPrice,
    lastQuantity: randomQuantity(lotSize),
    averagePrice: roundToTick((open + high + low + lastPrice) / 4, entry.tickSize),
    volume: randomInt(5_000, 2_500_000),
    buyQuantity: randomQuantity(lotSize, 15, 200),
    sellQuantity: randomQuantity(lotSize, 15, 200),
    open: roundToTick(open, entry.tickSize),
    high: roundToTick(high, entry.tickSize),
    low: roundToTick(low, entry.tickSize),
    close: roundToTick(close, entry.tickSize),
    change: ((lastPrice - close) / close) * 100,
    oi: randomInt(10_000, 800_000),
    oiDayHigh: randomInt(500_000, 900_000),
    oiDayLow: randomInt(10_000, 400_000),
    lastTradedAt: Date.now(),
    exchangeTimestamp: Date.now(),
    bids: depthRows(bidPrice, -1, entry.tickSize, lotSize, options.depthLevels),
    offers: depthRows(askPrice, 1, entry.tickSize, lotSize, options.depthLevels),
  }
}

function nextPrice(entry: WatchlistEntry, volatility: number) {
  const current = prices.get(entry.instrumentToken) ?? seedPrice(entry)
  const drift = randomBetween(-volatility, volatility)
  const next = current * (1 + drift)
  const bounded = Math.max(next, Math.max(entry.tickSize || 0.05, current * 0.75))
  const rounded = roundToTick(bounded, entry.tickSize)
  prices.set(entry.instrumentToken, rounded)
  return rounded
}

function seedPrice(entry: WatchlistEntry) {
  const symbolScore = [...entry.tradingsymbol].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  if (entry.segment.includes('NFO')) return 80 + (symbolScore % 5000)
  if (entry.segment.includes('MCX')) return 200 + (symbolScore % 7000)
  return 50 + (symbolScore % 2400)
}

function depthRows(
  startPrice: number,
  direction: 1 | -1,
  tickSize: number,
  lotSize: number,
  levels: number,
): DepthEntry[] {
  return Array.from({ length: levels }, (_, index) => ({
    price: roundToTick(startPrice + direction * index * Math.max(tickSize || 0.05, startPrice * 0.0002), tickSize),
    quantity: randomQuantity(lotSize, 1, 60),
    orders: randomInt(1, 24),
  }))
}

function roundToTick(value: number, tickSize: number) {
  const step = tickSize || 0.05
  return Number((Math.round(value / step) * step).toFixed(2))
}

function randomQuantity(lotSize: number, minLots = 1, maxLots = 40) {
  return lotSize * randomInt(minLots, maxLots)
}

function randomInt(min: number, max: number) {
  return Math.floor(randomBetween(min, max + 1))
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
