const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kite', {
  getConfig: () => ipcRenderer.invoke('kite:get-config'),
  getSession: () => ipcRenderer.invoke('kite:get-session'),
  logout: () => ipcRenderer.invoke('kite:logout'),
  login: (params) => ipcRenderer.invoke('kite:login', params),
  exchangeToken: (params) => ipcRenderer.invoke('kite:exchange-token', params),
  saveSession: (payload) => ipcRenderer.invoke('kite:save-session', payload),
  request: (params) => ipcRenderer.invoke('kite:request', params),
  fetchInstruments: (params) => ipcRenderer.invoke('kite:fetch-instruments', params),
  openExternal: (url) => ipcRenderer.invoke('kite:open-external', url),
  saveWatchlistsExport: (payload) => ipcRenderer.invoke('kite:save-watchlists-export', payload),
  onMockFeedControl: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('mock-feed:control', listener)
    return () => ipcRenderer.removeListener('mock-feed:control', listener)
  },
})
