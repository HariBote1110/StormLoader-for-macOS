const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { readStore, writeStore } = require('./store');

const vanillaRomBackupPath = path.join(app.getPath('userData'), 'vanilla_rom_backup');

function getRomPath(gameDirectory) {
    if (!gameDirectory) return null;

    // Guard: If the path already seems to be the 'rom' path, just return it.
    if (path.basename(gameDirectory) === 'rom') {
        console.warn(`[Mod Service] getRomPath was called with a path that already ends in 'rom': ${gameDirectory}`);
        return gameDirectory;
    }

    if (process.platform === 'darwin') { // macOS
        return path.join(gameDirectory, 'Contents', 'Resources', 'rom');
    }
    // Windows and other platforms
    return path.join(gameDirectory, 'rom');
}

async function installMod(mod, romPath) {
    console.log(`[Mod Service] Installing mod: ${mod.name}`);
    const installedFiles = [];
    const modFolders = ['Meshes', 'Definitions', 'Audio', 'Graphics', 'Data'];

    for (const folder of modFolders) {
        const sourceDir = path.join(mod.path, folder);
        if (await fs.pathExists(sourceDir)) {
            const destDir = path.join(romPath, folder.toLowerCase());
            await fs.ensureDir(destDir);
            
            try {
                // Copy all contents from sourceDir to destDir
                await fs.copy(sourceDir, destDir, { overwrite: true });
                console.log(`[Mod Service] Copied contents of '${sourceDir}' to '${destDir}'`);
                
                // Log the files that were installed
                const files = await fs.readdir(sourceDir);
                for (const file of files) {
                    installedFiles.push(path.join(destDir, file));
                }
            } catch (error) {
                console.error(`[Mod Service] Error copying folder '${folder}' for mod '${mod.name}':`, error);
                // Optionally, throw the error to stop the entire process
                throw error;
            }
        }
    }
    return installedFiles;
}

async function rebuildRomFromActiveMods(mainWindow, translations) {
    const store = readStore();
    console.log(`[Mod Service] Reading gameDirectory from store: ${store.gameDirectory}`);
    const romPath = getRomPath(store.gameDirectory);

    if (!romPath) {
        const errorMsg = "Game directory is not set.";
        console.error(`[Mod Service] ${errorMsg}`);
        throw new Error(errorMsg);
    }
    if (!(await fs.pathExists(vanillaRomBackupPath))) {
        const errorMsg = 'Vanilla ROM backup not found.';
        console.error(`[Mod Service] ${errorMsg}`);
        throw new Error(errorMsg);
    }
    
    console.log('[Mod Service] Starting ROM rebuild process...');
    mainWindow.webContents.send('show-loading', translations.RESTORING_AND_REAPPLYING);

    try {
        console.log(`[Mod Service] Clearing ROM directory: ${romPath}`);
        await fs.emptyDir(romPath);

        console.log(`[Mod Service] Restoring vanilla ROM from backup: ${vanillaRomBackupPath}`);
        await fs.copy(vanillaRomBackupPath, romPath);

        store.installedFiles = {};
        const activeMods = (store.mods || []).filter(m => m.active);
        console.log(`[Mod Service] Found ${activeMods.length} active mods to install.`);

        for (const activeMod of activeMods) {
            const installedFiles = await installMod(activeMod, romPath);
            store.installedFiles[activeMod.name] = installedFiles;
        }
        
        writeStore(store);
        console.log('[Mod Service] Successfully rebuilt ROM from active mods.');
    } catch (error) {
        console.error('[Mod Service] An error occurred during ROM rebuild:', error);
        // Propagate error to be caught in ipcHandler
        throw error;
    }
}

async function backupRom(mainWindow, translations) {
    const store = readStore();
    const romPath = getRomPath(store.gameDirectory);

    if (!romPath || !(await fs.pathExists(romPath))) {
        dialog.showErrorBox(translations.ERROR, translations.NOT_SET);
        return { success: false, message: 'Game directory not set.' };
    }

    try {
        console.log('[Mod Service] Starting vanilla ROM backup...');
        mainWindow.webContents.send('show-loading', translations.BACKING_UP);
        await fs.emptyDir(vanillaRomBackupPath);
        await fs.copy(romPath, vanillaRomBackupPath);
        console.log('[Mod Service] ROM backup successful.');
        dialog.showMessageBox({ type: 'info', title: translations.SUCCESS, message: translations.ROM_BACKUP_SUCCESS });
        return { success: true };
    } catch (error) {
        console.error('[Mod Service] Failed to backup ROM:', error);
        dialog.showErrorBox(translations.ERROR, error.message);
        return { success: false, message: error.message };
    } finally {
        if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('hide-loading');
    }
}

module.exports = { installMod, rebuildRomFromActiveMods, backupRom, getRomPath };