const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform: () => process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  switchLanguage: (locale) => ipcRenderer.invoke('switch-language', locale),
  setGameDirectory: () => ipcRenderer.invoke('set-game-directory'),
  autoDetectPath: () => ipcRenderer.invoke('auto-detect-path'), // ★ 追加
  launchGame: () => ipcRenderer.invoke('launch-game'), // ★ 追加
  addMod: () => ipcRenderer.invoke('add-mod'),
  deleteMod: (modName) => ipcRenderer.invoke('delete-mod', modName),
  backupRom: () => ipcRenderer.invoke('backup-rom'),
  savePlaylist: (name, activeStates) => ipcRenderer.invoke('save-playlist', name, activeStates),
  loadPlaylist: (name) => ipcRenderer.invoke('load-playlist', name),
  renamePlaylist: (oldName, newName) => ipcRenderer.invoke('rename-playlist', { oldName, newName }),
  deletePlaylist: (name) => ipcRenderer.invoke('delete-playlist', name),
  overwritePlaylist: (name, activeStates) => ipcRenderer.invoke('overwrite-playlist', name, activeStates),
  setLastSelectedPlaylist: (name) => ipcRenderer.invoke('set-last-selected-playlist', name),
  applyModChanges: (activeStates) => ipcRenderer.invoke('apply-mod-changes', activeStates),
  generateShareString: (activeMods) => ipcRenderer.invoke('generate-share-string', activeMods),
  importShareString: (shareString) => ipcRenderer.invoke('import-share-string', shareString),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  onShowLoading: (callback) => ipcRenderer.on('show-loading', (event, message) => callback(message)),
  onHideLoading: (callback) => ipcRenderer.on('hide-loading', () => callback())
});