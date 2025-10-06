import { initializeUI } from './ui.js';
import { setupEventListeners } from './eventHandlers.js';

window.addEventListener('DOMContentLoaded', async () => {
    const { store, translations } = await window.electronAPI.getInitialData();
    
    initializeUI(translations, store);
    setupEventListeners(translations);
});