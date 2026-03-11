const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Configuration
const MIN_INTERVAL = 5 * 1000;  // 5 seconds in ms (for testing)
const MAX_INTERVAL = 15 * 1000; // 15 seconds in ms (for testing)

let mainWindow;
let timerActive = false;
let currentTimeout = null;

function getRandomInterval() {
  return Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) + MIN_INTERVAL;
}

function createWindow() {
  // Get the video path - check if running in dev or packaged
  const isDev = !app.isPackaged;
  let videoPath;
  
  if (isDev) {
    videoPath = path.join(__dirname, 'assets', 'A90.mp4');
  } else {
    // In packaged app, try multiple possible locations
    const possiblePaths = [
      path.join(process.resourcesPath, 'assets', 'A90.mp4'),
      path.join(process.resourcesPath, 'app', 'assets', 'A90.mp4'),
      path.join(path.dirname(process.execPath), 'resources', 'assets', 'A90.mp4'),
      path.join(path.dirname(process.execPath), 'assets', 'A90.mp4')
    ];
    
    const fs = require('fs');
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        videoPath = p;
        console.log('Found video at:', p);
        break;
      }
    }
    
    if (!videoPath) {
      console.error('Video not found! Tried:', possiblePaths);
      videoPath = possiblePaths[0]; // fallback
    }
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Start hidden
    frame: false, // No window frame for clean fullscreen
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Send video path to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('video-path', videoPath);
  });

  // Prevent showing before timer
  mainWindow.on('show', () => {
    if (!timerActive) {
      mainWindow.hide();
    }
  });

  // Prevent restore/unminimize before timer
  mainWindow.on('restore', () => {
    if (!timerActive) {
      mainWindow.minimize();
    }
  });

  // Prevent focus before timer
  mainWindow.on('focus', () => {
    if (!timerActive) {
      mainWindow.minimize();
    }
  });

  // Start the timer cycle
  startTimerCycle();
}

function startTimerCycle() {
  const interval = getRandomInterval();
  console.log(`Next popup in ${interval / 1000} seconds`);
  
  currentTimeout = setTimeout(() => {
    triggerPopup();
  }, interval);
}

function triggerPopup() {
  timerActive = true;
  
  // Show window and make it fullscreen
  mainWindow.show();
  mainWindow.setFullScreen(true);
  mainWindow.focus();
  
  // Tell renderer to play video
  mainWindow.webContents.send('play-video');
}

// Handle video ended event from renderer
ipcMain.on('video-ended', () => {
  console.log('Video ended, minimizing...');
  timerActive = false;
  mainWindow.setFullScreen(false);
  mainWindow.minimize();
  
  // Start next cycle
  startTimerCycle();
});

// Handle manual close attempt - just minimize instead
ipcMain.on('close-request', () => {
  if (timerActive) {
    // If video is playing, let it finish
    return;
  }
  mainWindow.minimize();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Prevent app from quitting when window is "closed" - just minimize
app.on('before-quit', (event) => {
  // Allow quit only via system tray or force quit
});
