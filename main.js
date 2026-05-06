const { app, BrowserWindow, ipcMain, nativeImage, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { isValidKeyFormat, normalizeKey, MAX_TEXT_CHARS } = require('./keygen');
const { BACKEND_URL, NOTIFY_EMAIL } = require('./config');

const APP_ID = 'com.ultfox.coderedeemer';
const APP_NAME = 'Ultfox Code Redeemer';

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}
app.setName(APP_NAME);

function getAppIcon() {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, 'build', iconFile);
  try {
    if (fs.existsSync(iconPath)) return nativeImage.createFromPath(iconPath);
  } catch {}
  return undefined;
}

// ---------- Local "redeemed on this machine" history ----------
function getHistoryPath() {
  return path.join(app.getPath('userData'), 'redeemed-history.json');
}

function loadHistory() {
  try {
    const p = getHistoryPath();
    if (!fs.existsSync(p)) return [];
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  const p = getHistoryPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
}

function pushHistory(entry) {
  const list = loadHistory();
  list.unshift(entry);
  saveHistory(list.slice(0, 200));
}

// ---------- Backend helper (uses Electron's `net` module to avoid bundling node-fetch) ----------
function postJson(pathname, payload) {
  return new Promise((resolve, reject) => {
    const url = `${BACKEND_URL}${pathname}`;
    const request = net.request({ method: 'POST', url });
    request.setHeader('Content-Type', 'application/json');
    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString();
      });
      response.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = { detail: data };
        }
        resolve({ status: response.statusCode, body: parsed });
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.write(JSON.stringify(payload || {}));
    request.end();
  });
}

function extractError(body, fallback) {
  if (!body) return fallback;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  if (typeof body.error === 'string') return body.error;
  return fallback;
}

// ---------- Window ----------
function createWindow() {
  const icon = getAppIcon();
  const win = new BrowserWindow({
    width: 980,
    height: 780,
    minWidth: 760,
    minHeight: 600,
    title: APP_NAME,
    icon,
    backgroundColor: '#0e1116',
    autoHideMenuBar: true,
    show: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => win.show());
}

// ---------- IPC ----------
ipcMain.handle('app:meta', () => ({
  notifyEmail: NOTIFY_EMAIL,
  maxTextChars: MAX_TEXT_CHARS,
}));

ipcMain.handle('admin:verify', async (_e, password) => {
  // Server-side verification via list (cheapest authenticated call).
  try {
    const { status, body } = await postJson('/api/keys/list', { password });
    if (status === 200 && body && body.ok) return { ok: true };
    return { ok: false, error: extractError(body, 'Unauthorized') };
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` };
  }
});

ipcMain.handle('key:generate', async (_e, { password, text, attachmentUrl }) => {
  const t = (text || '').toString();
  if (t.length > MAX_TEXT_CHARS) {
    return { ok: false, error: `Text too long. Max ${MAX_TEXT_CHARS} characters.` };
  }
  try {
    const { status, body } = await postJson('/api/keys/generate', {
      password,
      text: t,
      attachment_url: (attachmentUrl || '').toString(),
    });
    if (status === 200 && body?.ok) return { ok: true, key: body.key };
    return { ok: false, error: extractError(body, 'Failed to generate key.') };
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` };
  }
});

ipcMain.handle('key:redeem', async (_e, rawKey) => {
  const norm = normalizeKey(rawKey);
  if (!isValidKeyFormat(norm)) {
    return { ok: false, error: 'Invalid key format. Keys are 36 characters (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX).' };
  }
  try {
    const { status, body } = await postJson('/api/keys/redeem', { key: norm });
    if (status === 200 && body?.ok) {
      pushHistory({
        key: norm,
        text: body.text || '',
        attachment_url: body.attachment_url || '',
        redeemedAt: new Date().toISOString(),
      });
      return {
        ok: true,
        key: norm,
        text: body.text || '',
        attachment_url: body.attachment_url || '',
      };
    }
    return { ok: false, error: extractError(body, 'Could not redeem key.') };
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` };
  }
});

ipcMain.handle('key:revoke', async (_e, { password, key }) => {
  const norm = normalizeKey(key);
  if (!norm) return { ok: false, error: 'Please enter a key.' };
  try {
    const { status, body } = await postJson('/api/keys/revoke', { password, key: norm });
    if (status === 200 && body?.ok) return { ok: true };
    return { ok: false, error: extractError(body, 'Could not revoke key.') };
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` };
  }
});

ipcMain.handle('store:summary', async (_e, password) => {
  try {
    const { status, body } = await postJson('/api/keys/list', { password });
    if (status === 200 && body?.ok) {
      return {
        ok: true,
        active: body.active || [],
        redeemed: body.redeemed || [],
        revoked: body.revoked || [],
      };
    }
    return { ok: false, error: extractError(body, 'Could not load keys.') };
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` };
  }
});

ipcMain.handle('redeemed:list', () => {
  return loadHistory();
});

ipcMain.handle('shell:open-mail', (_e, url) => {
  if (typeof url !== 'string' || !url.toLowerCase().startsWith('mailto:')) {
    return { ok: false, error: 'Invalid mailto URL.' };
  }
  shell.openExternal(url).catch(() => {});
  return { ok: true };
});

ipcMain.handle('shell:open-external', (_e, url) => {
  if (typeof url !== 'string') return { ok: false };
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Only http(s) links are allowed.' };
  shell.openExternal(url).catch(() => {});
  return { ok: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
