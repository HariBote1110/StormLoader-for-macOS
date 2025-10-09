import { initializeUI } from './ui.js';
import { setupEventListeners } from './eventHandlers.js';

window.addEventListener('DOMContentLoaded', async () => {
    const { store, translations } = await window.electronAPI.getInitialData();
    const platform = await window.electronAPI.getPlatform();
    const version = await window.electronAPI.getAppVersion();
    
    document.getElementById('version-display').textContent = `v${version}`;

    initializeUI(translations, store, platform);
    setupEventListeners(translations);
});