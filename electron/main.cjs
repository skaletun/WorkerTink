const {app, BrowserWindow, shell, session, Menu, nativeImage, ipcMain, Notification} = require('electron');
const path = require('path');

const APP_ID = 'com.workertink.desktop';
const PRODUCTION_URL = process.env.WORKERTINK_WEB_URL || 'https://skaletun.github.io/WTinker/';

app.setAppUserModelId(APP_ID);
app.commandLine.appendSwitch('enable-features', 'GlobalMediaControls');

let mainWindow;

function isAllowedUrl(url) {
  try {
    const target = new URL(url);
    const production = new URL(PRODUCTION_URL);
    return target.origin === production.origin;
  } catch {
    return false;
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icons', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    title: 'WTinker',
    icon: iconPath,
    backgroundColor: '#f6f7f9',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (isAllowedUrl(url)) {
      mainWindow.loadURL(url);
    } else {
      void shell.openExternal(url);
    }
    return {action: 'deny'};
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedUrl(url)) event.preventDefault();
  });

  mainWindow.loadURL(PRODUCTION_URL);
}

ipcMain.on('workertink:notify', (_event, payload) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({title: String(payload?.title || 'WorkerTink'), body: String(payload?.body || '')});
  notification.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); if (payload?.url) { try { mainWindow.loadURL(new URL(payload.url, PRODUCTION_URL).toString()); } catch {} } }
  });
  notification.show();
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['notifications', 'media', 'clipboard-read', 'clipboard-write', 'fullscreen', 'pointerLock'];
    callback(allowed.includes(permission));
  });
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
