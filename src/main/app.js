const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipcHandlers');
const { readStore, writeStore } = require('./store');
const { autoUpdater } = require("electron-updater"); // autoUpdaterを追加

let mainWindow;
let translations;

// 言語ファイルの読み込み関数
const loadTranslations = (lang) => {
  const langPath = path.join(__dirname, `../../locales/${lang}.json`);
  return require(langPath);
};

// アプリケーションが準備完了になったらウィンドウを作成
app.on('ready', async () => {
  const store = readStore();
  let currentLang = store.settings?.language || 'ja'; // デフォルトは日本語
  translations = loadTranslations(currentLang);

  // set the default values if they are not set.
  if (!store.settings) {
    store.settings = {
      language: 'ja'
    };
    writeStore(store);
  }

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, '../../build/icon.png') // アプリケーションアイコンを設定
  });

  mainWindow.loadFile(path.join(__dirname, '../../index.html'));

  // アプリケーションが開発モードの場合のみDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  registerIpcHandlers(mainWindow, translations);
  createAppMenu();

  // autoUpdater.checkForUpdatesAndNotify(); // アプリ起動時に自動更新チェック
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    app.whenReady().then(createWindow);
  }
});

// 言語メニューアイテムを動的に生成するヘルパー関数
const createLanguageMenuItem = (langCode, langName) => {
  return {
    label: langName,
    type: 'radio',
    checked: readStore().settings?.language === langCode,
    click: () => {
      const store = readStore();
      if (!store.settings) store.settings = {};
      store.settings.language = langCode;
      writeStore(store);
      translations = loadTranslations(langCode); // 新しい言語を読み込む
      mainWindow.reload(); // ウィンドウをリロードしてUIを更新
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
        createLanguageMenuItem('en', translations.MENU_ENGLISH || 'English'),
        createLanguageMenuItem('ja', translations.MENU_JAPANESE || 'Japanese')
      ]
    },
    {
      label: '表示',
      submenu: [
        { role: 'reload', label: '再読み込み' },
        { role: 'forcereload', label: '強制再読み込み' },
        // 開発環境でのみDevToolsを表示
        process.env.NODE_ENV === 'development' ? { role: 'toggledevtools', label: '開発者ツールを切り替え' } : { visible: false },
        { type: 'separator' },
        { role: 'resetzoom', label: '実際のサイズ' },
        { role: 'zoomin', label: '拡大' },
        { role: 'zoomout', label: '縮小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'フルスクリーンを切り替え' }
      ]
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

  const menu = Menu.buildFromTemplate(menuTemplate.filter(item => item !== null)); // null要素をフィルタリング
  Menu.setApplicationMenu(menu);
}