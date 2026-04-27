import { useAuthStore } from '../store/authStore'

export function LoginPanel() {
  const apiKeyDraft = useAuthStore((s) => s.apiKeyDraft)
  const apiSecretDraft = useAuthStore((s) => s.apiSecretDraft)
  const envCredentials = useAuthStore((s) => s.envCredentials)
  const loading = useAuthStore((s) => s.loading)
  const error = useAuthStore((s) => s.error)
  const setDraft = useAuthStore((s) => s.setDraft)
  const loginAndExchange = useAuthStore((s) => s.loginAndExchange)

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Connect to Kite</h1>
        {envCredentials ? (
          <p>
            Credentials loaded from <code>.env</code>. Click below to open the Kite login window
            and complete 2FA — the access token will be exchanged automatically.
          </p>
        ) : (
          <p>
            Enter your <a href="https://developers.kite.trade/apps/" onClick={(e) => { e.preventDefault(); window.kite.openExternal('https://developers.kite.trade/apps/') }}>Kite Connect app</a> credentials,
            or set <code>KITE_API_KEY</code> and <code>KITE_API_SECRET</code> in a <code>.env</code> file at the project root.
          </p>
        )}

        {!envCredentials && (
          <>
            <label>
              API Key
              <input
                value={apiKeyDraft}
                onChange={(e) => setDraft('apiKeyDraft', e.target.value.trim())}
                placeholder="your api_key"
                autoComplete="off"
              />
            </label>
            <label>
              API Secret
              <input
                type="password"
                value={apiSecretDraft}
                onChange={(e) => setDraft('apiSecretDraft', e.target.value.trim())}
                placeholder="your api_secret"
                autoComplete="off"
              />
            </label>
          </>
        )}

        {envCredentials && (
          <p className="muted">
            api_key: <code>{maskKey(apiKeyDraft)}</code>
          </p>
        )}

        {error && <p className="login-error">{error}</p>}

        <button
          type="button"
          className="buy-button"
          disabled={loading || !apiKeyDraft || !apiSecretDraft}
          onClick={() => loginAndExchange()}
        >
          {loading ? 'Authenticating…' : 'Login with Kite'}
        </button>
        <small>
          Access tokens are stored locally in your OS user-data directory. Secrets in <code>.env</code> never leave this machine.
        </small>
      </div>
    </div>
  )
}

function maskKey(key: string): string {
  if (!key) return '—'
  if (key.length <= 6) return key
  return `${key.slice(0, 3)}…${key.slice(-3)}`
}
