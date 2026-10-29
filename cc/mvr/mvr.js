// Driver MVRs: the page. Talks only to Control Center on this computer.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

async function api(method, url, body) {
  const res = await fetch(`/mvr/api/${url}`, {
    method,
    headers: { 'X-Control-Center': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || `Request failed (${res.status}).`), { needsKey: data?.needsKey });
  return data;
}

function toast(msg, { error = false, timeout = 6000 } = {}) {
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), timeout);
}

const S = { settings: null, drivers: [], driver: null, recId: null, view: 'start', q: '', busy: 0 };
const main = $('#main');

// ---------- driver list ----------
function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderDrivers() {
  const q = S.q.toLowerCase();
  const list = S.drivers.filter((d) => !q || d.name.toLowerCase().includes(q));
  $('#drivers').innerHTML = list.length ? list.map((d) => {
    const l = d.latest;
    const dot = l.statusOk === false ? 'bad' : l.high ? 'bad' : l.medium ? 'warn' : 'ok';
    const marks = [l.high ? `<span class="count high" title="${l.high} serious">${l.high}</span>` : '', l.medium ? `<span class="count medium" title="${l.medium} to review">${l.medium}</span>` : ''].join('');
    return `<li><button type="button" data-folder="${esc(d.folder)}" aria-current="${S.driver?.folder === d.folder}">
      <span class="dn">${esc(d.name)}</span>
      <span class="marks">${marks}<span class="dot ${dot}" title="${esc(l.status || '')}"></span></span>
      <span class="dd">${esc(fmtDate(l.uploadedAt))}${d.count > 1 ? ` · ${d.count} MVRs` : ''}</span>
    </button></li>`;
  }).join('') : `<li class="empty">${S.drivers.length ? 'No driver matches.' : 'Drivers you upload an MVR for will be listed here.'}</li>`;
}

async function loadDrivers() {
  try { S.drivers = await api('GET', 'drivers'); } catch (e) { toast(e.message, { error: true }); }
  renderDrivers();
}

$('#drivers').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-folder]');
  if (b) openDriver(b.dataset.folder);
});
$('#search').addEventListener('input', (e) => { S.q = e.target.value; renderDrivers(); });

async function openDriver(folder, recId) {
  try {
    S.driver = await api('GET', `drivers/${encodeURIComponent(folder)}`);
  } catch (e) { toast(e.message, { error: true }); return; }
  S.recId = recId || S.driver.records[0]?.id;
  S.view = 'record';
  $('#app').classList.remove('list');
  renderDrivers();
  render();
}

// ---------- the main area ----------
function render() {
  if (S.view === 'settings') return renderSettings();
  if (S.view === 'reading') return renderReading();
  if (!S.settings?.hasKey) return renderSettings(true);
  if (S.view === 'record' && S.driver) return renderRecord();
  renderStart();
}

function renderStart() {
  main.innerHTML = `<div class="wrap">
    <div class="drop" id="dropZone" role="button" tabindex="0">
      <div class="big-i">${icon('upload')}</div>
      <h2>Drop a driver’s MVR here</h2>
      <p>or click to choose the file (PDF or a photo). Claude reads it and writes the summary in about half a minute.</p>
    </div>
    <p class="muted small" style="margin-top:12px">Every MVR and its summary is saved in <span class="path">${esc(S.settings.folder)}</span></p>
  </div>`;
  $('#dropZone').addEventListener('click', () => $('#fileInput').click());
  $('#dropZone').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); } });
}

function renderReading() {
  main.innerHTML = `<div class="wrap"><div class="card reading"><div class="spinner"></div>
    <h3 style="justify-content:center">Reading the MVR…</h3>
    <p class="muted">${esc(S.readingName || '')}<br>This usually takes 20–40 seconds.</p></div></div>`;
}

const val = (v) => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? '<span class="muted">—</span>' : esc(Array.isArray(v) ? v.join(', ') : v));
const SEV = { high: 'Serious', medium: 'Review', low: 'Note' };

function renderRecord() {
  const d = S.driver;
  const r = d.records.find((x) => x.id === S.recId) || d.records[0];
  if (!r) return renderStart();
  const v = r.driver || {};
  const statusChip = `<span class="chip ${v.statusOk ? 'ok' : 'bad'}">License: ${esc(v.status || (v.statusOk ? 'Valid' : 'Not valid'))}</span>`;
  const chips = [statusChip, v.licenseClass && `<span class="chip">${esc(v.licenseClass)}</span>`, v.state && `<span class="chip">${esc(v.state)}</span>`,
    v.expirationDate && `<span class="chip">Expires ${esc(v.expirationDate)}</span>`].filter(Boolean).join('');
  const flags = (r.flags || []).length
    ? `<ul class="flags">${r.flags.map((f) => `<li class="${esc(f.severity)}"><span class="tag">${SEV[f.severity] || ''}</span><span>${esc(f.text)}</span></li>`).join('')}</ul>`
    : `<div class="clean">${icon('check')}Nothing that needs attention.</div>`;
  const table = (rows, cols, empty) => (rows?.length
    ? `<div class="table-wrap"><table><thead><tr>${cols.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((x) => `<tr>${cols.map(([k, , f]) => `<td>${f ? f(x[k], x) : val(x[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<p class="none">${empty}</p>`);
  const yesNo = (b) => (b === true || /^y/i.test(b) ? 'Yes' : b === false || /^n/i.test(b) ? 'No' : '<span class="muted">—</span>');
  const others = d.records.filter((x) => x.id !== r.id);

  main.innerHTML = `<div class="wrap">
    <button class="btn back" type="button" data-go="list">${icon('back')}All drivers</button>
    <div class="rec-head">
      <div>
        <h2>${esc(v.name || d.name)}</h2>
        <div class="sub">MVR uploaded ${esc(fmtDate(r.uploadedAt))}${v.reportDate ? ` · report dated ${esc(v.reportDate)}` : ''}${r.id !== d.records[0].id ? ' · <b>older MVR</b>' : ''}</div>
        <div class="chips">${chips}</div>
      </div>
      <div class="actions">
        <a class="btn" href="/mvr/api/file?id=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">${icon('open')}Open the MVR</a>
        <button class="btn" type="button" data-go="folder">${icon('folder')}Show folder</button>
      </div>
    </div>

    <div class="card"><h3>Summary</h3><p class="synopsis">${esc(r.synopsis)}</p></div>
    <div class="card"><h3>Needs attention <span class="n">${(r.flags || []).length || ''}</span></h3>${flags}</div>

    <div class="card"><h3>License</h3><dl class="facts">
      <div><dt>License number</dt><dd>${val(v.licenseNumber)}</dd></div>
      <div><dt>Date of birth</dt><dd>${val(v.dateOfBirth)}</dd></div>
      <div><dt>Status</dt><dd>${val(v.status)}</dd></div>
      <div><dt>Class</dt><dd>${val(v.licenseClass)}</dd></div>
      <div><dt>Endorsements</dt><dd>${val(v.endorsements)}</dd></div>
      <div><dt>Restrictions</dt><dd>${val(v.restrictions)}</dd></div>
      <div><dt>Issued</dt><dd>${val(v.issueDate)}</dd></div>
      <div><dt>Expires</dt><dd>${val(v.expirationDate)}</dd></div>
      <div><dt>Medical certificate</dt><dd>${val(v.medicalCertificate)}</dd></div>
      <div><dt>Record covers</dt><dd>${val(v.yearsCovered)}</dd></div>
    </dl></div>

    <div class="card"><h3>Violations <span class="n">${(r.violations || []).length || ''}</span></h3>
      ${table(r.violations, [['date', 'Date'], ['description', 'Violation'], ['location', 'Where'], ['points', 'Points'], ['inCommercialVehicle', 'In a CMV', yesNo], ['convictionDate', 'Convicted']], 'No violations on record.')}</div>
    <div class="card"><h3>Accidents <span class="n">${(r.accidents || []).length || ''}</span></h3>
      ${table(r.accidents, [['date', 'Date'], ['description', 'What happened'], ['location', 'Where'], ['atFault', 'At fault'], ['injuriesOrFatalities', 'Injuries']], 'No accidents on record.')}</div>
    <div class="card"><h3>Suspensions and revocations <span class="n">${(r.suspensions || []).length || ''}</span></h3>
      ${table(r.suspensions, [['type', 'Type'], ['startDate', 'From'], ['endDate', 'Until'], ['reason', 'Reason'], ['current', 'Still in effect', yesNo]], 'None on record.')}</div>
    ${(r.otherNotes || []).length ? `<div class="card"><h3>Other notes</h3><ul class="notes">${r.otherNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}

    ${others.length ? `<div class="card"><h3>Other MVRs for this driver <span class="n">${others.length}</span></h3><ul class="history">${d.records.map((x) => `
      <li><button type="button" data-rec="${esc(x.id)}" aria-current="${x.id === r.id}"><span class="dot ${x.driver?.statusOk === false ? 'bad' : (x.flags || []).some((f) => f.severity === 'high') ? 'bad' : (x.flags || []).some((f) => f.severity === 'medium') ? 'warn' : 'ok'}"></span>
      <span class="grow">${esc(fmtDate(x.uploadedAt))}${x.id === d.records[0].id ? ' (latest)' : ''}</span><span class="muted small">${esc(x.driver?.status || '')} · ${(x.violations || []).length} violations · ${(x.accidents || []).length} accidents</span></button></li>`).join('')}</ul></div>` : ''}

    <p style="margin-top:22px"><button class="btn danger" type="button" data-go="delete">${icon('trash')}Delete this MVR</button>
      <span class="muted small">&nbsp;Moved to the “_Deleted” folder, not erased.</span></p>
    <p class="muted small">Summary written by Claude from the MVR. Always check the original before making a hiring decision.</p>
  </div>`;
}

main.addEventListener('click', async (e) => {
  const rec = e.target.closest('[data-rec]');
  if (rec) { S.recId = rec.dataset.rec; renderRecord(); main.scrollTop = 0; return; }
  const go = e.target.closest('[data-go]')?.dataset.go;
  if (go === 'list') { $('#app').classList.add('list'); return; }
  if (go === 'folder') { api('POST', 'open-folder', { folder: S.driver.folder }).catch((err) => toast(err.message, { error: true })); return; }
  if (go === 'delete') {
    if (!window.confirm('Delete this MVR and its summary? (They are moved to the “_Deleted” folder.)')) return;
    try {
      await api('POST', 'delete', { id: S.recId });
      toast('MVR deleted.');
      await loadDrivers();
      const still = S.drivers.find((d) => d.folder === S.driver.folder);
      if (still) openDriver(still.folder); else { S.driver = null; S.view = 'start'; render(); }
    } catch (err) { toast(err.message, { error: true }); }
  }
});

// ---------- settings ----------
function renderSettings(firstTime = false) {
  const s = S.settings || {};
  main.innerHTML = `<div class="wrap setup">
    ${firstTime ? '<h2 style="margin:0 0 4px">Set up Driver MVRs</h2><p class="muted" style="margin:0">One-time setup, about 5 minutes.</p>' : '<h2 style="margin:0">Settings</h2>'}
    <div class="card"><h3>1. Your Anthropic API key</h3>
      <p style="margin:0 0 6px">Claude reads the MVRs using your own key. ${s.hasKey ? `<b>A key is saved</b> (ending ${esc(s.keyHint)}).` : 'No key yet.'}</p>
      ${s.hasKey ? '' : `<ol>
        <li>Go to <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a> and sign up or sign in.</li>
        <li>Open <b>Billing</b> and add credit. $5 covers roughly 100–200 MVRs.</li>
        <li>Open <b>API keys</b>, click <b>Create key</b>, name it “Control Center”, and copy it.</li>
        <li>Paste it below and click <b>Save key</b>.</li></ol>`}
      <form class="field" id="keyForm"><input type="password" name="key" placeholder="${s.hasKey ? 'Paste a new key to replace it' : 'sk-ant-…'}" autocomplete="off" spellcheck="false">
        <button class="btn primary" type="submit">Save key</button></form>
      <p class="muted small">Kept only on this computer. Enter it on your other computer too.</p>
    </div>
    <div class="card"><h3>2. Where MVRs are kept</h3>
      <p style="margin:0 0 8px"><span class="path">${esc(s.folder || '')}</span> ${s.folderExists ? '' : '<span class="muted small">(created when you upload the first MVR)</span>'}</p>
      <p class="muted small" style="margin:0 0 10px">${s.isDefaultFolder ? 'This is in your OneDrive, so your other computer sees the same drivers once OneDrive syncs. ' : ''}Each driver gets a folder with their MVRs and summaries.</p>
      <div class="actions"><button class="btn" type="button" data-set="pick">${icon('folder')}Choose another folder</button>
        ${s.folderExists ? `<button class="btn" type="button" data-set="open">${icon('open')}Open folder</button>` : ''}</div>
    </div>
    ${firstTime ? '' : '<p><button class="btn" type="button" data-set="done">Done</button></p>'}
  </div>`;
  $('#keyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = e.target.key.value.trim();
    if (!key) return;
    try {
      S.settings = await api('POST', 'settings', { apiKey: key });
      toast('Key saved.');
      S.view = 'start';
      render();
    } catch (err) { toast(err.message, { error: true }); }
  });
}

main.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-set]');
  if (!b) return;
  if (b.dataset.set === 'done') { S.view = S.driver ? 'record' : 'start'; render(); return; }
  if (b.dataset.set === 'open') { api('POST', 'open-folder', {}).catch((err) => toast(err.message, { error: true })); return; }
  if (b.dataset.set === 'pick') {
    try {
      const r = await api('POST', 'settings/pick');
      if (r.picked) { S.settings = r.settings; await loadDrivers(); render(); }
    } catch {
      const p = window.prompt('Paste the folder location (for example C:\\Users\\you\\OneDrive\\Driver MVRs):');
      if (!p) return;
      try { S.settings = await api('POST', 'settings', { folder: p }); await loadDrivers(); render(); } catch (err) { toast(err.message, { error: true }); }
    }
  }
});

$('#settingsBtn').innerHTML = icon('settings');
$('#settingsBtn').addEventListener('click', () => { S.view = 'settings'; $('#app').classList.remove('list'); render(); });

// ---------- uploading ----------
$('#uploadBtn').innerHTML = `${icon('upload')}Upload an MVR`;
$('#uploadBtn').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', (e) => { uploadFiles([...e.target.files]); e.target.value = ''; });

const OK_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Couldn’t read the file.'));
    r.readAsDataURL(file);
  });
}

async function uploadFiles(files) {
  if (!S.settings?.hasKey) { toast('Add your Anthropic API key first.', { error: true }); S.view = 'settings'; render(); return; }
  for (const file of files) {
    const type = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
    if (!OK_TYPES.includes(type)) { toast(`${file.name}: upload a PDF or a photo (JPG/PNG).`, { error: true }); continue; }
    if (file.size > 30 * 1024 * 1024) { toast(`${file.name} is too large (over 30 MB).`, { error: true }); continue; }
    S.view = 'reading';
    S.readingName = file.name;
    render();
    try {
      const rec = await api('POST', 'upload', { name: file.name, type, data: await readAsBase64(file) });
      await loadDrivers();
      await openDriver(rec.folder, rec.id);
    } catch (e) {
      toast(`${file.name}: ${e.message}`, { error: true, timeout: 12000 });
      S.view = e.needsKey ? 'settings' : S.driver ? 'record' : 'start';
      render();
    }
  }
}

// Drop a file anywhere on the page.
let depth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
document.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; $('#veil').hidden = false; } });
document.addEventListener('dragleave', (e) => { if (hasFiles(e) && --depth <= 0) { depth = 0; $('#veil').hidden = true; } });
document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  depth = 0;
  $('#veil').hidden = true;
  uploadFiles([...e.dataTransfer.files]);
});

// ---------- start ----------
async function init() {
  try { S.settings = await api('GET', 'settings'); } catch {
    main.innerHTML = '<div class="wrap"><p>Control Center isn’t running. Start it again, then reload this page.</p></div>';
    return;
  }
  await loadDrivers();
  const want = new URLSearchParams(location.search).get('driver');
  if (want && S.drivers.some((d) => d.folder === want)) openDriver(want);
  else render();
}
init();

// Opened again from the side menu (or a driver was added from elsewhere): refresh the list.
// The list also picks up files you add to the OneDrive folders yourself.
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.cc !== 'event') return;
  if ((e.data.type === 'shown' || e.data.type === 'mvr') && S.settings) loadDrivers();
});
