const { app, ipcMain, dialog, shell, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const { parseStringPromise } = require('xml2js');
const { readStore, writeStore } = require('./store');
const { rebuildRomFromActiveMods, backupRom, getRomPath } = require('./modService');

function registerIpcHandlers(translations) {
  ipcMain.handle('get-initial-data', async () => {
    const store = readStore();
    if (store.gameDirectory) {
        store.romPath = getRomPath(store.gameDirectory);
    }
    return { store, translations };
  });

  ipcMain.handle('backup-rom', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return backupRom(window, translations);
  });
  
  ipcMain.handle('set-game-directory', async (event) => {
    let romPath;
    let appPath;
    const window = BrowserWindow.fromWebContents(event.sender);

    if (process.platform === 'darwin') {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Stormworks.app',
        properties: ['openFile']
      });
      if (canceled || filePaths.length === 0) return { success: false };
      appPath = filePaths[0];
      if (!appPath.endsWith('.app')) {
          dialog.showErrorBox('Invalid File', 'Please select the Stormworks.app file.');
          return { success: false };
      }
      romPath = path.join(appPath, 'Contents', 'Resources', 'rom');
    } else { // Windows or other platforms
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: translations.SELECT_GAME_FOLDER,
        properties: ['openDirectory']
      });
      if (canceled || filePaths.length === 0) return { success: false };
      appPath = filePaths[0];
      romPath = path.join(appPath, 'rom');
    }

    if (!(await fs.pathExists(romPath))) {
      dialog.showErrorBox('Directory Not Found', `Could not find 'rom' directory.\nChecked path: ${romPath}`);
      return { success: false };
    }

    const store = readStore();
    store.gameDirectory = appPath;
    writeStore(store);

    await backupRom(window, translations);

    return { success: true, path: romPath };
  });

  ipcMain.handle('add-mod', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ title: 'Select .slp file', filters: [{ name: 'StormLoader Package', extensions: ['slp', 'zip'] }], properties: ['openFile'] });
    if (canceled || filePaths.length === 0) return { success: false, message: 'File selection was canceled.' };
    
    const filePath = filePaths[0];
    const modName = path.basename(filePath, path.extname(filePath));
    const modsDir = path.join(app.getPath('userData'), 'mods');
    const extractPath = path.join(modsDir, modName);
    try {
      const tempExtractPath = path.join(modsDir, `__temp_${modName}`);
      await fs.ensureDir(tempExtractPath);
      const zip = new AdmZip(filePath);
      zip.extractAllTo(tempExtractPath, true);
      const files = await fs.readdir(tempExtractPath);
      let modRootPath = tempExtractPath;
      if (files.length === 1 && (await fs.stat(path.join(tempExtractPath, files[0]))).isDirectory()) { modRootPath = path.join(tempExtractPath, files[0]); }
      await fs.ensureDir(extractPath);
      await fs.copy(modRootPath, extractPath);
      await fs.remove(tempExtractPath);
      const metadataPath = path.join(extractPath, 'Metadata.xml');
      let author = 'Unknown', version = 'Unknown';
      if (await fs.pathExists(metadataPath)) {
        const xmlData = await fs.readFile(metadataPath, 'utf8');
        const parsedData = await parseStringPromise(xmlData);
        author = parsedData.Metadata.Author[0];
        version = parsedData.Metadata.Version[0];
      }
      const modInfo = { name: modName, path: extractPath, author: author, version: version, active: false };
      const store = readStore();
      if (!store.mods) store.mods = [];
      const existingIndex = store.mods.findIndex(m => m.name === modName);
      if (existingIndex > -1) { store.mods[existingIndex] = modInfo; } else { store.mods.push(modInfo); }
      writeStore(store);
      return { success: true, mod: modInfo };
    } catch (error) {
      console.error(`Failed to process mod: ${error}`);
      return { success: false, message: `Failed to process: ${error.message}` };
    }
  });

  ipcMain.handle('delete-mod', async (event, modName) => {
    if (!modName) return { success: false, message: 'Invalid mod name provided.' };
  
    const store = readStore();
    if (!store.mods) {
      return { success: false, message: 'No mods found in store.' };
    }
  
    const modToDelete = store.mods.find(m => m.name === modName);
    if (!modToDelete) {
      return { success: false, message: `Mod '${modName}' not found.` };
    }
  
    try {
      // Delete mod files from the management directory
      const modPath = modToDelete.path;
      if (await fs.pathExists(modPath)) {
        await fs.remove(modPath);
        console.log(`Deleted mod files from: ${modPath}`);
      }
  
      // Remove mod info from store.json
      store.mods = store.mods.filter(m => m.name !== modName);
      writeStore(store);
      
      const message = (translations.MOD_DELETE_SUCCESS || "Mod '{modName}' has been deleted successfully.").replace('{modName}', modName);
      return { success: true, message: message };
    } catch (error) {
      console.error(`Failed to delete mod '${modName}':`, error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('save-playlist', async (event, name, activeStates) => {
    if (!name) return { success: false, message: 'Playlist name cannot be empty.' };
    const store = readStore();
    if (!store.playlists) store.playlists = {};
    store.playlists[name] = activeStates;
    writeStore(store);
    return { success: true, message: translations.PLAYLIST_SAVE_SUCCESS };
  });

  ipcMain.handle('load-playlist', async (event, name) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    try {
        const store = readStore();
        const playlist = store.playlists[name];
        if (!playlist) return { success: false, message: `Playlist '${name}' not found.`};

        (store.mods || []).forEach(mod => {
            mod.active = playlist[mod.name] || false;
        });
        writeStore(store);

        await rebuildRomFromActiveMods(window, translations);

        const updatedStore = readStore();
        return { success: true, mods: updatedStore.mods, message: translations.PLAYLIST_LOAD_SUCCESS };
    } catch (error) {
        console.error('Failed to load playlist:', error);
        return { success: false, message: error.message };
    } finally {
        if(window && !window.isDestroyed()) window.webContents.send('hide-loading');
    }
  });

  ipcMain.handle('rename-playlist', async (event, { oldName, newName }) => {
    if (!oldName || !newName) return { success: false, message: 'Invalid names provided.' };
    const store = readStore();
    if (store.playlists && store.playlists[oldName]) {
        if (store.playlists[newName]) {
            return { success: false, message: `Playlist '${newName}' already exists.` };
        }
        store.playlists[newName] = store.playlists[oldName];
        delete store.playlists[oldName];
        writeStore(store);
        return { success: true, message: translations.PLAYLIST_RENAME_SUCCESS };
    }
    return { success: false, message: 'Playlist not found.' };
  });

  ipcMain.handle('delete-playlist', async (event, name) => {
    if (!name) return { success: false, message: 'Invalid name provided.' };
    const store = readStore();
    if (store.playlists && store.playlists[name]) {
        delete store.playlists[name];
        writeStore(store);
        return { success: true, message: translations.PLAYLIST_DELETE_SUCCESS };
    }
    return { success: false, message: 'Playlist not found.' };
  });

  ipcMain.handle('overwrite-playlist', async (event, name, activeStates) => {
    if (!name) return { success: false, message: 'No playlist selected.' };
    const store = readStore();
    if (!store.playlists || !store.playlists[name]) {
        return { success: false, message: 'Playlist not found.' };
    }
    store.playlists[name] = activeStates;
    writeStore(store);
    return { success: true, message: translations.PLAYLIST_OVERWRITE_SUCCESS };
  });

  ipcMain.handle('set-last-selected-playlist', (event, name) => {
    const store = readStore();
    store.selectedPlaylist = name;
    writeStore(store);
    return { success: true };
  });
  ipcMain.handle('switch-language', (event, locale) => {
    const store = readStore();
    if (!store.settings) store.settings = {};
    store.settings.language = locale;
    writeStore(store);
    app.relaunch();
    app.quit();
  });
  ipcMain.handle('apply-mod-changes', async (event, activeStates) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    try {
        const store = readStore();
        if (!store.mods) return { success: false, message: 'No mods found.' };

        store.mods.forEach(mod => {
            mod.active = activeStates[mod.name] || false;
        });
        writeStore(store);

        await rebuildRomFromActiveMods(window, translations);
        
        return { success: true };

    } catch (error) {
        console.error('Failed to apply changes:', error);
        return { success: false, message: error.message };
    } finally {
        if(window && !window.isDestroyed()) window.webContents.send('hide-loading');
    }
  });
}

module.exports = { registerIpcHandlers };