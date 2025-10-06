const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const { parseStringPromise } = require('xml2js');

// --- アプリケーション設定の保存場所を定義 ---
const storePath = path.join(app.getPath('userData'), 'store.json');
const vanillaRomBackupPath = path.join(app.getPath('userData'), 'vanilla_rom_backup');

// --- i18n (国際化) 関連の処理 ---
let translations = {};

async function loadTranslations(locale) {
  try {
    const filePath = path.join(__dirname, 'locales', `${locale}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    translations = JSON.parse(data);
    return translations;
  } catch (error) {
    console.warn(`Could not load translations for ${locale}, falling back to English.`);
    const fallbackPath = path.join(__dirname, 'locales', 'en.json');
    const data = await fs.readFile(fallbackPath, 'utf8');
    translations = JSON.parse(data);
    return translations;
  }
}

// --- 設定ファイルの読み書き ---
async function readStore() {
  try {
    await fs.ensureFile(storePath);
    const data = await fs.readFile(storePath, 'utf8');
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to read store:', error);
    return {};
  }
}

async function writeStore(data) {
  try {
    await fs.writeFile(storePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to write store:', error);
  }
}

let mainWindow;

async function createWindow() {
  const store = await readStore();
  const locale = store.locale || app.getLocale().split('-')[0];
  await loadTranslations(locale);

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  const menuTemplate = [
    {
      label: translations.MENU_LANGUAGE || 'Language',
      submenu: [
        { label: translations.MENU_ENGLISH || 'English', type: 'radio', checked: locale === 'en', click: () => switchLanguage('en') },
        { label: translations.MENU_JAPANESE || 'Japanese', type: 'radio', checked: locale === 'ja', click: () => switchLanguage('ja') }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

async function switchLanguage(locale) {
    const store = await readStore();
    store.locale = locale;
    await writeStore(store);
    app.relaunch();
    app.exit();
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });


// --- ヘルパー関数 ---
async function installMod(mod, romPath) {
    console.log(`Installing mod: ${mod.name}`);
    const installedFiles = [];
    const modFolders = ['Meshes', 'Definitions', 'Audio', 'Graphics', 'Data'];

    for (const folder of modFolders) {
        const sourceDir = path.join(mod.path, folder);
        if (await fs.pathExists(sourceDir)) {
            const destDir = path.join(romPath, folder.toLowerCase());
            await fs.ensureDir(destDir);
            
            const filesToCopy = await fs.readdir(sourceDir);
            for (const file of filesToCopy) {
                const srcFile = path.join(sourceDir, file);
                const destFile = path.join(destDir, file);
                await fs.copy(srcFile, destFile, { overwrite: true });
                installedFiles.push(destFile);
            }
        }
    }
    return installedFiles;
}

// --- IPCハンドラ ---
ipcMain.handle('get-initial-data', async () => {
    const store = await readStore();
    return { store, translations };
});

ipcMain.handle('backup-rom', async () => {
    const store = await readStore();
    const romPath = store.gameDirectory;

    if (!romPath || !(await fs.pathExists(romPath))) {
        dialog.showErrorBox(translations.ERROR, translations.NOT_SET);
        return { success: false, message: 'Game directory not set.' };
    }

    try {
        mainWindow.webContents.send('show-loading', translations.BACKING_UP);
        await fs.emptyDir(vanillaRomBackupPath);
        await fs.copy(romPath, vanillaRomBackupPath);
        dialog.showMessageBox({ type: 'info', title: translations.SUCCESS, message: translations.ROM_BACKUP_SUCCESS });
        return { success: true };
    } catch (error) {
        console.error('Failed to backup ROM:', error);
        dialog.showErrorBox(translations.ERROR, error.message);
        return { success: false, message: error.message };
    } finally {
        mainWindow.webContents.send('hide-loading');
    }
});

ipcMain.handle('set-game-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Stormworks.app',
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return { success: false };
  
  const appPath = filePaths[0];
  const romPath = path.join(appPath, 'Contents', 'Resources', 'rom');

  if (!(await fs.pathExists(romPath))) {
    dialog.showErrorBox('Directory Not Found', `Could not find 'rom' directory.\nChecked path: ${romPath}`);
    return { success: false };
  }

  const store = await readStore();
  store.gameDirectory = romPath;
  await writeStore(store);

  await ipcMain.handle('backup-rom');

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
    const store = await readStore();
    if (!store.mods) store.mods = [];
    const existingIndex = store.mods.findIndex(m => m.name === modName);
    if (existingIndex > -1) { store.mods[existingIndex] = modInfo; } else { store.mods.push(modInfo); }
    await writeStore(store);
    return { success: true, mod: modInfo };
  } catch (error) {
    console.error(`Failed to process mod: ${error}`);
    return { success: false, message: `Failed to process: ${error.message}` };
  }
});


ipcMain.handle('toggle-mod-active', async (event, { modName, isActive }) => {
    const store = await readStore();
    const mod = store.mods.find(m => m.name === modName);
    if (!mod) return { success: false, message: "Mod not found." };
    const romPath = store.gameDirectory;
    if (!romPath) return { success: false, message: "Game directory is not set." };

    if (!store.installedFiles) store.installedFiles = {};

    try {
        mod.active = isActive;

        if (isActive) {
            const loadingMsg = (translations.ACTIVATING_MOD || "Activating {modName}...").replace('{modName}', modName);
            mainWindow.webContents.send('show-loading', loadingMsg);
            const installedFiles = await installMod(mod, romPath);
            store.installedFiles[modName] = installedFiles;
            
        } else {
            mainWindow.webContents.send('show-loading', translations.RESTORING_AND_REAPPLYING || "Restoring...");
            
            if (!(await fs.pathExists(vanillaRomBackupPath))) {
                throw new Error('Vanilla ROM backup not found. Please set game directory again.');
            }
            await fs.emptyDir(romPath);
            await fs.copy(vanillaRomBackupPath, romPath);

            store.installedFiles = {};
            for (const activeMod of store.mods.filter(m => m.active)) {
                const installedFiles = await installMod(activeMod, romPath);
                store.installedFiles[activeMod.name] = installedFiles;
            }
        }

        await writeStore(store);
        
        let successMessage = "";
        if (!isActive) {
            successMessage = translations.MOD_DEACTIVATED_SUCCESS || "Mod deactivated.";
        }
        
        return { success: true, message: successMessage };

    } catch (error) {
        console.error(`Failed to toggle mod: ${error}`);
        mod.active = !isActive;
        await writeStore(store);
        return { success: false, message: error.message };
    } finally {
        mainWindow.webContents.send('hide-loading');
    }
});