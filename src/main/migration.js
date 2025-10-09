const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');

function runMigration() {
    const oldAppName = 'stormloader-for-macos';
    const newAppName = 'stormforge'; // package.jsonのnameと一致させます

    const oldUserDataPath = path.join(app.getPath('userData'), '..', oldAppName);
    const newUserDataPath = app.getPath('userData');
    const newStoreFilePath = path.join(newUserDataPath, 'store.json');

    // ★★★ 修正箇所 ★★★
    // 新しい設定ファイルが既に存在する場合、または古いデータパスが存在しない場合は何もしない
    if (fs.existsSync(newStoreFilePath)) {
        console.log('[Migration] New store.json already exists. Skipping migration.');
        return;
    }
    if (!fs.existsSync(oldUserDataPath)) {
        console.log('[Migration] Old data path not found. Skipping migration.');
        return;
    }

    try {
        console.log(`[Migration] Found old data at: ${oldUserDataPath}`);
        console.log(`[Migration] Migrating to: ${newUserDataPath}`);
        
        // 新しいパスが存在しない場合は作成
        fs.ensureDirSync(newUserDataPath);

        // ファイル/フォルダをコピー
        fs.copySync(oldUserDataPath, newUserDataPath, { overwrite: true });

        console.log('[Migration] Data migration successful.');

        dialog.showMessageBoxSync({
            type: 'info',
            title: 'データ引き継ぎ完了',
            message: '以前のバージョンのデータを引き継ぎました。',
        });

    } catch (error) {
        console.error('[Migration] Failed to migrate data:', error);
        dialog.showErrorBox(
            'データ引き継ぎエラー',
            `データの引き継ぎ中にエラーが発生しました。\n${error.message}`
        );
    }
}

module.exports = { runMigration };