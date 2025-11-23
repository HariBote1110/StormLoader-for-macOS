import { elements, refreshModListUI, refreshPlaylistUI, updatePendingState, addModToList } from './ui.js';

export function setupEventListeners(translations) {
    elements.settingsBtn.addEventListener('click', async () => {
        if (confirm(translations.SWITCH_LANGUAGE_CONFIRM)) {
            const currentLocale = (await window.electronAPI.getInitialData()).store.settings?.language || 'ja';
            const newLocale = currentLocale === 'ja' ? 'en' : 'ja';
            await window.electronAPI.switchLanguage(newLocale);
        }
    });

    elements.addModBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.addMod();
        if (result.success) {
            const existingLi = document.querySelector(`li[data-mod-name="${result.mod.name}"]`);
            if (existingLi) {
                elements.modList.removeChild(existingLi);
            }
            addModToList(result.mod, translations);
            updatePendingState(true);
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    elements.setGameDirBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.setGameDirectory();
        if (result.success) {
            elements.gameDirDisplay.textContent = result.path;
            elements.gameDirContainer.classList.remove('path-hidden'); // 設定後は一度表示する
        }
    });

    // ★ 自動検出ボタンのリスナー
    elements.autoDetectBtn.addEventListener('click', async () => {
        window.electronAPI.onShowLoading(() => {}); // ダミーコールバックでローディング表示をトリガーできればベターだが、直接UI操作でも可
        elements.loadingOverlay.style.display = 'flex';
        elements.loadingMessage.textContent = translations.PROCESSING || "Processing...";

        const result = await window.electronAPI.autoDetectPath();
        
        elements.loadingOverlay.style.display = 'none';

        if (result.success) {
            elements.gameDirDisplay.textContent = result.romPath;
            elements.gameDirContainer.classList.remove('path-hidden');
            alert(translations.SUCCESS || "Path detected successfully!");
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    // ★ ゲーム起動ボタンのリスナー
    elements.launchGameBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.launchGame();
        if (!result.success) {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    elements.backupRomBtn.addEventListener('click', () => window.electronAPI.backupRom());

    elements.savePlaylistBtn.addEventListener('click', async () => {
        const name = elements.newPlaylistNameInput.value;
        if (!name) return;
        
        const activeStates = {};
        document.querySelectorAll('#mod-list li').forEach(li => {
            const modName = li.dataset.modName;
            const checkbox = li.querySelector('input[type="checkbox"]');
            activeStates[modName] = checkbox.checked;
        });

        const result = await window.electronAPI.savePlaylist(name, activeStates);
        if (result.success) {
            alert(result.message);
            elements.newPlaylistNameInput.value = '';
            const { store } = await window.electronAPI.getInitialData();
            refreshPlaylistUI(store.playlists, name);
            window.electronAPI.setLastSelectedPlaylist(name);
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    elements.loadPlaylistBtn.addEventListener('click', async () => {
        const name = elements.playlistSelect.value;
        if (!name) return;

        const confirmMessage = translations.LOAD_CONFIRM || "You have unsaved changes. Are you sure you want to load a playlist and discard them?";
        if (window.hasPendingChanges && !confirm(confirmMessage)) {
            return;
        }

        const result = await window.electronAPI.loadPlaylist(name);
        if (result.success) {
            alert(result.message);
            refreshModListUI(result.mods, translations);
            updatePendingState(false);
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    elements.renamePlaylistBtn.addEventListener('click', async () => {
        const oldName = elements.playlistSelect.value;
        if (!oldName) return;

        const newName = prompt(translations.RENAME_PROMPT || "Enter the new playlist name:", oldName);
        if (!newName || newName === oldName) return;

        const result = await window.electronAPI.renamePlaylist(oldName, newName);
        if (result.success) {
            alert(result.message);
            const { store } = await window.electronAPI.getInitialData();
            await window.electronAPI.setLastSelectedPlaylist(newName);
            refreshPlaylistUI(store.playlists, newName);
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    elements.deletePlaylistBtn.addEventListener('click', async () => {
        const name = elements.playlistSelect.value;
        if (!name) return;
        
        const confirmMessage = (translations.DELETE_CONFIRM || "Are you sure you want to delete '{playlistName}'?").replace('{playlistName}', name);
        if (!confirm(confirmMessage)) return;

        const result = await window.electronAPI.deletePlaylist(name);
        if (result.success) {
            alert(result.message);
            const { store } = await window.electronAPI.getInitialData();
            refreshPlaylistUI(store.playlists);
            window.electronAPI.setLastSelectedPlaylist(elements.playlistSelect.value || null);
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    elements.overwritePlaylistBtn.addEventListener('click', async () => {
        const name = elements.playlistSelect.value;
        if (!name) return;

        const confirmMessage = (translations.OVERWRITE_CONFIRM || "Are you sure you want to overwrite '{playlistName}'?").replace('{playlistName}', name);
        if (!confirm(confirmMessage)) return;

        const activeStates = {};
        document.querySelectorAll('#mod-list li').forEach(li => {
            const modName = li.dataset.modName;
            const checkbox = li.querySelector('input[type="checkbox"]');
            activeStates[modName] = checkbox.checked;
        });

        const result = await window.electronAPI.overwritePlaylist(name, activeStates);
        if (result.success) {
            alert(result.message);
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    elements.playlistSelect.addEventListener('change', () => {
        window.electronAPI.setLastSelectedPlaylist(elements.playlistSelect.value);
    });

    elements.applyChangesBtn.addEventListener('click', async () => {
        const activeStates = {};
        document.querySelectorAll('#mod-list li').forEach(li => {
            const name = li.dataset.modName;
            const checkbox = li.querySelector('input[type="checkbox"]');
            activeStates[name] = checkbox.checked;
        });

        const result = await window.electronAPI.applyModChanges(activeStates);
        if (result.success) {
            updatePendingState(false);
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });
    
    elements.modList.addEventListener('click', async (event) => {
        if (event.target.closest('.delete-mod-btn')) {
            const li = event.target.closest('li');
            const modName = li.dataset.modName;
            
            const confirmMessage = (translations.DELETE_MOD_CONFIRM || "Are you sure you want to delete '{modName}'? This action cannot be undone.").replace('{modName}', modName);
            if (confirm(confirmMessage)) {
                const result = await window.electronAPI.deleteMod(modName);
                if (result.success) {
                    li.remove();
                    alert(result.message);
                } else {
                    alert(`${translations.ERROR}: ${result.message}`);
                }
            }
        }
    });

    elements.gameDirContainer.addEventListener('click', () => {
        if (elements.gameDirDisplay.textContent !== (translations.NOT_SET || 'Not set')) {
            const container = elements.gameDirContainer;
            container.classList.toggle('path-hidden');
            const eyeIcon = container.querySelector('.eye-icon img');
            if (container.classList.contains('path-hidden')) {
                eyeIcon.src = 'assets/icons/eye.svg';
            } else {
                eyeIcon.src = 'assets/icons/eye-off.svg';
            }
        }
    });

    // Share/Import Event Listeners
    elements.shareConfigBtn.addEventListener('click', async () => {
        const activeMods = [];
        const { store } = await window.electronAPI.getInitialData();
        const allMods = store.mods || [];

        document.querySelectorAll('#mod-list li').forEach(li => {
            const checkbox = li.querySelector('input[type="checkbox"]');
            if (checkbox.checked) {
                const modName = li.dataset.modName;
                const mod = allMods.find(m => m.name === modName);
                if (mod) {
                    activeMods.push({ name: mod.name, version: mod.version });
                }
            }
        });

        if (activeMods.length === 0) {
            alert('No active mods to share.');
            return;
        }

        const result = await window.electronAPI.generateShareString(activeMods);
        if (result.success) {
            elements.exportTextarea.value = result.shareString;
            elements.exportModal.style.display = 'flex';
        }
    });

    elements.importFromTextBtn.addEventListener('click', () => {
        elements.importTextarea.value = '';
        elements.importModal.style.display = 'flex';
    });

    // Modal close buttons
    elements.closeExportModalBtn.addEventListener('click', () => {
        elements.exportModal.style.display = 'none';
    });
    elements.closeImportModalBtn.addEventListener('click', () => {
        elements.importModal.style.display = 'none';
    });

    // Modal actions
    elements.copyConfigBtn.addEventListener('click', () => {
        window.electronAPI.copyToClipboard(elements.exportTextarea.value);
        alert('Copied to clipboard!');
    });

    elements.importConfigBtn.addEventListener('click', async () => {
        const shareString = elements.importTextarea.value;
        if (!shareString) return;

        const result = await window.electronAPI.importShareString(shareString);
        
        if (result.success) {
            const playlistName = `Imported-${new Date().toISOString().slice(0,10)}`;
            const activeStates = {};
            const requiredMods = result.config.mods.map(m => m.name);
            
            document.querySelectorAll('#mod-list li').forEach(li => {
                const modName = li.dataset.modName;
                activeStates[modName] = requiredMods.includes(modName);
            });
            
            const saveResult = await window.electronAPI.savePlaylist(playlistName, activeStates);
            if (saveResult.success) {
                const { store } = await window.electronAPI.getInitialData();
                refreshPlaylistUI(store.playlists, playlistName);
                
                // Apply states to UI
                document.querySelectorAll('#mod-list li').forEach(li => {
                    const modName = li.dataset.modName;
                    const checkbox = li.querySelector('input[type="checkbox"]');
                    checkbox.checked = activeStates[modName] || false;
                });

                updatePendingState(true);
                alert((translations.IMPORT_SUCCESS_DESC || "Playlist '{playlistName}' has been created...").replace('{playlistName}', playlistName));
                elements.importModal.style.display = 'none';
            }

        } else if (result.missing) {
            let missingModsMessage = `${translations.MISSING_MODS_DESC || 'The following mods are required:'}\n\n`;
            missingModsMessage += result.mods.join('\n');
            alert(`${translations.MISSING_MODS_TITLE || 'Missing Mods'}\n\n${missingModsMessage}`);
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
        }
    });

    // --- ローディング表示 ---
    window.electronAPI.onShowLoading((message) => {
        elements.loadingMessage.textContent = message;
        elements.loadingOverlay.style.display = 'flex';
    });
    window.electronAPI.onHideLoading(() => {
        elements.loadingOverlay.style.display = 'none';
    });
}