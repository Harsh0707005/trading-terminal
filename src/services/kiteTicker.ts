import type { DepthEntry, Tick } from '../types/kite'

export type TickerMode = 'ltp' | 'quote' | 'full'
export type TickerStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'

export type TickerEvents = {
  onStatus?: (status: TickerStatus, error?: string) => void
  onTicks?: (ticks: Tick[]) => void
  onOrder?: (data: unknown) => void
  onMessage?: (data: unknown) => void
  onAuthError?: () => void
}

const WS_URL = 'wss://ws.kite.trade'
const CURRENCY_DIVISOR = 10_000_000
const DEFAULT_DIVISOR = 100

// Heuristic: which segments use the 1e7 divisor. Pass via setSegment per token.
const CURRENCY_SEGMENTS = new Set(['CDS', 'BCD'])

const FAST_FAIL_THRESHOLD_MS = 5_000  // close within 5 s = fast fail
const AUTH_FAIL_AFTER = 3              // 3 fast fails → assume auth error

export class KiteTicker {
  private ws: WebSocket | null = null
  private apiKey: string
  private accessToken: string
  private subscriptions = new Map<number, TickerMode>()
  private segments = new Map<number, string>()
  private events: TickerEvents
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manualClose = false
  private status: TickerStatus = 'idle'
  private connectedAt: number | null = null
  private fastFailCount = 0
  private receivedFirstMessage = false

  constructor(opts: { apiKey: string; accessToken: string; events?: TickerEvents }) {
    this.apiKey = opts.apiKey
    this.accessToken = opts.accessToken
    this.events = opts.events ?? {}
  }

  getStatus() { return this.status }

  connect() {
    this.manualClose = false
    this.connectedAt = null
    this.receivedFirstMessage = false
    this.setStatus('connecting')
    const url = `${WS_URL}?api_key=${encodeURIComponent(this.apiKey)}&access_token=${encodeURIComponent(this.accessToken)}`
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    this.ws = ws

    ws.onopen = () => {
      this.connectedAt = Date.now()
      this.reconnectAttempts = 0
      this.setStatus('connected')
      const tokens = [...this.subscriptions.keys()]
      if (tokens.length) {
        this.send({ a: 'subscribe', v: tokens })
        const byMode = new Map<TickerMode, number[]>()
        for (const [tok, mode] of this.subscriptions) {
          const arr = byMode.get(mode) ?? []
          arr.push(tok)
          byMode.set(mode, arr)
        }
        for (const [mode, list] of byMode) this.send({ a: 'mode', v: [mode, list] })
      }
    }

    ws.onmessage = (evt) => {
      this.receivedFirstMessage = true
      this.fastFailCount = 0  // a real message means we're authenticated
      if (typeof evt.data === 'string') {
        try {
          const obj = JSON.parse(evt.data)
          if (obj?.type === 'order') this.events.onOrder?.(obj.data)
          else this.events.onMessage?.(obj)
        } catch {
          this.events.onMessage?.(evt.data)
        }
        return
      }
      const buf = evt.data as ArrayBuffer
      if (buf.byteLength <= 1) return // heartbeat
      const ticks = parseBinary(buf, this.segments)
      if (ticks.length) this.events.onTicks?.(ticks)
    }

    ws.onerror = () => {
      // onerror always precedes onclose — don't set status here to avoid flicker
    }

    ws.onclose = (evt) => {
      this.ws = null
      if (this.manualClose) {
        this.setStatus('closed')
        return
      }
      const lifetime = this.connectedAt != null ? Date.now() - this.connectedAt : 0
      const isFastFail = !this.receivedFirstMessage || lifetime < FAST_FAIL_THRESHOLD_MS
      if (isFastFail) {
        this.fastFailCount++
        if (this.fastFailCount >= AUTH_FAIL_AFTER) {
          this.setStatus('error', `Session expired or invalid token (close ${evt.code})`)
          this.events.onAuthError?.()
          return
        }
      }
      this.scheduleReconnect()
    }
  }

  disconnect() {
    this.manualClose = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.ws?.close()
    this.ws = null
    this.setStatus('closed')
  }

  subscribe(tokens: number[], mode: TickerMode = 'quote', segments?: Record<number, string>) {
    if (segments) for (const [k, v] of Object.entries(segments)) this.segments.set(Number(k), v)
    const fresh = tokens.filter((t) => !this.subscriptions.has(t))
    for (const t of tokens) this.subscriptions.set(t, mode)
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (fresh.length) this.send({ a: 'subscribe', v: fresh })
      this.send({ a: 'mode', v: [mode, tokens] })
    }
  }

  unsubscribe(tokens: number[]) {
    for (const t of tokens) this.subscriptions.delete(t)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ a: 'unsubscribe', v: tokens })
    }
  }

  setMode(tokens: number[], mode: TickerMode) {
    for (const t of tokens) if (this.subscriptions.has(t)) this.subscriptions.set(t, mode)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ a: 'mode', v: [mode, tokens] })
    }
  }

  setSegmentForToken(token: number, segment: string) {
    this.segments.set(token, segment)
  }

  private send(msg: unknown) {
    this.ws?.send(JSON.stringify(msg))
  }

  private setStatus(status: TickerStatus, error?: string) {
    this.status = status
    this.events.onStatus?.(status, error)
  }

  private scheduleReconnect() {
    if (this.manualClose) return
    this.setStatus('reconnecting')
    // Minimum 3 s delay; grows exponentially up to 30 s
    const delay = Math.min(30_000, 3_000 * 2 ** Math.min(this.reconnectAttempts, 4))
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }
}

function divisorForSegment(segment: string | undefined): number {
  if (segment && CURRENCY_SEGMENTS.has(segment)) return CURRENCY_DIVISOR
  return DEFAULT_DIVISOR
}

export function parseBinary(buf: ArrayBuffer, segments?: Map<number, string>): Tick[] {
  const view = new DataView(buf)
  const numPackets = view.getInt16(0, false)
  let offset = 2
  const ticks: Tick[] = []
  for (let i = 0; i < numPackets; i++) {
    const len = view.getInt16(offset, false)
    offset += 2
    const tick = parsePacket(view, offset, len, segments)
    if (tick) ticks.push(tick)
    offset += len
  }
  return ticks
}

function parsePacket(view: DataView, offset: number, len: number, segments?: Map<number, string>): Tick | null {
  if (len < 4) return null
  const token = view.getInt32(offset + 0, false)
  const seg = segments?.get(token)
  const div = divisorForSegment(seg)

  // Index packets: 8 bytes (LTP) or 28/32 bytes (quote/full)
  // Tradeable: 8 / 44 / 184
  if (len === 8) {
    return {
      instrumentToken: token,
      mode: 'ltp',
      lastPrice: view.getInt32(offset + 4, false) / div,
    }
  }

  if (len === 28 || len === 32) {
    // Index quote/full
    return {
      instrumentToken: token,
      mode: len === 32 ? 'index-full' : 'index-quote',
      lastPrice: view.getInt32(offset + 4, false) / div,
      high: view.getInt32(offset + 8, false) / div,
      low: view.getInt32(offset + 12, false) / div,
      open: view.getInt32(offset + 16, false) / div,
      close: view.getInt32(offset + 20, false) / div,
      change: view.getInt32(offset + 24, false) / div,
      exchangeTimestamp: len === 32 ? view.getInt32(offset + 28, false) : undefined,
    }
  }

  if (len === 44 || len === 184) {
    const tick: Tick = {
      instrumentToken: token,
      mode: len === 184 ? 'full' : 'quote',
      lastPrice: view.getInt32(offset + 4, false) / div,
      lastQuantity: view.getInt32(offset + 8, false),
      averagePrice: view.getInt32(offset + 12, false) / div,
      volume: view.getInt32(offset + 16, false),
      buyQuantity: view.getInt32(offset + 20, false),
      sellQuantity: view.getInt32(offset + 24, false),
      open: view.getInt32(offset + 28, false) / div,
      high: view.getInt32(offset + 32, false) / div,
      low: view.getInt32(offset + 36, false) / div,
      close: view.getInt32(offset + 40, false) / div,
    }
    if (len === 184) {
      tick.lastTradedAt = view.getInt32(offset + 44, false)
      tick.oi = view.getInt32(offset + 48, false)
      tick.oiDayHigh = view.getInt32(offset + 52, false)
      tick.oiDayLow = view.getInt32(offset + 56, false)
      tick.exchangeTimestamp = view.getInt32(offset + 60, false)
      const bids: DepthEntry[] = []
      const offers: DepthEntry[] = []
      let depthOffset = offset + 64
      for (let j = 0; j < 5; j++) {
        bids.push({
          quantity: view.getInt32(depthOffset, false),
          price: view.getInt32(depthOffset + 4, false) / div,
          orders: view.getInt16(depthOffset + 8, false),
        })
        depthOffset += 12
      }
      for (let j = 0; j < 5; j++) {
        offers.push({
          quantity: view.getInt32(depthOffset, false),
          price: view.getInt32(depthOffset + 4, false) / div,
          orders: view.getInt16(depthOffset + 8, false),
        })
        depthOffset += 12
      }
      tick.bids = bids
      tick.offers = offers
    }
    return tick
  }

  return null
}
