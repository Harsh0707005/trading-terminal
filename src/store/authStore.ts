import { create } from 'zustand'
import type { KiteSession } from '../types/kite'

type AuthState = {
  session: KiteSession | null
  loading: boolean
  error: string | null
  apiKeyDraft: string
  apiSecretDraft: string
  envCredentials: boolean
  setDraft: (k: 'apiKeyDraft' | 'apiSecretDraft', v: string) => void
  bootstrap: () => Promise<void>
  loginAndExchange: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  loading: false,
  error: null,
  apiKeyDraft: '',
  apiSecretDraft: '',
  envCredentials: false,
  setDraft: (k, v) => set({ [k]: v } as Partial<AuthState>),
  bootstrap: async () => {
    const [config, session] = await Promise.all([
      window.kite.getConfig(),
      window.kite.getSession(),
    ])
    if (session) {
      set({
        session,
        apiKeyDraft: config.apiKey || session.apiKey,
        apiSecretDraft: config.apiSecret || session.apiSecret,
        envCredentials: config.hasEnvCredentials,
      })
      return
    }
    set({
      apiKeyDraft: config.apiKey || '',
      apiSecretDraft: config.apiSecret || '',
      envCredentials: config.hasEnvCredentials,
    })
  },
  loginAndExchange: async () => {
    const { apiKeyDraft, apiSecretDraft } = get()
    if (!apiKeyDraft || !apiSecretDraft) {
      set({ error: 'API key and secret required' })
      return
    }
    set({ loading: true, error: null })
    try {
      const { requestToken } = await window.kite.login({ apiKey: apiKeyDraft })
      const session = await window.kite.exchangeToken({
        apiKey: apiKeyDraft,
        apiSecret: apiSecretDraft,
        requestToken,
      })
      set({ session, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },
  logout: async () => {
    await window.kite.logout()
    set({ session: null })
  },
}))
