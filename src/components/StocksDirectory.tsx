import { useEffect, useMemo, useState, type UIEvent } from 'react'
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
  const chunkSize = 250
  const [visibleCount, setVisibleCount] = useState(chunkSize)

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

  useEffect(() => {
    setVisibleCount(chunkSize)
  }, [sorted.length])

  const visibleItems = useMemo<Instrument[]>(
    () => sorted.slice(0, visibleCount),
    [sorted, visibleCount],
  )

  const grouped = useMemo<Group[]>(() => {
    const sections = new Map<string, Instrument[]>()

    for (const instrument of visibleItems) {
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
  }, [visibleItems])

  const hasMore = visibleCount < sorted.length
  const loadMore = () => {
    if (!hasMore) return
    setVisibleCount((count) => Math.min(count + chunkSize, sorted.length))
  }

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMore) return
    const element = event.currentTarget
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distanceToBottom <= 160) loadMore()
  }

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
    <div className="stocks-directory" onScroll={onScroll}>
      <div className="stocks-pagination">
        <span>
          Showing {visibleItems.length.toLocaleString('en-IN')} / {sorted.length.toLocaleString('en-IN')}
        </span>
        {!hasMore && <span>All loaded</span>}
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
