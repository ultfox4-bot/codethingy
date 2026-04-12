const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');

let mainWindow;
let isExiting = false;
let keySequence = [];
const exitCode = ['w', 'a', 's', 'h', 'y'];

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    fullscreen: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: true,
    kiosk: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);

  // Prevent minimize
  mainWindow.on('minimize', (e) => {
    if (!isExiting) {
      e.preventDefault();
      mainWindow.restore();
      mainWindow.setFullScreen(true);
      mainWindow.focus();
    }
  });

  // Prevent close
  mainWindow.on('close', (e) => {
    if (!isExiting) {
      e.preventDefault();
      mainWindow.setFullScreen(true);
      mainWindow.focus();
    }
  });

  // Re-focus if blur
  mainWindow.on('blur', () => {
    if (!isExiting) {
      setTimeout(() => {
        if (mainWindow && !isExiting) {
          mainWindow.focus();
          mainWindow.setFullScreen(true);
        }
      }, 100);
    }
  });

  // Prevent leaving fullscreen
  mainWindow.on('leave-full-screen', () => {
    if (!isExiting) {
      mainWindow.setFullScreen(true);
    }
  });

  // Register global shortcut blocker for common escape keys
  globalShortcut.register('Alt+F4', () => {
    // Block Alt+F4
    return false;
  });

  globalShortcut.register('Alt+Tab', () => {
    // Block Alt+Tab
    return false;
  });

  globalShortcut.register('CommandOrControl+W', () => {
    // Block Ctrl+W
    return false;
  });

  globalShortcut.register('CommandOrControl+Q', () => {
    // Block Ctrl+Q
    return false;
  });

  globalShortcut.register('Escape', () => {
    // Block Escape
    return false;
  });

  globalShortcut.register('Super', () => {
    // Block Windows key
    return false;
  });
}

// Listen for key sequence from renderer
const { ipcMain } = require('electron');

ipcMain.on('key-pressed', (event, key) => {
  const lowerKey = key.toLowerCase();
  
  // Check if key matches the next expected key in sequence
  if (lowerKey === exitCode[keySequence.length]) {
    keySequence.push(lowerKey);
    
    // Check if sequence complete
    if (keySequence.length === exitCode.length) {
      isExiting = true;
      globalShortcut.unregisterAll();
      app.quit();
    }
  } else if (lowerKey === exitCode[0]) {
    // Start new sequence if 'w' pressed
    keySequence = [lowerKey];
  } else {
    // Reset sequence
    keySequence = [];
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Prevent app from quitting
app.on('before-quit', (e) => {
  if (!isExiting) {
    e.preventDefault();
  }
});

app.on('window-all-closed', () => {
  if (!isExiting) {
    createWindow();
  }
});

// Clean up
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
