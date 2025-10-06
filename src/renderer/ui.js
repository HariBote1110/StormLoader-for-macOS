// DOM要素の取得
export const elements = {
    addModBtn: document.getElementById('add-mod-btn'),
    setGameDirBtn: document.getElementById('set-game-dir-btn'),
    backupRomBtn: document.getElementById('backup-rom-btn'),
    gameDirContainer: document.getElementById('game-dir-container'),
    gameDirDisplay: document.getElementById('game-dir-display'),
    modList: document.getElementById('mod-list'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingMessage: document.getElementById('loading-message'),
    playlistSelect: document.getElementById('playlist-select'),
    loadPlaylistBtn: document.getElementById('load-playlist-btn'),
    savePlaylistBtn: document.getElementById('save-playlist-btn'),
    newPlaylistNameInput: document.getElementById('new-playlist-name'),
    renamePlaylistBtn: document.getElementById('rename-playlist-btn'),
    deletePlaylistBtn: document.getElementById('delete-playlist-btn'),
    overwritePlaylistBtn: document.getElementById('overwrite-playlist-btn'),
    launchGameBtn: document.getElementById('launch-game-btn'),
    applyChangesBtn: document.getElementById('apply-changes-btn'),
    pendingIndicator: document.getElementById('pending-indicator'),
};

export function applyTranslations(translations) {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (translations[key]) el.textContent = translations[key];
    });
    document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
        const key = el.getAttribute('data-lang-placeholder');
        if (translations[key]) el.placeholder = translations[key];
    });
    document.querySelectorAll('[data-lang-default]').forEach(el => {
        const currentText = el.textContent.trim();
        if (!currentText || currentText === 'Not set' || currentText === '未設定') {
            const key = el.getAttribute('data-lang-default');
            if (translations[key]) el.textContent = translations[key];
        }
    });
    document.title = translations.APP_TITLE || 'StormLoader for macOS';
}

export function addModToList(mod, translations) {
    const li = document.createElement('li');
    li.dataset.modName = mod.name;
    const modDetails = `<div><strong>${mod.name}</strong><br><small>${translations.AUTHOR}: ${mod.author} | ${translations.VERSION}: ${mod.version}</small></div>`;
    const toggleSwitch = `<label class="switch"><input type="checkbox" ${mod.active ? 'checked' : ''}><span class="slider"></span></label>`;
    li.innerHTML = modDetails + toggleSwitch;

    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
        updatePendingState(true);
    });
    
    elements.modList.appendChild(li);
}

export function refreshModListUI(mods, translations) {
    elements.modList.innerHTML = '';
    if (mods) {
        mods.forEach(mod => addModToList(mod, translations));
    }
}

export function refreshPlaylistUI(playlists, selected) {
    const currentSelection = elements.playlistSelect.value;
    elements.playlistSelect.innerHTML = '';
    if (playlists) {
        Object.keys(playlists).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            elements.playlistSelect.appendChild(option);
        });
        
        if (selected && Object.keys(playlists).includes(selected)) {
            elements.playlistSelect.value = selected;
        } else if (currentSelection && Object.keys(playlists).includes(currentSelection)) {
            elements.playlistSelect.value = currentSelection;
        }
    }
}

export function updatePendingState(isPending) {
    window.hasPendingChanges = isPending;
    elements.pendingIndicator.style.display = isPending ? 'inline' : 'none';
    elements.applyChangesBtn.style.display = isPending ? 'block' : 'none';
}

export function initializeUI(translations, store) {
    applyTranslations(translations);
    if (store.romPath) {
        elements.gameDirDisplay.textContent = store.romPath;
        elements.gameDirContainer.classList.add('path-hidden');
    } else {
        elements.gameDirContainer.classList.add('path-hidden');
        elements.gameDirDisplay.textContent = translations.NOT_SET || 'Not set';
    }
    refreshModListUI(store.mods, translations);
    refreshPlaylistUI(store.playlists, store.selectedPlaylist);
    updatePendingState(false);
}