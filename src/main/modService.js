const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { readStore, writeStore } = require('./store');

const vanillaRomBackupPath = path.join(app.getPath('userData'), 'vanilla_rom_backup');

function getRomPath(gameDirectory) {
    if (!gameDirectory) return null;
    if (process.platform === 'darwin') {
        return path.join(gameDirectory, 'Contents', 'Resources', 'rom');
    }
    return path.join(gameDirectory, 'rom');
}

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

async function rebuildRomFromActiveMods(mainWindow, translations) {
    const store = readStore();
    const romPath = getRomPath(store.gameDirectory);

    if (!romPath) throw new Error("Game directory is not set.");
    if (!(await fs.pathExists(vanillaRomBackupPath))) throw new Error('Vanilla ROM backup not found.');

    mainWindow.webContents.send('show-loading', translations.RESTORING_AND_REAPPLYING);

    await fs.emptyDir(romPath);
    await fs.copy(vanillaRomBackupPath, romPath);

    store.installedFiles = {};
    for (const activeMod of (store.mods || []).filter(m => m.active)) {
        const installedFiles = await installMod(activeMod, romPath);
        store.installedFiles[activeMod.name] = installedFiles;
    }
    
    writeStore(store);
    console.log('Successfully rebuilt ROM from active mods.');
}

async function backupRom(mainWindow, translations) {
    const store = readStore();
    const romPath = getRomPath(store.gameDirectory);

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
}

module.exports = { installMod, rebuildRomFromActiveMods, backupRom, getRomPath };