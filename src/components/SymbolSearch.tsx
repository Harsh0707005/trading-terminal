import { useMemo, useState, type FocusEvent } from 'react'
import { useInstrumentsStore } from '../store/instrumentsStore'
import type { Instrument } from '../types/kite'

export function SymbolSearch() {
  const loaded = useInstrumentsStore((s) => s.loaded)
  const loading = useInstrumentsStore((s) => s.loading)
  const error = useInstrumentsStore((s) => s.error)
  const load = useInstrumentsStore((s) => s.load)
  const search = useInstrumentsStore((s) => s.search)
  const addToWatchlist = useInstrumentsStore((s) => s.addToWatchlist)
  const watchlist = useInstrumentsStore((s) => s.watchlist)
  const activeWatchlistIndex = useInstrumentsStore((s) => s.activeWatchlistIndex)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const results = useMemo<Instrument[]>(() => {
    if (!loaded || !query.trim()) return []
    return search(query, 200).slice(0, 30)
  }, [query, loaded, search])

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    setIsOpen(false)
  }

  return (
    <div className="symbol-search" onBlur={closeWhenFocusLeaves} onFocus={() => setIsOpen(true)}>
      <div className="search-row">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          placeholder={loaded ? `Search and add to WL ${activeWatchlistIndex + 1}...` : 'Loading instruments...'}
          disabled={!loaded}
          autoComplete="off"
        />
        {!loaded && (
          <button type="button" className="ghost-button" onClick={() => load()} disabled={loading}>
            {loading ? 'Loading…' : 'Load'}
          </button>
        )}
      </div>
      {error && <p className="login-error">{error}</p>}
      {isOpen && results.length > 0 && (
        <ul className="search-results">
          {results.map((i) => {
            const inList = watchlist.some((w) => w.instrumentToken === i.instrumentToken)
            return (
              <li key={`${i.exchange}-${i.instrumentToken}`}>
                <div>
                  <strong>{i.tradingsymbol}</strong>
                  <span className="muted">{i.exchange} · {i.segment}</span>
                  {i.expiry && <span className="muted"> · exp {i.expiry}</span>}
                </div>
                <button
                  type="button"
                  className="ghost-button compact"
                  disabled={inList}
                  onClick={() => {
                    addToWatchlist(i)
                    setIsOpen(false)
                  }}
                >
                  {inList ? 'Added' : '+ Watch'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
