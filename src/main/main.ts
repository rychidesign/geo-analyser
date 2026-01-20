import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { initDatabase } from './database';
import { initializeIpcHandlers } from './ipc/handlers';

// __dirname is available natively in CommonJS
declare const __dirname: string;

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.logger = console; // Enable logging

process.env.DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'dist')
  : path.join(__dirname, '../dist');
  
process.env.VITE_PUBLIC = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'public')
  : path.join(process.env.DIST, '../public');

let mainWindow: BrowserWindow | null = null;

// In development, always use Vite dev server
const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = isDev ? 'http://localhost:5173' : null;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  // Preload path - handle both dev and production
  const preloadPath = app.isPackaged
    ? path.join(process.resourcesPath, 'preload.cjs')
    : path.join(__dirname, 'preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    icon: path.join(process.env.VITE_PUBLIC!, 'icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    frame: true, // Use native frame for now
    // titleBarStyle: 'hidden',
    // titleBarOverlay: {
    //   color: '#0a0a0a',
    //   symbolColor: '#ffffff',
    //   height: 40
    // }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          VITE_DEV_SERVER_URL
            ? // Development - allow unsafe-eval for Vite HMR
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* https://*.openai.com https://*.anthropic.com https://*.googleapis.com https://*.perplexity.ai;"
            : // Production - strict CSP
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.openai.com https://*.anthropic.com https://*.googleapis.com https://*.perplexity.ai;"
        ]
      }
    });
  });

  // Load the app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools(); // Hidden by default
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Auto-updater events (register before app.whenReady)
autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('✅ Update available:', info.version);
  
  if (!mainWindow) {
    console.error('❌ mainWindow not available for update dialog');
    return;
  }
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `A new version ${info.version} is available!`,
    detail: 'Would you like to download it now? The app will restart after download.',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      console.log('👤 User chose to download update');
      console.log('📥 Starting download...');
      try {
        autoUpdater.downloadUpdate()
          .then(() => {
            console.log('✅ Download initiated successfully');
          })
          .catch((err) => {
            console.error('❌ Download failed:', err);
            if (mainWindow) {
              dialog.showErrorBox(
                'Download Failed',
                `Failed to download update: ${err.message}\n\nPlease try again later or download manually from GitHub.`
              );
            }
          });
      } catch (err) {
        console.error('❌ Exception during download:', err);
      }
    } else {
      console.log('👤 User chose to skip update');
    }
  }).catch((err) => {
    console.error('❌ Error showing update dialog:', err);
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('ℹ️ Update not available. Current version:', info.version);
});

autoUpdater.on('error', (err) => {
  console.error('❌ Error in auto-updater:', err);
  console.error('Error details:', JSON.stringify(err, null, 2));
  
  if (mainWindow) {
    dialog.showErrorBox(
      'Auto-Update Error',
      `An error occurred during auto-update:\n\n${err.message || err}\n\nYou can download the update manually from GitHub.`
    );
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`⬇️ Download progress: ${progressObj.percent.toFixed(2)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('🎉 ✅ Update downloaded successfully!', info.version);
  console.log('Update info:', JSON.stringify(info, null, 2));
  
  if (!mainWindow) {
    console.error('❌ mainWindow not available for download complete dialog');
    return;
  }
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} downloaded successfully!`,
    detail: 'The app will restart to install the update. Your data will be preserved.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  }).then((result) => {
    if (result.response === 0) {
      console.log('👤 User chose to restart and install');
      console.log('🔄 Restarting application...');
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
    } else {
      console.log('👤 User chose to install later');
    }
  }).catch((err) => {
    console.error('❌ Error showing download complete dialog:', err);
  });
});

app.whenReady().then(async () => {
  // Initialize database
  try {
    await initDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  // Initialize IPC handlers
  initializeIpcHandlers();

  createWindow();
  
  // Check for updates on startup (only in production)
  if (!isDev) {
    console.log('🚀 Checking for updates on startup...');
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('Failed to check for updates:', err);
      });
    }, 3000); // Wait 3 seconds after app start
  } else {
    console.log('⚠️ Auto-update disabled in development mode');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Save database before quitting
app.on('before-quit', async () => {
  const { closeDatabase } = await import('./database');
  closeDatabase();
});

// Basic IPC handlers (will be expanded in later steps)
ipcMain.handle('ping', () => {
  return 'pong';
});
