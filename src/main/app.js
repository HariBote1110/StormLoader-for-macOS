const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { createMenu } = require('./menu');
const { registerIpcHandlers } = require('./ipcHandlers');
const { readStore } = require('./store');

let mainWindow;

async function loadTranslations(locale) {
  try {
    const filePath = path.join(app.getAppPath(), 'locales', `${locale}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Could not load translations for ${locale}, falling back to English.`);
    const fallbackPath = path.join(app.getAppPath(), 'locales', 'en.json');
    const data = await fs.readFile(fallbackPath, 'utf8');
    return JSON.parse(data);
  }
}

async function createWindow() {
  const store = readStore();
  const locale = store.locale || app.getLocale().split('-')[0];
  const translations = await loadTranslations(locale);

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.webContents.openDevTools();

  createMenu(translations);
  registerIpcHandlers(mainWindow, translations);
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });