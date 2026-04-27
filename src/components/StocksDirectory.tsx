import { useMemo, useState } from 'react'
import { useInstrumentsStore } from '../store/instrumentsStore'
import type { Instrument } from '../types/kite'

type Group = {
  letter: string
  items: Instrument[]
}

export function StocksDirectory() {
  const loaded = useInstrumentsStore((s) => s.loaded)
  const loading = useInstrumentsStore((s) => s.loading)
  const load = useInstrumentsStore((s) => s.load)
  const searchPool = useInstrumentsStore((s) => s.searchPool)
  const watchlist = useInstrumentsStore((s) => s.watchlist)
  const addToWatchlist = useInstrumentsStore((s) => s.addToWatchlist)
  const [page, setPage] = useState(1)
  const pageSize = 250

  const sorted = useMemo<Instrument[]>(
    () =>
      searchPool
        .filter((instrument) => {
          const hasLetterSymbol = /^[A-Za-z]/.test(instrument.tradingsymbol ?? '')
          const normalizedName = instrument.name?.trim() ?? ''
          const hasValidName = normalizedName.length > 0 && normalizedName !== '-'
          return hasLetterSymbol && hasValidName
        })
        .sort((a, b) => a.tradingsymbol.localeCompare(b.tradingsymbol)),
    [searchPool],
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)

  const pageSlice = useMemo<Instrument[]>(() => {
    const start = (safePage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [safePage, sorted])

  const grouped = useMemo<Group[]>(() => {
    const sections = new Map<string, Instrument[]>()

    for (const instrument of pageSlice) {
      const firstChar = instrument.tradingsymbol?.[0]?.toUpperCase() ?? '#'
      if (!/[A-Z]/.test(firstChar)) continue
      const letter = firstChar
      const bucket = sections.get(letter)
      if (bucket) {
        bucket.push(instrument)
      } else {
        sections.set(letter, [instrument])
      }
    }

    return [...sections.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, items]) => ({ letter, items }))
  }, [pageSlice])

  if (!loaded) {
    return (
      <div className="empty-state">
        <p>Instruments are not loaded yet.</p>
        <button type="button" className="ghost-button compact" onClick={() => load()} disabled={loading}>
          {loading ? 'Loading...' : 'Load instruments'}
        </button>
      </div>
    )
  }

  return (
    <div className="stocks-directory">
      <div className="stocks-pagination">
        <button
          type="button"
          className="ghost-button compact"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={safePage <= 1}
        >
          Prev
        </button>
        <span>
          Page {safePage} of {totalPages}
        </span>
        <button
          type="button"
          className="ghost-button compact"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
        >
          Next
        </button>
        <span>{sorted.length.toLocaleString('en-IN')} instruments</span>
      </div>
      {grouped.map((group) => (
        <section key={group.letter} className="stocks-group" aria-label={`Section ${group.letter}`}>
          <header className="stocks-group-header">
            <strong>{group.letter}</strong>
            <span>{group.items.length}</span>
          </header>
          <div className="stocks-group-table-wrap">
            <table className="market-table compact stocks-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Exchange</th>
                  <th>Segment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((instrument) => {
                  const inWatchlist = watchlist.some((w) => w.instrumentToken === instrument.instrumentToken)
                  return (
                    <tr key={instrument.instrumentToken}>
                      <td className="symbol-cell">{instrument.tradingsymbol}</td>
                      <td>{instrument.name || '—'}</td>
                      <td>{instrument.exchange}</td>
                      <td>{instrument.segment}</td>
                      <td className="number">
                        <button
                          type="button"
                          className="ghost-button compact"
                          disabled={inWatchlist}
                          onClick={() => addToWatchlist(instrument)}
                        >
                          {inWatchlist ? 'Added' : '+ Watch'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
