const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

const APP_ID = '573090'; // Stormworks AppID

async function getSteamPath() {
    if (process.platform === 'win32') {
        try {
            // レジストリからSteamのパスを取得 (Windows)
            const { stdout } = await execPromise('reg query HKCU\\Software\\Valve\\Steam /v SteamPath');
            const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/);
            if (match && match[1]) {
                // Windowsのパスセパレータを修正
                return match[1].trim().replace(/\//g, '\\');
            }
        } catch (error) {
            console.error('Failed to query registry for Steam path:', error);
        }
        // デフォルトパスのフォールバック
        const defaultPath = 'C:\\Program Files (x86)\\Steam';
        if (await fs.pathExists(defaultPath)) return defaultPath;

    } else if (process.platform === 'darwin') {
        // macOSの標準的なSteamパス
        const homeDir = os.homedir();
        const defaultPath = path.join(homeDir, 'Library', 'Application Support', 'Steam');
        if (await fs.pathExists(defaultPath)) return defaultPath;
    }
    return null;
}

async function detectGamePath() {
    const steamPath = await getSteamPath();
    if (!steamPath) return null;

    const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    
    if (!(await fs.pathExists(vdfPath))) {
        // VDFがない場合、デフォルトのインストール場所をチェック
        const defaultCommon = path.join(steamPath, 'steamapps', 'common', 'Stormworks');
        if (await fs.pathExists(defaultCommon)) return defaultCommon;
        return null;
    }

    try {
        const vdfContent = await fs.readFile(vdfPath, 'utf8');
        // 簡易的なVDFパース: "path" と "573090" の関係を探す
        // VDFは階層構造だが、単純化してライブラリごとにブロックを分けて処理する
        
        const libraries = vdfContent.split('"path"');
        // 最初の要素はヘッダーゴミなので無視
        for (let i = 1; i < libraries.length; i++) {
            const libBlock = '"path"' + libraries[i];
            
            // このブロックの中にStormworksのIDがあるか
            if (libBlock.includes(`"${APP_ID}"`)) {
                // パスを抽出 (例: "path" "/Users/name/Library/..." )
                const pathMatch = libBlock.match(/"path"\s+"(.+?)"/);
                if (pathMatch && pathMatch[1]) {
                    let libraryPath = pathMatch[1];
                    // Windowsの場合バックスラッシュのエスケープを戻す
                    if (process.platform === 'win32') {
                        libraryPath = libraryPath.replace(/\\\\/g, '\\');
                    }
                    
                    const gamePath = path.join(libraryPath, 'steamapps', 'common', 'Stormworks');
                    
                    if (process.platform === 'darwin') {
                        // macOSの場合、.appまで含める必要があるか確認
                        const appPath = path.join(gamePath, 'Stormworks.app');
                        if (await fs.pathExists(appPath)) return appPath;
                    } else {
                        if (await fs.pathExists(gamePath)) return gamePath;
                    }
                }
            }
        }
        
        // VDFに見つからなかった場合、デフォルトパスを再確認
        const defaultCommon = path.join(steamPath, 'steamapps', 'common', 'Stormworks');
        let checkPath = defaultCommon;
        if (process.platform === 'darwin') {
             checkPath = path.join(defaultCommon, 'Stormworks.app');
        }
        
        if (await fs.pathExists(checkPath)) return checkPath;

    } catch (error) {
        console.error('Failed to parse libraryfolders.vdf:', error);
    }

    return null;
}

module.exports = { detectGamePath };