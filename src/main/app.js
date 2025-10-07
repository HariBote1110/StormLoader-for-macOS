const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { registerIpcHandlers } = require('./ipcHandlers');
const { readStore, writeStore } = require('./store');

let mainWindow;
let translations;

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

const createLanguageMenuItem = (langCode, langName) => {
  return {
    label: langName,
    type: 'radio',
    checked: (readStore().settings?.language || 'ja') === langCode,
    click: () => {
      const store = readStore();
      if (!store.settings) store.settings = {};
      store.settings.language = langCode;
      writeStore(store);
      app.relaunch();
      app.exit();
    }
  };
};

function createAppMenu() {
    const menuTemplate = [
      {
        label: app.name,
        submenu: [
          { role: 'about', label: translations.MENU_ABOUT || 'About' },
          { type: 'separator' },
          { role: 'services', label: 'サービス' },
          { type: 'separator' },
          { role: 'hide', label: 'StormLoaderを隠す' },
          { role: 'hideOthers', label: 'ほかを隠す' },
          { role: 'unhide', label: 'すべてを表示' },
          { type: 'separator' },
          { role: 'quit', label: 'StormLoaderを終了' }
        ]
      },
      {
        label: translations.MENU_EDIT || 'Edit',
        submenu: [
          { role: 'undo', label: '取り消す' },
          { role: 'redo', label: 'やり直す' },
          { type: 'separator' },
          { role: 'cut', label: 'カット' },
          { role: 'copy', label: 'コピー' },
          { role: 'paste', label: 'ペースト' },
          { role: 'selectAll', label: 'すべて選択' }
        ]
      },
      {
        label: translations.MENU_LANGUAGE || 'Language',
        submenu: [
            createLanguageMenuItem('en', 'English'),
            createLanguageMenuItem('ja', '日本語')
        ]
      },
      {
        label: '表示',
        submenu: [
          { role: 'reload', label: '再読み込み' },
          { role: 'forcereload', label: '強制再読み込み' },
          (process.env.NODE_ENV === 'development' ? { role: 'toggledevtools', label: '開発者ツールを切り替え' } : null),
          { type: 'separator' },
          { role: 'resetzoom', label: '実際のサイズ' },
          { role: 'zoomin', label: '拡大' },
          { role: 'zoomout', label: '縮小' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'フルスクリーンを切り替え' }
        ].filter(Boolean)
      },
      {
        label: 'ウィンドウ',
        submenu: [
          { role: 'minimize', label: '最小化' },
          { role: 'zoom', label: 'ズーム' },
          { type: 'separator' },
          { role: 'front', label: 'すべて手前に移動' }
        ]
      },
      {
        label: 'ヘルプ',
        submenu: [
          {
            label: 'GitHub',
            click: async () => {
              await shell.openExternal('https://github.com/haribote1110/stormloader-for-macos');
            }
          }
        ]
      }
    ];
  
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}


async function createWindow () {
  const store = readStore();
  let currentLang = store.settings?.language || 'ja';
  translations = await loadTranslations(currentLang);

  if (!store.settings) {
    store.settings = { language: 'ja' };
    writeStore(store);
  }

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(app.getAppPath(), 'build/icon.png')
  });

  mainWindow.loadFile(path.join(app.getAppPath(), 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  registerIpcHandlers(mainWindow, translations);
  createAppMenu();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});