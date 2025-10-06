const addModBtn = document.getElementById('add-mod-btn');
const setGameDirBtn = document.getElementById('set-game-dir-btn');
const backupRomBtn = document.getElementById('backup-rom-btn');
const gameDirDisplay = document.getElementById('game-dir-display');
const modList = document.getElementById('mod-list');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');

let translations = {};

// --- 多言語対応 ---
function applyTranslations() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (translations[key]) {
            el.textContent = translations[key];
        }
    });
    document.querySelectorAll('[data-lang-default]').forEach(el => {
        if (!el.textContent || el.textContent === 'Not set' || el.textContent === '未設定') {
            const key = el.getAttribute('data-lang-default');
            if (translations[key]) {
                el.textContent = translations[key];
            }
        }
    });
    document.title = translations.APP_TITLE || 'StormLoader for macOS';
}

// --- イベントリスナー ---
addModBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.addMod();
  if (result.success) {
    const existingLi = document.querySelector(`li[data-mod-name="${result.mod.name}"]`);
    if (existingLi) {
        modList.removeChild(existingLi);
    }
    addModToList(result.mod);
  } else {
    alert(`${translations.ERROR}: ${result.message}`);
  }
});

setGameDirBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.setGameDirectory();
    if (result.success) {
        gameDirDisplay.textContent = result.path;
    }
});

backupRomBtn.addEventListener('click', () => window.electronAPI.backupRom());

// --- ローディング表示 ---
window.electronAPI.onShowLoading((message) => {
    loadingMessage.textContent = message;
    loadingOverlay.style.display = 'flex';
});
window.electronAPI.onHideLoading(() => {
    loadingOverlay.style.display = 'none';
});

// --- アプリ起動時の処理 ---
window.addEventListener('DOMContentLoaded', async () => {
    const { store, translations: loadedTranslations } = await window.electronAPI.getInitialData();
    translations = loadedTranslations;
    applyTranslations();

    if (store.gameDirectory) {
        gameDirDisplay.textContent = store.gameDirectory;
    }
    if (store.mods) {
        modList.innerHTML = '';
        store.mods.forEach(addModToList);
    }
});

// --- UI更新用関数 ---
function addModToList(mod) {
    const li = document.createElement('li');
    li.dataset.modName = mod.name;

    const modDetails = `
        <div>
            <strong>${mod.name}</strong><br>
            <small>${translations.AUTHOR}: ${mod.author} | ${translations.VERSION}: ${mod.version}</small>
        </div>
    `;
    const toggleSwitch = `<label class="switch"><input type="checkbox" ${mod.active ? 'checked' : ''}><span class="slider"></span></label>`;
    li.innerHTML = modDetails + toggleSwitch;
    modList.appendChild(li);

    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', async (event) => {
        const isActive = event.target.checked;
        const result = await window.electronAPI.toggleModActive(mod.name, isActive);
        
        if (result.success) {
            if (result.message) {
                alert(result.message);
            }
        } else {
            alert(`${translations.ERROR}: ${result.message}`);
            event.target.checked = !isActive;
        }
    });
}