const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  setGameDirectory: () => ipcRenderer.invoke('set-game-directory'),
  addMod: () => ipcRenderer.invoke('add-mod'),
  backupRom: () => ipcRenderer.invoke('backup-rom'),
  savePlaylist: (name, activeStates) => ipcRenderer.invoke('save-playlist', name, activeStates),
  loadPlaylist: (name) => ipcRenderer.invoke('load-playlist', name),
  renamePlaylist: (oldName, newName) => ipcRenderer.invoke('rename-playlist', { oldName, newName }),
  deletePlaylist: (name) => ipcRenderer.invoke('delete-playlist', name),
  overwritePlaylist: (name, activeStates) => ipcRenderer.invoke('overwrite-playlist', name, activeStates),
  setLastSelectedPlaylist: (name) => ipcRenderer.invoke('set-last-selected-playlist', name),
  launchGame: () => ipcRenderer.invoke('launch-game'),
  applyModChanges: (activeStates) => ipcRenderer.invoke('apply-mod-changes', activeStates),
  onShowLoading: (callback) => ipcRenderer.on('show-loading', (event, message) => callback(message)),
  onHideLoading: (callback) => ipcRenderer.on('hide-loading', () => callback())
});