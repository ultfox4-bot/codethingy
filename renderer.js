// Renderer-side logic for Ultfox Code Redeemer.
// Talks to main.js via the preload bridge (window.ultfox).

const $ = (id) => document.getElementById(id);

let NOTIFY_EMAIL = 'Ultfox4@gmail.com';
let MAX_TEXT = 2000;
let adminPassword = null;

// ---------- SAFE ADD EVENT ----------
function on(id, event, fn) {
  const el = $(id);
  if (el) el.addEventListener(event, fn);
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
  tab.addEventListener('click', () => activateTab(tab.dataset.target));
});

// ---------- Result ----------
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
    const meta = await window.ultfox.meta();
    NOTIFY_EMAIL = meta.notifyEmail || NOTIFY_EMAIL;
    MAX_TEXT = meta.maxTextChars || MAX_TEXT;

    const emailLabel = $('notify-email-label');
    if (emailLabel) emailLabel.textContent = NOTIFY_EMAIL;

    const maxLabel = $('max-chars-label');
    if (maxLabel) maxLabel.textContent = MAX_TEXT;

    const genText = $('gen-text');
    if (genText) genText.setAttribute('maxlength', String(MAX_TEXT));

    const genLen = $('gen-len');
    if (genLen) genLen.textContent = `0 / ${MAX_TEXT}`;

  } catch {}

  await refreshLocalRedeemedList();
})();

// ---------- Counters ----------
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
  if (el) el.textContent = `${e.target.value.length} / 500`;
});

// ---------- Redeem ----------
on('redeem-btn', 'click', async () => {
  const result = $('redeem-result');
  const key = $('redeem-input')?.value.trim();

  if (!key) return setResult(result, 'Please enter a key.', 'error');

  setResult(result, 'Redeeming...');

  const r = await window.ultfox.redeemKey(key);
  if (!r.ok) return setResult(result, escapeHtml(r.error), 'error');

  const text = r.text || '';
  const attachment = r.attachment_url || '';

  let html = `
    <div class="big">You redeemed ${escapeHtml(text)}</div>
    <div class="muted">Key: <span class="mono">${escapeHtml(r.key)}</span></div>
  `;

  if (attachment) {
    html += `<div><a href="#" id="redeem-attach-link" data-url="${escapeHtml(attachment)}">${escapeHtml(attachment)}</a></div>`;
  }

  setResult(result, html, 'success');

  on('redeem-attach-link', 'click', (e) => {
    e.preventDefault();
    window.ultfox.openExternal(e.target.dataset.url);
  });

  const subject = encodeURIComponent(`[Ultfox] Key ${r.key} redeemed`);
  const body = encodeURIComponent(`${r.key} -> ${text}\nTime: ${new Date().toISOString()}`);

  window.ultfox.openExternal(
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(NOTIFY_EMAIL)}` +
    `&subject=${subject}` +
    `&body=${body}`
  );

  if ($('redeem-input')) $('redeem-input').value = '';
  refreshLocalRedeemedList();
});

// ---------- Request ----------
on('req-send-btn', 'click', () => {
  const name = $('req-name')?.value.trim();
  const reason = $('req-reason')?.value.trim();
  const message = $('req-message')?.value.trim();

  const result = $('req-result');

  if (!name || !reason || !message)
    return setResult(result, 'Fill all fields.', 'error');

  const subject = encodeURIComponent(`[Ultfox] Request from ${name}`);
  const body = encodeURIComponent(`${name}\n${reason}\n${message}`);

  window.ultfox.openExternal(
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(NOTIFY_EMAIL)}` +
    `&subject=${subject}` +
    `&body=${body}`
  );

  setResult(result, 'Opened Gmail.', 'success');
});

// ---------- Admin ----------
on('admin-unlock-btn', 'click', async () => {
  const pw = $('admin-pw')?.value;
  const result = $('admin-gate-result');

  if (!pw) return setResult(result, 'Enter password.', 'error');

  setResult(result, 'Checking...');

  const r = await window.ultfox.verifyAdmin(pw);
  if (!r.ok) return setResult(result, 'Wrong password.', 'error');

  adminPassword = pw;

  if ($('admin-gate')) $('admin-gate').classList.add('hidden');
  if ($('admin-menu')) $('admin-menu').classList.remove('hidden');

  refreshAll();
});

on('admin-lock-btn', 'click', () => {
  adminPassword = null;

  if ($('admin-menu')) $('admin-menu').classList.add('hidden');
  if ($('admin-gate')) $('admin-gate').classList.remove('hidden');
});

// ---------- Generate ----------
on('gen-btn', 'click', async () => {
  if (!adminPassword) return;

  const text = $('gen-text')?.value || '';
  const attachmentUrl = $('gen-attachment')?.value?.trim() || '';

  const r = await window.ultfox.generateKey({
    password: adminPassword,
    text,
    attachmentUrl
  });

  if (!r.ok) return;

  setResult($('gen-result'), `Key: ${r.key}`, 'success');
  refreshActiveList();
});

// ---------- Revoke ----------
on('revoke-btn', 'click', async () => {
  if (!adminPassword) return;

  const key = $('revoke-input')?.value.trim();
  if (!key) return;

  await window.ultfox.revokeKey({ password: adminPassword, key });

  refreshAll();
});

// ---------- Lists ----------
function renderList(container, items, field) {
  if (!container) return;

  if (!items?.length) {
    container.innerHTML = '<div class="muted">Empty</div>';
    return;
  }

  container.innerHTML = items.map(i => `
    <div class="history-item">
      <div>${escapeHtml(i.text || '')}</div>
      <div class="mono">${escapeHtml(i.key)}</div>
    </div>
  `).join('');
}

async function refreshLocalRedeemedList() {
  const list = await window.ultfox.redeemedHistory();
  renderList($('redeemed-list'), list, 'redeemedAt');
}

async function refreshActiveList() {
  const r = await window.ultfox.storeSummary(adminPassword);
  if (r?.ok) renderList($('active-list'), r.active);
}

async function refreshServerRedeemedList() {
  const r = await window.ultfox.storeSummary(adminPassword);
  if (r?.ok) renderList($('server-redeemed-list'), r.redeemed);
}

async function refreshRevokedList() {
  const r = await window.ultfox.storeSummary(adminPassword);
  if (r?.ok) renderList($('revoked-list'), r.revoked);
}

function refreshAll() {
  refreshActiveList();
  refreshServerRedeemedList();
  refreshRevokedList();
}

// ---------- refresh buttons ----------
on('redeemed-refresh', 'click', refreshLocalRedeemedList);
on('active-refresh', 'click', refreshActiveList);
on('server-redeemed-refresh', 'click', refreshServerRedeemedList);
on('revoked-refresh', 'click', refreshRevokedList);
