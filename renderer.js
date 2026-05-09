// Renderer-side logic for Ultfox Code Redeemer.
// Talks to main.js via the preload bridge (window.ultfox).

const $ = (id) => document.getElementById(id);

// ---------- SAFE ELEMENT HELPER ----------
function el(id) {
  const node = $(id);
  if (!node) console.warn(`[Ultfox UI] Missing element: ${id}`);
  return node;
}

let NOTIFY_EMAIL = 'Ultfox4@gmail.com';
let MAX_TEXT = 2000;
let adminPassword = null;

// ---------- SAFE EVENT BIND ----------
function on(id, event, fn) {
  const node = el(id);
  if (!node) return;
  node.addEventListener(event, fn);
}

// ---------- Tabs ----------
function activateTab(targetId) {
  document.querySelectorAll('.tab').forEach((t) => {
    const isActive = t.dataset.target === targetId;
    t.classList.toggle('active', isActive);
  });

  document.querySelectorAll('.panel').forEach((p) => {
    p.classList.toggle('active', p.id === targetId);
  });
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (tab?.dataset?.target) activateTab(tab.dataset.target);
  });
});

// ---------- Result helpers ----------
function setResult(el, html, kind) {
  if (!el) return;
  el.className = 'result' + (kind ? ` ${kind}` : '');
  el.innerHTML = html;
}

function escapeHtml(str) {
  return (str || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Boot ----------
(async function boot() {
  try {
    const meta = await window.ultfox?.meta?.();
    if (meta) {
      NOTIFY_EMAIL = meta.notifyEmail || NOTIFY_EMAIL;
      MAX_TEXT = meta.maxTextChars || MAX_TEXT;
    }

    const emailLabel = el('notify-email-label');
    const maxLabel = el('max-chars-label');
    const genText = el('gen-text');

    if (emailLabel) emailLabel.textContent = NOTIFY_EMAIL;
    if (maxLabel) maxLabel.textContent = MAX_TEXT;
    if (genText) genText.setAttribute('maxlength', String(MAX_TEXT));

    const genLen = el('gen-len');
    if (genLen) genLen.textContent = `0 / ${MAX_TEXT}`;
  } catch (e) {
    console.warn('[Ultfox boot error]', e);
  }

  await refreshLocalRedeemedList();
})();

// ---------- SAFE COUNTERS ----------
on('redeem-input', 'input', (e) => {
  const el = $('redeem-len');
  if (el) el.textContent = `${e.target.value.length} / 36`;
});

on('gen-text', 'input', (e) => {
  const el = $('gen-len');
  if (el) el.textContent = `${e.target.value.length} / ${MAX_TEXT}`;
});

on('req-message', 'input', (e) => {
  const el = $('req-msg-len');
  if (el) el.textContent = `${e.target.value.length} / 5000`;
});

// ---------- Redeem ----------
on('redeem-btn', 'click', async () => {
  const result = el('redeem-result');
  const key = el('redeem-input')?.value?.trim();

  if (!key) return setResult(result, 'Please enter a key.', 'error');

  setResult(result, 'Redeeming...');

  const r = await window.ultfox.redeemKey(key);

  if (!r?.ok) {
    return setResult(result, escapeHtml(r?.error || 'Could not redeem key.'), 'error');
  }

  const attachment = r.attachment_url || '';

  let html = `
    <div class="big">Congratulations! you have redeemed ${escapeHtml(r.text || '')}</div>
    <div class="muted">Key: <span class="mono">${escapeHtml(r.key)}</span></div>
  `;

  if (attachment) {
    html += `<div>Attachment: <a href="#" id="redeem-attach-link" data-url="${escapeHtml(attachment)}">${escapeHtml(attachment)}</a></div>`;
  }

  setResult(result, html, 'success');

  const link = document.getElementById('redeem-attach-link');
  if (link) {
    link.onclick = (e) => {
      e.preventDefault();
      window.ultfox?.openExternal?.(link.dataset.url);
    };
  }

  // Gmail (safe)
  const subject = encodeURIComponent(`[Ultfox] Key ${r.key} redeemed`);
  const body = encodeURIComponent(`${r.key} redeemed\n\nTime: ${new Date().toISOString()}`);

  window.ultfox?.openExternal?.(
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(NOTIFY_EMAIL)}` +
    `&subject=${subject}` +
    `&body=${body}`
  );

  if (el('redeem-input')) el('redeem-input').value = '';
  if (el('redeem-len')) el('redeem-len').textContent = '0 / 36';

  await refreshLocalRedeemedList();
});

on('redeem-request-btn', 'click', () => activateTab('request-panel'));

// ---------- Request ----------
on('req-send-btn', 'click', () => {
  const name = el('req-name')?.value?.trim();
  const reason = el('req-reason')?.value?.trim();
  const message = el('req-message')?.value?.trim();
  const result = el('req-result');

  if (!name) return setResult(result, 'Enter name', 'error');
  if (!reason) return setResult(result, 'Enter reason', 'error');
  if (!message) return setResult(result, 'Enter message', 'error');

  const subject = encodeURIComponent(`[Ultfox] Request from ${name}`);
  const body = encodeURIComponent(`${name}: ${reason}\n\n${message}`);

  window.ultfox?.openExternal?.(
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(NOTIFY_EMAIL)}` +
    `&subject=${subject}` +
    `&body=${body}`
  );

  setResult(result, 'Opened in Gmail', 'success');
});

// ---------- Admin ----------
on('admin-unlock-btn', 'click', async () => {
  const pw = el('admin-pw')?.value;
  const result = el('admin-gate-result');

  if (!pw) return setResult(result, 'Enter password', 'error');

  setResult(result, 'Verifying...');

  const r = await window.ultfox.verifyAdmin(pw);

  if (!r?.ok) return setResult(result, 'Wrong password', 'error');

  adminPassword = pw;

  if (el('admin-gate')) el('admin-gate').classList.add('hidden');
  if (el('admin-menu')) el('admin-menu').classList.remove('hidden');

  await safeRefreshAll();
});

on('admin-lock-btn', 'click', () => {
  adminPassword = null;
  if (el('admin-menu')) el('admin-menu').classList.add('hidden');
  if (el('admin-gate')) el('admin-gate').classList.remove('hidden');
});

// ---------- Generate ----------
on('gen-btn', 'click', async () => {
  const result = el('gen-result');
  if (!adminPassword) return setResult(result, 'Locked', 'error');

  const text = el('gen-text')?.value || '';
  const attachmentUrl = el('gen-attachment')?.value?.trim() || '';

  if (text.length > MAX_TEXT) return setResult(result, 'Too long', 'error');

  setResult(result, 'Generating...');

  const r = await window.ultfox.generateKey({
    password: adminPassword,
    text,
    attachmentUrl
  });

  if (!r?.ok) return setResult(result, 'Error generating', 'error');

  setResult(result, `
    <div class="key-display mono">${escapeHtml(r.key)}</div>
  `);

  await refreshActiveList();
});

// ---------- Revoke ----------
on('revoke-btn', 'click', async () => {
  const result = el('revoke-result');
  if (!adminPassword) return setResult(result, 'Locked', 'error');

  const key = el('revoke-input')?.value?.trim();
  if (!key) return setResult(result, 'Enter key', 'error');

  const r = await window.ultfox.revokeKey({ password: adminPassword, key });

  if (!r?.ok) return setResult(result, 'Failed', 'error');

  setResult(result, 'Revoked', 'success');

  await safeRefreshAll();
});

// ---------- SAFE LIST RENDER ----------
function renderList(container, items, dateField, opts = {}) {
  if (!container) return;
  if (!items?.length) {
    container.innerHTML = '<div class="muted">Empty</div>';
    return;
  }

  container.innerHTML = items.map(it => `
    <div class="history-item">
      <div>${escapeHtml(it.text || '')}</div>
      <div class="mono">${escapeHtml(it.key)}</div>
    </div>
  `).join('');
}

// ---------- SAFE REFRESH ----------
async function safeRefreshAll() {
  try {
    await Promise.all([
      refreshActiveList(),
      refreshServerRedeemedList(),
      refreshRevokedList()
    ]);
  } catch (e) {
    console.warn('[refresh error]', e);
  }
}

async function refreshLocalRedeemedList() {
  try {
    const list = await window.ultfox?.redeemedHistory?.() || [];
    renderList(el('redeemed-list'), list);
  } catch {}
}

async function refreshActiveList() {}
async function refreshServerRedeemedList() {}
async function refreshRevokedList() {}

// ---------- CLEAR BUTTONS (SAFE GUARANTEED) ----------
on('clear-local-redeemed-btn', 'click', async () => {
  if (!confirm('Clear local?')) return;
  await window.ultfox?.clearLocalRedeemed?.();
  await refreshLocalRedeemedList();
});

on('clear-redeemed-btn', 'click', async () => {
  if (!adminPassword) return;
  if (!confirm('Delete redeemed?')) return;

  const r = await window.ultfox.clearKeys({ password: adminPassword, target: 'redeemed' });
  if (r?.ok) alert(`Deleted ${r.deleted}`);
});

on('clear-revoked-btn', 'click', async () => {
  if (!adminPassword) return;
  if (!confirm('Delete revoked?')) return;

  const r = await window.ultfox.clearKeys({ password: adminPassword, target: 'revoked' });
  if (r?.ok) alert(`Deleted ${r.deleted}`);
});
