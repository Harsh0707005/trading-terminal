const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const http = require('node:http')

const KITE_API_BASE = 'https://api.kite.trade'
const KITE_LOGIN_BASE = 'https://kite.zerodha.com/connect/login'
const SESSION_FILE = path.join(app.getPath('userData'), 'kite-session.json')
const INSTRUMENTS_DIR = path.join(app.getPath('userData'), 'instruments')
const MOCK_FEED_PORT = Number(process.env.MOCK_FEED_PORT || 17641)

loadDotenv()

let mainWindow = null

function loadDotenv() {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(app.getAppPath(), '.env'),
    path.join(__dirname, '..', '.env'),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    try {
      const text = fs.readFileSync(file, 'utf8')
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq < 0) continue
        const key = line.slice(0, eq).trim()
        let val = line.slice(eq + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (process.env[key] === undefined) process.env[key] = val
      }
      break
    } catch {}
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1100,
    minHeight: 680,
    title: 'Trading Terminal',
    backgroundColor: '#1b1d22',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    mainWindow.loadURL('http://127.0.0.1:5173')
  }
}

app.whenReady().then(() => {
  createWindow()
  startMockFeedServer()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function broadcastToRenderers(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        req.destroy()
        reject(new Error('Request body too large'))
      }
    })
    req.on('end', () => {
      if (!body.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
  })
  res.end(JSON.stringify(payload))
}

function startMockFeedServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, port: MOCK_FEED_PORT })
      return
    }

    if (req.method === 'POST' && req.url === '/mock-feed/start') {
      try {
        const options = await readJsonBody(req)
        broadcastToRenderers('mock-feed:control', { action: 'start', options })
        sendJson(res, 200, { ok: true, action: 'start', options })
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err.message })
      }
      return
    }

    if (req.method === 'POST' && req.url === '/mock-feed/stop') {
      broadcastToRenderers('mock-feed:control', { action: 'stop' })
      sendJson(res, 200, { ok: true, action: 'stop' })
      return
    }

    sendJson(res, 404, { ok: false, error: 'Not found' })
  })

  server.listen(MOCK_FEED_PORT, '127.0.0.1', () => {
    console.log(`Mock feed control server listening on http://127.0.0.1:${MOCK_FEED_PORT}`)
  })

  server.on('error', (err) => {
    console.warn(`Mock feed control server failed: ${err.message}`)
  })
}

// ---------- session storage ----------

function readSession() {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))
  } catch {
    return null
  }
}

function writeSession(data) {
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true })
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
}

function clearSession() {
  try { fs.unlinkSync(SESSION_FILE) } catch {}
}

// ---------- HTTP helpers ----------

async function kiteFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const url = path.startsWith('http') ? path : `${KITE_API_BASE}${path}`
  const res = await fetch(url, {
    method,
    headers: { 'X-Kite-Version': '3', ...headers },
    body,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  if (!res.ok) {
    const message = json?.message || text || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.errorType = json?.error_type
    err.body = json ?? text
    throw err
  }
  return json ?? text
}

function authHeader(apiKey, accessToken) {
  return { Authorization: `token ${apiKey}:${accessToken}` }
}

function formEncode(obj) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    params.append(k, String(v))
  }
  return params.toString()
}

// ---------- IPC: config ----------

ipcMain.handle('kite:get-config', () => ({
  apiKey: process.env.KITE_API_KEY || '',
  apiSecret: process.env.KITE_API_SECRET || '',
  hasEnvCredentials: Boolean(process.env.KITE_API_KEY && process.env.KITE_API_SECRET),
}))

// ---------- IPC: auth ----------

ipcMain.handle('kite:get-session', () => readSession())

ipcMain.handle('kite:logout', () => { clearSession(); return true })

ipcMain.handle('kite:login', async (_e, { apiKey }) => {
  if (!apiKey) throw new Error('apiKey required')
  return new Promise((resolve, reject) => {
    const authWin = new BrowserWindow({
      width: 520,
      height: 720,
      parent: mainWindow ?? undefined,
      modal: false,
      title: 'Kite Login',
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    })
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      try { authWin.destroy() } catch {}
      fn(value)
    }
    const inspect = (url) => {
      try {
        const u = new URL(url)
        const requestToken = u.searchParams.get('request_token')
        const status = u.searchParams.get('status')
        if (requestToken) {
          if (status && status !== 'success') {
            finish(reject, new Error(`Login status: ${status}`))
          } else {
            finish(resolve, { requestToken })
          }
        }
      } catch {}
    }
    authWin.webContents.on('will-redirect', (_evt, url) => inspect(url))
    authWin.webContents.on('will-navigate', (_evt, url) => inspect(url))
    authWin.webContents.on('did-navigate', (_evt, url) => inspect(url))
    authWin.on('closed', () => finish(reject, new Error('Login window closed')))
    authWin.loadURL(`${KITE_LOGIN_BASE}?api_key=${encodeURIComponent(apiKey)}&v=3`)
  })
})

ipcMain.handle('kite:exchange-token', async (_e, { apiKey, apiSecret, requestToken }) => {
  const checksum = crypto
    .createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex')
  const body = formEncode({ api_key: apiKey, request_token: requestToken, checksum })
  const json = await kiteFetch('/session/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = json.data
  const sess = {
    apiKey,
    apiSecret,
    accessToken: data.access_token,
    publicToken: data.public_token,
    userId: data.user_id,
    userName: data.user_name,
    email: data.email,
    loginTime: data.login_time,
    savedAt: new Date().toISOString(),
  }
  writeSession(sess)
  return sess
})

ipcMain.handle('kite:save-session', (_e, payload) => {
  writeSession(payload)
  return true
})

// ---------- IPC: generic REST ----------

ipcMain.handle('kite:request', async (_e, { method = 'GET', path: reqPath, query, form, json }) => {
  const sess = readSession()
  if (!sess?.accessToken) throw new Error('Not authenticated')
  let url = reqPath
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)))
      else if (v !== undefined && v !== null) qs.append(k, String(v))
    }
    url += (url.includes('?') ? '&' : '?') + qs.toString()
  }
  const headers = { ...authHeader(sess.apiKey, sess.accessToken) }
  let body
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = formEncode(form)
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }
  return kiteFetch(url, { method, headers, body })
})

// ---------- IPC: instruments dump ----------

ipcMain.handle('kite:fetch-instruments', async (_e, { exchange } = {}) => {
  const sess = readSession()
  if (!sess?.accessToken) throw new Error('Not authenticated')
  fs.mkdirSync(INSTRUMENTS_DIR, { recursive: true })
  const cacheFile = path.join(INSTRUMENTS_DIR, `${exchange || 'all'}.csv`)
  const stat = fs.existsSync(cacheFile) ? fs.statSync(cacheFile) : null
  const fresh = stat && Date.now() - stat.mtimeMs < 12 * 60 * 60 * 1000
  let csv
  if (fresh) {
    csv = fs.readFileSync(cacheFile, 'utf8')
  } else {
    const url = `${KITE_API_BASE}/instruments${exchange ? '/' + exchange : ''}`
    const res = await fetch(url, { headers: authHeader(sess.apiKey, sess.accessToken) })
    if (!res.ok) throw new Error(`Instruments fetch failed: HTTP ${res.status}`)
    csv = await res.text()
    fs.writeFileSync(cacheFile, csv)
  }
  return parseInstruments(csv)
})

function parseInstruments(csv) {
  const lines = csv.split('\n')
  if (lines.length === 0) return []
  const header = lines[0].split(',')
  const idx = (name) => header.indexOf(name)
  const tokenI = idx('instrument_token')
  const symI = idx('tradingsymbol')
  const exI = idx('exchange')
  const segI = idx('segment')
  const nameI = idx('name')
  const expI = idx('expiry')
  const strikeI = idx('strike')
  const tickI = idx('tick_size')
  const lotI = idx('lot_size')
  const typeI = idx('instrument_type')
  const out = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cols = line.split(',')
    const token = Number(cols[tokenI])
    if (!token) continue
    out.push({
      instrumentToken: token,
      tradingsymbol: cols[symI],
      exchange: cols[exI],
      segment: cols[segI],
      name: cols[nameI],
      expiry: cols[expI] || null,
      strike: cols[strikeI] ? Number(cols[strikeI]) : 0,
      tickSize: cols[tickI] ? Number(cols[tickI]) : 0,
      lotSize: cols[lotI] ? Number(cols[lotI]) : 0,
      instrumentType: cols[typeI],
    })
  }
  return out
}

ipcMain.handle('kite:open-external', async (_e, url) => {
  const { shell } = require('electron')
  await shell.openExternal(url)
  return true
})
