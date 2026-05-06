const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ultfox', {
  meta: () => ipcRenderer.invoke('app:meta'),
  verifyAdmin: (password) => ipcRenderer.invoke('admin:verify', password),
  generateKey: (payload) => ipcRenderer.invoke('key:generate', payload),
  redeemKey: (key) => ipcRenderer.invoke('key:redeem', key),
  revokeKey: (payload) => ipcRenderer.invoke('key:revoke', payload),
  storeSummary: (password) => ipcRenderer.invoke('store:summary', password),
  redeemedHistory: () => ipcRenderer.invoke('redeemed:list'),
  openMail: (url) => ipcRenderer.invoke('shell:open-mail', url),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});
