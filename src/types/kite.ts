export type KiteSession = {
  apiKey: string
  apiSecret: string
  accessToken: string
  publicToken?: string
  userId: string
  userName: string
  email?: string
  loginTime?: string
  savedAt?: string
}

export type Instrument = {
  instrumentToken: number
  tradingsymbol: string
  exchange: string
  segment: string
  name: string
  expiry: string | null
  strike: number
  tickSize: number
  lotSize: number
  instrumentType: string
}

export type Variety = 'regular' | 'amo' | 'co' | 'iceberg' | 'auction'
export type TransactionType = 'BUY' | 'SELL'
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M'
export type Product = 'CNC' | 'NRML' | 'MIS' | 'MTF'
export type Validity = 'DAY' | 'IOC' | 'TTL'
export type Exchange = 'NSE' | 'BSE' | 'NFO' | 'CDS' | 'BCD' | 'MCX' | 'BFO'

export type PlaceOrderParams = {
  variety: Variety
  tradingsymbol: string
  exchange: Exchange
  transaction_type: TransactionType
  order_type: OrderType
  quantity: number
  product: Product
  price?: number
  trigger_price?: number
  disclosed_quantity?: number
  validity?: Validity
  validity_ttl?: number
  iceberg_legs?: number
  iceberg_quantity?: number
  tag?: string
}

export type Order = {
  order_id: string
  parent_order_id: string | null
  exchange_order_id: string | null
  status: string
  status_message?: string | null
  variety: string
  exchange: string
  tradingsymbol: string
  instrument_token: number
  transaction_type: TransactionType
  order_type: OrderType
  product: Product
  validity: Validity
  price: number
  trigger_price: number
  quantity: number
  filled_quantity: number
  pending_quantity: number
  cancelled_quantity: number
  average_price: number
  disclosed_quantity: number
  order_timestamp: string | null
  exchange_timestamp: string | null
  tag: string | null
}

export type Position = {
  tradingsymbol: string
  exchange: string
  instrument_token: number
  product: string
  quantity: number
  overnight_quantity: number
  multiplier: number
  average_price: number
  last_price: number
  close_price: number
  pnl: number
  m2m: number
  unrealised: number
  realised: number
  buy_quantity: number
  buy_price: number
  buy_value: number
  sell_quantity: number
  sell_price: number
  sell_value: number
  day_buy_quantity: number
  day_buy_price: number
  day_sell_quantity: number
  day_sell_price: number
}

export type Holding = {
  tradingsymbol: string
  exchange: string
  instrument_token: number
  isin: string
  product: string
  quantity: number
  t1_quantity: number
  realised_quantity: number
  average_price: number
  last_price: number
  close_price: number
  pnl: number
  day_change: number
  day_change_percentage: number
}

export type DepthEntry = { quantity: number; price: number; orders: number }

export type Tick = {
  instrumentToken: number
  mode: 'ltp' | 'quote' | 'full' | 'index-quote' | 'index-full'
  lastPrice: number
  lastQuantity?: number
  averagePrice?: number
  volume?: number
  buyQuantity?: number
  sellQuantity?: number
  open?: number
  high?: number
  low?: number
  close?: number
  change?: number
  oi?: number
  oiDayHigh?: number
  oiDayLow?: number
  lastTradedAt?: number
  exchangeTimestamp?: number
  bids?: DepthEntry[]
  offers?: DepthEntry[]
}

export type Margins = {
  enabled: boolean
  net: number
  available: {
    cash: number
    opening_balance: number
    live_balance: number
    intraday_payin: number
    adhoc_margin: number
    collateral: number
  }
  utilised: Record<string, number>
}

export type KiteConfig = {
  apiKey: string
  apiSecret: string
  hasEnvCredentials: boolean
}

export type MockFeedControl = {
  action: 'start' | 'stop'
  options?: {
    intervalMs?: number
    volatility?: number
    depthLevels?: number
  }
}

declare global {
  interface Window {
    kite: {
      getConfig(): Promise<KiteConfig>
      getSession(): Promise<KiteSession | null>
      logout(): Promise<boolean>
      login(p: { apiKey: string }): Promise<{ requestToken: string }>
      exchangeToken(p: { apiKey: string; apiSecret: string; requestToken: string }): Promise<KiteSession>
      saveSession(s: KiteSession): Promise<boolean>
      request<T = unknown>(p: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
        path: string
        query?: Record<string, unknown>
        form?: Record<string, unknown>
        json?: unknown
      }): Promise<T>
      fetchInstruments(p?: { exchange?: string }): Promise<Instrument[]>
      openExternal(url: string): Promise<boolean>
      saveWatchlistsExport(payload: string): Promise<{ filePath: string }>
      onMockFeedControl(callback: (control: MockFeedControl) => void): () => void
    }
  }
}
