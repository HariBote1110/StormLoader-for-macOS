const { app, Menu } = require('electron');
const { readStore, writeStore } = require('./store');

function switchLanguage(locale) {
    const store = readStore();
    store.locale = locale;
    writeStore(store);
    app.relaunch();
    app.exit();
}

function createMenu(translations) {
    const store = readStore();
    const locale = store.locale || app.getLocale().split('-')[0];
    
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

module.exports = { createMenu };