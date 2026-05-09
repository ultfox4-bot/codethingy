// Renderer-side logic for Ultfox Code Redeemer.
// Talks to main.js via the preload bridge (window.ultfox).

const $ = (id) => document.getElementById(id);

let NOTIFY_EMAIL = 'Ultfox4@gmail.com';
let MAX_TEXT = 2000;
let adminPassword = null; // held in memory only after successful unlock

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

// ---------- Result helpers ----------
function setResult(el, html, kind) {
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
    $('notify-email-label').textContent = NOTIFY_EMAIL;
    $('max-chars-label').textContent = MAX_TEXT;
    $('gen-text').setAttribute('maxlength', String(MAX_TEXT));
    $('gen-len').textContent = `0 / ${MAX_TEXT}`;
  } catch {}
  await refreshLocalRedeemedList();
})();

// ---------- Char counters ----------
$('redeem-input').addEventListener('input', (e) => {
  $('redeem-len').textContent = `${e.target.value.length} / 36`;
});
$('gen-text').addEventListener('input', (e) => {
  $('gen-len').textContent = `${e.target.value.length} / ${MAX_TEXT}`;
});
$('req-message').addEventListener('input', (e) => {
  $('req-msg-len').textContent = `${e.target.value.length} / 5000`;
});

// ---------- Redeem ----------
$('redeem-btn').addEventListener('click', async () => {
  const result = $('redeem-result');
  const key = $('redeem-input').value.trim();
  if (!key) {
    setResult(result, 'Please enter a key.', 'error');
    return;
  }
  setResult(result, 'Redeeming...');
  const r = await window.ultfox.redeemKey(key);
  if (!r.ok) {
    setResult(result, escapeHtml(r.error || 'Could not redeem key.'), 'error');
    return;
  }
  const text = r.text || '';
  const attachment = r.attachment_url || '';
  let html = `
    <div class="big">Congratulations! you have redeemed ${escapeHtml(text)}</div>
    <div class="muted">Key: <span class="mono">${escapeHtml(r.key)}</span></div>
  `;
  if (attachment) {
    html += `<div style="margin-top:8px;">Attachment: <a href="#" id="redeem-attach-link" data-url="${escapeHtml(attachment)}">${escapeHtml(attachment)}</a></div>`;
  }
  setResult(result, html, 'success');

  if (attachment) {
    const link = document.getElementById('redeem-attach-link');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.ultfox.openExternal(link.dataset.url);
      });
    }
  }

  // Notify owner via mailto
  const subject = encodeURIComponent(`[Ultfox] Key ${r.key} has been redeemed`);
  const body = encodeURIComponent(
    `${r.key} has been redeemed for ${text}\n\n` +
    (attachment ? `Attachment: ${attachment}\n\n` : '') +
    `Time: ${new Date().toISOString()}`
  );
  window.ultfox.openExternal(   `https://mail.google.com/mail/?view=cm&fs=1` +   `&to=${encodeURIComponent(NOTIFY_EMAIL)}` +   `&subject=${subject}` +   `&body=${body}` );

  $('redeem-input').value = '';
  $('redeem-len').textContent = '0 / 36';
  await refreshLocalRedeemedList();
});

$('redeem-request-btn').addEventListener('click', () => activateTab('request-panel'));

// ---------- Request a code ----------
$('req-send-btn').addEventListener('click', () => {
  const result = $('req-result');
  const name = $('req-name').value.trim();
  const reason = $('req-reason').value.trim();
  const message = $('req-message').value.trim();
  if (!name) {
    setResult(result, 'Please enter your name.', 'error');
    return;
  }
  if (!reason) {
    setResult(result, 'Please enter a reason / request.', 'error');
    return;
  }
  if (!message) {
    setResult(result, 'Please enter a message (up to 5000 chars).', 'error');
    return;
  }
  const subject = encodeURIComponent(`[Ultfox] Code request from ${name}`);
  const body = encodeURIComponent(
    `${name} has requested ${reason} and would like to say ${message}`
  );
  // (removed mailto fallback - using Gmail web compose)
  window.ultfox.openExternal(   `https://mail.google.com/mail/?view=cm&fs=1` +   `&to=${encodeURIComponent(NOTIFY_EMAIL)}` +   `&subject=${subject}` +   `&body=${body}` );
  setResult(result, 'Email opened in your default mail app. Send it to finish your request.', 'success');
});

// ---------- Admin gate ----------
$('admin-unlock-btn').addEventListener('click', async () => {
  const result = $('admin-gate-result');
  const pw = $('admin-pw').value;
  if (!pw) {
    setResult(result, 'Please enter the admin password.', 'error');
    return;
  }
  setResult(result, 'Verifying...');
  const r = await window.ultfox.verifyAdmin(pw);
  if (!r.ok) {
    setResult(result, escapeHtml(r.error || 'Incorrect password.'), 'error');
    return;
  }
  adminPassword = pw;
  $('admin-pw').value = '';
  setResult(result, '');
  $('admin-gate').classList.add('hidden');
  $('admin-menu').classList.remove('hidden');
  await Promise.all([refreshActiveList(), refreshServerRedeemedList(), refreshRevokedList()]);
});

$('admin-lock-btn').addEventListener('click', () => {
  adminPassword = null;
  $('admin-menu').classList.add('hidden');
  $('admin-gate').classList.remove('hidden');
  $('active-list').innerHTML = '';
  $('server-redeemed-list').innerHTML = '';
  $('revoked-list').innerHTML = '';
});

// ---------- Generate ----------
$('gen-btn').addEventListener('click', async () => {
  const result = $('gen-result');
  if (!adminPassword) {
    setResult(result, 'Locked. Re-enter the password.', 'error');
    return;
  }
  const text = $('gen-text').value;
  const attachmentUrl = $('gen-attachment').value.trim();
  if (text.length > MAX_TEXT) {
    setResult(result, `Text too long. Max ${MAX_TEXT} characters.`, 'error');
    return;
  }
  if (attachmentUrl && !/^https?:\/\//i.test(attachmentUrl)) {
    setResult(result, 'Attachment must be an http(s) URL (e.g. Google Drive share link).', 'error');
    return;
  }
  setResult(result, 'Generating...');
  const r = await window.ultfox.generateKey({ password: adminPassword, text, attachmentUrl });
  if (!r.ok) {
    setResult(result, escapeHtml(r.error || 'Could not generate.'), 'error');
    return;
  }
  setResult(
    result,
    `<div class="muted">New key (click to select):</div>
     <div class="key-display mono" id="gen-key-display">${escapeHtml(r.key)}</div>
     <div class="muted">Embedded text: <strong>${escapeHtml(text || '(empty)')}</strong></div>` +
     (attachmentUrl ? `<div class="muted">Attachment: ${escapeHtml(attachmentUrl)}</div>` : ''),
    'success'
  );
  $('gen-text').value = '';
  $('gen-attachment').value = '';
  $('gen-len').textContent = `0 / ${MAX_TEXT}`;
  await refreshActiveList();
});

// ---------- Revoke ----------
$('revoke-btn').addEventListener('click', async () => {
  const result = $('revoke-result');
  if (!adminPassword) {
    setResult(result, 'Locked. Re-enter the password.', 'error');
    return;
  }
  const key = $('revoke-input').value.trim();
  if (!key) {
    setResult(result, 'Please enter a key to revoke.', 'error');
    return;
  }
  setResult(result, 'Revoking...');
  const r = await window.ultfox.revokeKey({ password: adminPassword, key });
  if (!r.ok) {
    setResult(result, escapeHtml(r.error || 'Could not revoke.'), 'error');
    return;
  }
  setResult(result, 'Key revoked. It can never be redeemed.', 'success');
  $('revoke-input').value = '';
  await Promise.all([refreshActiveList(), refreshRevokedList()]);
});

// ---------- Lists ----------
function renderList(container, items, dateField, opts = {}) {
  if (!items.length) {
    container.innerHTML = '<div class="muted" style="padding:8px 4px;">Nothing here yet.</div>';
    return;
  }
  container.innerHTML = items
    .map((it) => {
      const when = it[dateField] ? new Date(it[dateField]).toLocaleString() : '';
      const attach = it.attachment_url
        ? `<div class="muted">Attachment: ${escapeHtml(it.attachment_url)}</div>`
        : '';
      const copyBtn = `<button class="btn small ghost" data-copy="${escapeHtml(it.key)}">Copy</button>`;
      const revokeBtn = opts.canRevoke
        ? `<button class="btn small danger" data-revoke="${escapeHtml(it.key)}">Revoke</button>`
        : '';
      return `
        <div class="history-item">
          <div>
            <div class="text">${escapeHtml(it.text || '(no text)')}</div>
            <div class="key mono">${escapeHtml(it.key)}</div>
            ${attach}
          </div>
          <div class="when muted">${escapeHtml(when)}</div>
          <div>${copyBtn}</div>
          <div>${revokeBtn}</div>
        </div>`;
    })
    .join('');

  container.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = 'Copy'), 1200);
      } catch {}
    });
  });
  container.querySelectorAll('[data-revoke]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!adminPassword) return;
      const r = await window.ultfox.revokeKey({ password: adminPassword, key: btn.dataset.revoke });
      if (r.ok) {
        await Promise.all([refreshActiveList(), refreshRevokedList()]);
      }
    });
  });
}

async function refreshLocalRedeemedList() {
  const list = (await window.ultfox.redeemedHistory()) || [];
  renderList($('redeemed-list'), list, 'redeemedAt');
}

async function loadServerSummary() {
  if (!adminPassword) return null;
  return window.ultfox.storeSummary(adminPassword);
}

async function refreshActiveList() {
  const r = await loadServerSummary();
  if (r?.ok) renderList($('active-list'), r.active, 'created_at', { canRevoke: true });
}
async function refreshServerRedeemedList() {
  const r = await loadServerSummary();
  if (r?.ok) renderList($('server-redeemed-list'), r.redeemed, 'redeemed_at');
}
async function refreshRevokedList() {
  const r = await loadServerSummary();
  if (r?.ok) renderList($('revoked-list'), r.revoked, 'revoked_at');
}

$('redeemed-refresh').addEventListener('click', refreshLocalRedeemedList);
$('active-refresh').addEventListener('click', refreshActiveList);
$('server-redeemed-refresh').addEventListener('click', refreshServerRedeemedList);
$('revoked-refresh').addEventListener('click', refreshRevokedList);
