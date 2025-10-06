const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  setGameDirectory: () => ipcRenderer.invoke('set-game-directory'),
  addMod: () => ipcRenderer.invoke('add-mod'),
  toggleModActive: (modName, isActive) => ipcRenderer.invoke('toggle-mod-active', { modName, isActive }),
  backupRom: () => ipcRenderer.invoke('backup-rom'),
  onShowLoading: (callback) => ipcRenderer.on('show-loading', (event, message) => callback(message)),
  onHideLoading: (callback) => ipcRenderer.on('hide-loading', () => callback())
});