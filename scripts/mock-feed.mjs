#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2))
const port = Number(args.port || process.env.MOCK_FEED_PORT || 17641)
const intervalMs = Number(args.interval || args.intervalMs || 650)
const volatility = Number(args.volatility || 0.006)
const depthLevels = Number(args.depth || args.depthLevels || 5)
const baseUrl = `http://127.0.0.1:${port}`

async function main() {
  await post('/mock-feed/start', { intervalMs, volatility, depthLevels })

  console.log(`Mock feed started on ${baseUrl}`)
  console.log(`interval=${intervalMs}ms volatility=${volatility} depth=${depthLevels}`)
  console.log('Keep this running while testing. Press Ctrl+C to stop.')

  const stop = async () => {
    try {
      await post('/mock-feed/stop', {})
      console.log('\nMock feed stopped.')
    } catch (err) {
      console.error(`\nFailed to stop mock feed: ${err.message}`)
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  setInterval(() => {}, 60_000)
}

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`)
  }
  return json
}

function parseArgs(values) {
  const out = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) continue
    const [rawKey, inlineValue] = value.slice(2).split('=')
    out[rawKey] = inlineValue ?? values[index + 1]
    if (inlineValue === undefined) index += 1
  }
  return out
}

main().catch((err) => {
  console.error(`Mock feed failed: ${err.message}`)
  console.error('Make sure the Electron app is running with npm run dev:electron.')
  process.exit(1)
})
