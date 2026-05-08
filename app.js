/* ══════════════════════════════════════════════════
   SongVote — App logica
   Vereist: config.js geladen voor dit script
══════════════════════════════════════════════════ */

/*
  DATA STRUCTUUR
  --------------
  JSON bevat een object met twee velden:
  {
    users: { uid: displayName, ... },
    songs: [ {
      id, title, artist, links,
      suggesterComment, suggesterUid, suggesterName,
      thumbnailUrl, upvotes, downvotes,
      votes: { uid: 'up'|'down'|null },
      comments: [{ id, uid, text }]
    } ]
  }

  Oude JSON (array zonder users) wordt automatisch gemigreerd.
*/

// ── STATE ──────────────────────────────────────────
let songs      = [];
let users      = {};    // { uid: displayName }
let sortBy     = 'popularity';
let sortOrder  = 'desc';
let currentUid = null;
let editingId  = null;
let saveTimer  = null;
let isSaving   = false;
const cmntOpen = {};
const voteOpen = {};

// ── HELPERS ────────────────────────────────────────
function genUid() {
  return Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,6);
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function myName()     { return users[currentUid] || '?'; }
function nameOf(uid)  { return users[uid] || uid || '?'; }
function isAdmin()    { return myName().trim().toLowerCase() === CONFIG.ADMIN_USER.trim().toLowerCase(); }
function isOwner(s)   { return s.suggesterUid === currentUid; }

// ── GITHUB API ─────────────────────────────────────
const GH_API = `https://api.github.com/repos/${CONFIG.GH_OWNER}/${CONFIG.GH_REPO}/contents/${CONFIG.GH_DATA_FILE}`;

async function ghLoad() {
  showSync('Lijst laden…');
  try {
    const url = `https://raw.githubusercontent.com/${CONFIG.GH_OWNER}/${CONFIG.GH_REPO}/main/${CONFIG.GH_DATA_FILE}?t=${Date.now()}`;
    const r = await fetch(url);
    if (r.status === 404) { hideSync(); return; }
    if (!r.ok) { hideSync(); toast('Laden mislukt', 'err'); return; }
    applyData(await r.json());
  } catch(e) { console.warn('ghLoad', e); toast('Laden mislukt', 'err'); }
  hideSync();
}

function applyData(data) {
  if (Array.isArray(data)) {
    // Migreer oud formaat (array zonder users register)
    const nameToUid = {};
    data.forEach(s => {
      if (s.suggesterName && !nameToUid[s.suggesterName]) nameToUid[s.suggesterName] = genUid();
      if (s.votes) Object.keys(s.votes).forEach(n => { if (!nameToUid[n]) nameToUid[n] = genUid(); });
      (s.comments || []).forEach(c => { if (c.author && !nameToUid[c.author]) nameToUid[c.author] = genUid(); });
    });
    users = {};
    Object.entries(nameToUid).forEach(([n, u]) => users[u] = n);
    songs = data.map(s => ({
      ...s,
      suggesterUid: nameToUid[s.suggesterName] || genUid(),
      votes: Object.fromEntries(Object.entries(s.votes || {}).map(([n, v]) => [nameToUid[n] || genUid(), v])),
      comments: (s.comments || []).map(c => ({ ...c, uid: nameToUid[c.author || ''] || genUid() }))
    }));
  } else {
    users = data.users || {};
    songs = data.songs || [];
  }
}

function buildPayload() {
  return JSON.stringify({ users, songs }, null, 2);
}

async function ghSave() {
  if (isSaving) return;
  isSaving = true;
  showSync('Opslaan…');
  try {
    const metaR = await fetch(GH_API, {
      headers: { 'Authorization': `Bearer ${CONFIG.GH_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    let sha = null;
    if (metaR.ok) { const meta = await metaR.json(); sha = meta.sha; }

    const content = btoa(unescape(encodeURIComponent(buildPayload())));
    const body = { message: '💾 SongVote update', content };
    if (sha) body.sha = sha;

    const r = await fetch(GH_API, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CONFIG.GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (r.ok) toast('Opgeslagen ✓', 'ok');
    else { const e = await r.json(); console.error(e); toast('Opslaan mislukt', 'err'); }
  } catch(e) { console.warn(e); toast('Geen verbinding', 'err'); }
  isSaving = false;
  hideSync();
}

function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(ghSave, 1400); }
function showSync(m) { document.getElementById('sync-msg').textContent = m; document.getElementById('sync-bar').style.display = 'flex'; }
function hideSync() { document.getElementById('sync-bar').style.display = 'none'; }

// ── TOAST ──────────────────────────────────────────
let toastT;
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show ' + type;
  clearTimeout(toastT); toastT = setTimeout(() => el.className = '', 3200);
}

// ── YOUTUBE ────────────────────────────────────────
function ytId(url) {
  if (!url) return null;
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return (m && m[2].length === 11) ? m[2] : null;
}
function thumb(links) {
  const l = links.find(l => ytId(l));
  const id = l ? ytId(l) : null;
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

// ── USER / LOGIN ───────────────────────────────────
function getUsedNames() {
  return Object.values(users).map(n => n.trim().toLowerCase());
}

function loginWithUid(uid) {
  currentUid = uid;
  try { localStorage.setItem('sv_uid', uid); } catch {}
  const url = new URL(location.href);
  url.searchParams.set('uid', uid);
  url.searchParams.delete('user');
  history.replaceState({}, '', url.toString());
  document.getElementById('modal-user').style.display = 'none';
  renderHeader(); updateAdminControls(); renderSongs();
}

function registerUser(name) {
  name = name.trim();
  if (!name) return;
  const taken = getUsedNames();
  if (taken.includes(name.toLowerCase())) {
    const errEl = document.getElementById('inp-name-err');
    errEl.textContent = `"${name}" is al in gebruik. Kies een andere naam.`;
    errEl.style.display = 'block';
    return;
  }
  const uid = genUid();
  users[uid] = name;
  loginWithUid(uid);
  scheduleSave();
  toast(`Welkom, ${name}! 🎸`);
}

function changeUser() {
  const newName = (prompt('Nieuwe weergavenaam:', myName()) || '').trim();
  if (!newName || newName === myName()) return;
  const taken = Object.entries(users)
    .filter(([uid]) => uid !== currentUid)
    .map(([, n]) => n.trim().toLowerCase());
  if (taken.includes(newName.toLowerCase())) {
    toast(`"${newName}" is al in gebruik`, 'err'); return;
  }
  users[currentUid] = newName;
  renderHeader(); updateAdminControls(); renderSongs();
  scheduleSave();
  toast(`Naam gewijzigd naar ${newName}`);
}

function shareMyLink() {
  const url = new URL(location.href);
  url.searchParams.set('uid', currentUid);
  navigator.clipboard.writeText(url.toString())
    .then(() => toast('Jouw inloglink is gekopieerd! 🔗'))
    .catch(() => prompt('Kopieer jouw inloglink:', url.toString()));
}
// ── HEADER ─────────────────────────────────────────
function renderHeader() {
  const hr = document.getElementById('header-right');
  let h = '';
  if (currentUid && users[currentUid]) {
    h += `<div class="user-chip">
      <span class="user-dot"></span>
      <span class="user-chip-name">${esc(myName())}</span>
      <button class="btn-change" onclick="changeUser()">wijzig</button>
      <button class="btn-change" onclick="shareMyLink()" title="Kopieer jouw persoonlijke inloglink">🔗 deel link</button>
    </div>`;
  }
  hr.innerHTML = h;
}

// ── ADMIN ──────────────────────────────────────────
function updateAdminControls() {
  const a = isAdmin();
  document.getElementById('btn-import').style.display       = a ? 'inline-flex' : 'none';
  document.getElementById('btn-export').style.display       = a ? 'inline-flex' : 'none';
  document.getElementById('btn-manage-users').style.display = a ? 'inline-flex' : 'none';
}

// ── USER MANAGEMENT ────────────────────────────────
function openManageUsers() { renderUsersList(); document.getElementById('modal-users').style.display = 'flex'; }

function renderUsersList() {
  const el = document.getElementById('users-list');
  const entries = Object.entries(users).sort((a, b) => a[1].localeCompare(b[1], 'nl'));
  if (!entries.length) { el.innerHTML = `<p style="color:var(--muted);font-size:14px">Geen gebruikers.</p>`; return; }
  el.innerHTML = entries.map(([uid, name]) => {
    const adminTag = name.toLowerCase() === CONFIG.ADMIN_USER.toLowerCase() ? `<span class="user-tag">admin</span>` : '';
    const isMe = uid === currentUid;
    const canDel = !isMe && name.toLowerCase() !== CONFIG.ADMIN_USER.toLowerCase();
    const delBtn = canDel
      ? `<button class="btn-del-user" onclick="deleteUser('${esc(uid)}')" title="Verwijder">🗑️</button>`
      : `<span style="width:28px"></span>`;
    return `<div class="user-row">
      <span class="user-row-name">${esc(name)}${adminTag}${isMe ? ' <span style="font-size:11px;color:var(--muted)">(jij)</span>' : ''}</span>
      ${delBtn}
    </div>`;
  }).join('');
}

function deleteUser(uid) {
  const name = users[uid] || uid;
  if (!confirm(`"${name}" verwijderen inclusief alle stemmen, reacties en voorgestelde nummers?`)) return;
  songs.forEach(s => {
    if (s.votes && s.votes[uid]) {
      if (s.votes[uid] === 'up')   s.upvotes   = Math.max(0, s.upvotes - 1);
      if (s.votes[uid] === 'down') s.downvotes = Math.max(0, s.downvotes - 1);
      delete s.votes[uid];
    }
    s.comments = s.comments.filter(c => c.uid !== uid);
  });
  songs = songs.filter(s => s.suggesterUid !== uid);
  delete users[uid];
  renderUsersList(); renderSongs(); scheduleSave();
  toast(`${name} verwijderd`);
}

document.getElementById('btn-manage-users').onclick = openManageUsers;
document.getElementById('btn-users-close').onclick  = () => { document.getElementById('modal-users').style.display = 'none'; };

// ── LINKS HELPERS ──────────────────────────────────
function addLinkRow(wrap, val = '') {
  const d = document.createElement('div'); d.className = 'link-row';
  d.innerHTML = `<input type="url" value="${esc(val)}" placeholder="https://…"/>
    <button class="btn-rm" onclick="this.parentElement.remove()">−</button>`;
  wrap.appendChild(d);
}
document.getElementById('btn-new-addlink').onclick = () => addLinkRow(document.getElementById('new-links-wrap'));
document.getElementById('btn-edit-addlink').onclick = () => addLinkRow(document.getElementById('edit-links-wrap'));

// ── ADD SONG ───────────────────────────────────────
function addSong() {
  if (!currentUid) { toast('Voer eerst je naam in', 'err'); return; }
  const title   = document.getElementById('new-title').value.trim();
  const artist  = document.getElementById('new-artist').value.trim();
  const links   = [...document.querySelectorAll('#new-links-wrap input')].map(i => i.value.trim()).filter(Boolean);
  const comment = document.getElementById('new-comment').value.trim();
  const errEl   = document.getElementById('new-err');
  if (!title || !artist || !links.length) {
    errEl.textContent = 'Titel, artiest en minstens één link zijn verplicht.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  songs.unshift({
    id: Date.now(), title, artist, links,
    suggesterComment: comment,
    suggesterUid: currentUid,
    suggesterName: myName(),
    thumbnailUrl: thumb(links) || 'placeholder',
    upvotes: 0, downvotes: 0, comments: [], votes: {}
  });
  document.getElementById('new-title').value = '';
  document.getElementById('new-artist').value = '';
  document.getElementById('new-links-wrap').innerHTML = '<div class="link-row"><input type="url" placeholder="https://…"/></div>';
  document.getElementById('new-comment').value = '';
  renderSongs(); scheduleSave(); toast('Nummer toegevoegd!');
}

// ── EDIT SONG ──────────────────────────────────────
function openEdit(id) {
  const s = songs.find(s => s.id === id); if (!s) return;
  editingId = id;
  document.getElementById('edit-title').value   = s.title;
  document.getElementById('edit-artist').value  = s.artist;
  document.getElementById('edit-comment').value = s.suggesterComment || '';
  const lw = document.getElementById('edit-links-wrap'); lw.innerHTML = '';
  s.links.forEach(l => addLinkRow(lw, l));
  document.getElementById('modal-edit').style.display = 'flex';
}

document.getElementById('btn-edit-cancel').onclick = () => {
  document.getElementById('modal-edit').style.display = 'none'; editingId = null;
};
document.getElementById('btn-edit-save').onclick = () => {
  const title   = document.getElementById('edit-title').value.trim();
  const artist  = document.getElementById('edit-artist').value.trim();
  const links   = [...document.querySelectorAll('#edit-links-wrap input')].map(i => i.value.trim()).filter(Boolean);
  const comment = document.getElementById('edit-comment').value.trim();
  const errEl   = document.getElementById('edit-err');
  if (!title || !artist || !links.length) {
    errEl.textContent = 'Titel, artiest en minstens één link zijn verplicht.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  const s = songs.find(s => s.id === editingId);
  if (s) Object.assign(s, { title, artist, links, suggesterComment: comment, thumbnailUrl: thumb(links) || 'placeholder' });
  document.getElementById('modal-edit').style.display = 'none'; editingId = null;
  renderSongs(); scheduleSave(); toast('Nummer bijgewerkt');
};

// ── DELETE SONG ────────────────────────────────────
function deleteSong(id) {
  const s = songs.find(s => s.id === id); if (!s) return;
  if (!confirm(`"${s.title}" verwijderen?`)) return;
  songs = songs.filter(s => s.id !== id);
  renderSongs(); scheduleSave(); toast('Verwijderd');
}

// ── VOTE ───────────────────────────────────────────
function vote(id, type) {
  if (!currentUid) { toast('Voer eerst je naam in', 'err'); return; }
  const s = songs.find(s => s.id === id); if (!s) return;
  if (!s.votes) s.votes = {};
  const prev = s.votes[currentUid];
  if (prev === type) { s.votes[currentUid] = null; type === 'up' ? s.upvotes-- : s.downvotes--; }
  else {
    if (prev === 'up')   s.upvotes--;
    if (prev === 'down') s.downvotes--;
    s.votes[currentUid] = type;
    type === 'up' ? s.upvotes++ : s.downvotes++;
  }
  renderSongs(); scheduleSave();
}

// ── COMMENTS ───────────────────────────────────────
function toggleCmnt(id)  { cmntOpen[id] = !cmntOpen[id]; renderSongs(); }
function toggleVotes(id) { voteOpen[id] = !voteOpen[id]; renderSongs(); }

function addComment(id) {
  if (!currentUid) { toast('Voer eerst je naam in', 'err'); return; }
  const inp = document.getElementById('ci-' + id);
  if (!inp || !inp.value.trim()) return;
  const s = songs.find(s => s.id === id); if (!s) return;
  s.comments.push({ id: Date.now(), uid: currentUid, text: inp.value.trim() });
  renderSongs(); scheduleSave();
}

// ── SORT ───────────────────────────────────────────
document.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => {
  sortBy = b.dataset.sort;
  document.querySelectorAll('[data-sort]').forEach(x => x.classList.toggle('on', x === b));
  renderSongs();
});
document.querySelectorAll('[data-order]').forEach(b => b.onclick = () => {
  sortOrder = b.dataset.order;
  document.querySelectorAll('[data-order]').forEach(x => x.classList.toggle('on', x === b));
  renderSongs();
});

// ── IMPORT / EXPORT ────────────────────────────────
document.getElementById('btn-export').onclick = () => {
  const blob = new Blob([buildPayload()], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'songvote_backup.json'; a.click();
  URL.revokeObjectURL(url);
};
document.getElementById('btn-import').onclick = () => document.getElementById('file-import').click();
document.getElementById('file-import').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      applyData(JSON.parse(ev.target.result));
      renderSongs(); scheduleSave(); toast('Lijst geïmporteerd');
    } catch { toast('Kon bestand niet lezen', 'err'); }
  };
  r.readAsText(f); e.target.value = '';
};

// ── WHATSAPP EXPORT ────────────────────────────────
function buildWhatsAppText() {
  const sorted = [...songs].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  const date   = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  let txt = `🎸 *SongVote lijst* — ${date}\n\n`;
  sorted.forEach((s, i) => {
    txt += `${i + 1}. 🎵 *${s.title}*\n    ${s.artist}\n    👍 ${s.upvotes}  👎 ${s.downvotes}\n\n`;
  });
  txt += `_${sorted.length} nummer${sorted.length !== 1 ? 's' : ''} voorgesteld_`;
  return txt;
}
document.getElementById('btn-whatsapp').onclick = () => {
  document.getElementById('whatsapp-text').value = buildWhatsAppText();
  document.getElementById('modal-whatsapp').style.display = 'flex';
};
document.getElementById('btn-whatsapp-close').onclick = () => { document.getElementById('modal-whatsapp').style.display = 'none'; };
document.getElementById('btn-whatsapp-copy').onclick = () => {
  const ta = document.getElementById('whatsapp-text');
  navigator.clipboard.writeText(ta.value)
    .then(() => toast('Gekopieerd! 🎉'))
    .catch(() => { ta.select(); document.execCommand('copy'); toast('Gekopieerd!'); });
};

// ── RENDER SONGS ───────────────────────────────────
function renderSongs() {
  const sorted = [...songs].sort((a, b) => {
    const c = sortBy === 'popularity'
      ? (a.upvotes - a.downvotes) - (b.upvotes - b.downvotes)
      : a.title.localeCompare(b.title, 'nl');
    return sortBy === 'popularity'
      ? (sortOrder === 'asc' ? c : -c)
      : (sortOrder === 'desc' ? c : -c);
  });

  const el = document.getElementById('songs-list');
  if (!sorted.length) {
    el.innerHTML = `<div class="empty"><div class="e-icon">🎵</div><h3>Nog geen nummers voorgesteld</h3><p>Wees de eerste en gebruik het formulier hierboven!</p></div>`;
    return;
  }

  el.innerHTML = sorted.map(s => {
    const sc      = s.upvotes - s.downvotes;
    const scClass = sc > 0 ? 'pos' : sc < 0 ? 'neg' : 'neu';
    const scStr   = sc > 0 ? `+${sc}` : String(sc);
    const myVote  = (s.votes && currentUid) ? s.votes[currentUid] : null;

    const th = s.thumbnailUrl && s.thumbnailUrl !== 'placeholder'
      ? `<img src="${esc(s.thumbnailUrl)}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'"/><span class="no-art" style="display:none">♪</span>`
      : `<span class="no-art">♪</span>`;

    const lnks = s.links.map((l, i) => `<a class="link-pill" href="${esc(l)}" target="_blank" rel="noopener">🔗 Link ${i + 1}</a>`).join('');

    const ownerBtns = (isOwner(s) || isAdmin())
      ? `<div class="card-actions">
           <button class="icon-btn edit" onclick="openEdit(${s.id})" title="Bewerken">✏️</button>
           <button class="icon-btn del"  onclick="deleteSong(${s.id})" title="Verwijderen">🗑️</button>
         </div>` : '';

    const quote = s.suggesterComment ? `<div class="song-quote">"${esc(s.suggesterComment)}"</div>` : '';

    // Vote details
    const upVoters   = Object.entries(s.votes || {}).filter(([, v]) => v === 'up').map(([uid]) => nameOf(uid));
    const downVoters = Object.entries(s.votes || {}).filter(([, v]) => v === 'down').map(([uid]) => nameOf(uid));
    const vOpen = voteOpen[s.id];
    const voteDetailsHtml = vOpen ? `<div class="vote-details">
      <div class="vote-group">
        <div class="vote-group-label">👍 Voor (${upVoters.length})</div>
        ${upVoters.length
          ? upVoters.map(n => `<span class="vote-name up">✓ ${esc(n)}</span>`).join('')
          : `<span class="vote-name" style="color:var(--muted);font-style:italic">niemand</span>`}
      </div>
      <div class="vote-group">
        <div class="vote-group-label">👎 Tegen (${downVoters.length})</div>
        ${downVoters.length
          ? downVoters.map(n => `<span class="vote-name down">✗ ${esc(n)}</span>`).join('')
          : `<span class="vote-name" style="color:var(--muted);font-style:italic">niemand</span>`}
      </div>
    </div>` : '';

    // Comments
    const open = cmntOpen[s.id];
    const cmntHtml = open ? `<div class="cmnt-section">
      <div class="cmnt-list">${s.comments.length
        ? s.comments.map(c => `<div class="cmnt-item"><span class="cmnt-author">${esc(nameOf(c.uid))}</span>${esc(c.text)}</div>`).join('')
        : `<div class="cmnt-empty">Nog geen reacties.</div>`}
      </div>
      <div class="cmnt-form">
        <input type="text" id="ci-${s.id}" placeholder="Schrijf een reactie…" onkeydown="if(event.key==='Enter')addComment(${s.id})"/>
        <button class="cmnt-submit" onclick="addComment(${s.id})">Verstuur</button>
      </div>
    </div>` : '';

    const suggesterName = nameOf(s.suggesterUid) || s.suggesterName || '?';

    return `<div class="song-card">
      <div class="song-main">
        <a class="song-thumb" href="${esc(s.links[0] || '#')}" target="_blank" rel="noopener">${th}</a>
        <div class="song-body">
          <div class="song-top">
            <div class="song-meta">
              <div class="song-title">${esc(s.title)}</div>
              <div class="song-artist">${esc(s.artist)}</div>
              <div class="song-by">door <strong>${esc(suggesterName)}</strong></div>
            </div>${ownerBtns}
          </div>
          <div class="song-links">${lnks}</div>${quote}
        </div>
      </div>
      <div class="song-foot">
        <div class="votes">
          <button class="vote-btn up${myVote === 'up' ? ' voted-up' : ''}" onclick="vote(${s.id},'up')">👍 ${s.upvotes}</button>
          <button class="vote-btn down${myVote === 'down' ? ' voted-down' : ''}" onclick="vote(${s.id},'down')">👎 ${s.downvotes}</button>
        </div>
        <span class="score ${scClass}" style="cursor:pointer" onclick="toggleVotes(${s.id})" title="Wie heeft gestemd?">${scStr}</span>
        <button class="cmnt-toggle" onclick="toggleCmnt(${s.id})">💬 ${s.comments.length}</button>
      </div>${voteDetailsHtml}${cmntHtml}
    </div>`;
  }).join('');
}

// ── BOOTSTRAP ──────────────────────────────────────
document.getElementById('btn-set-user').onclick = () => registerUser(document.getElementById('inp-name').value);
document.getElementById('inp-name').addEventListener('keydown', e => { if (e.key === 'Enter') registerUser(document.getElementById('inp-name').value); });
document.getElementById('btn-add-song').onclick = addSong;

async function init() {
  await ghLoad();

  const urlUid    = new URLSearchParams(location.search).get('uid');
  const storedUid = (() => { try { return localStorage.getItem('sv_uid'); } catch { return null; } })();
  const uid       = urlUid || storedUid;

  if (uid && users[uid]) {
    currentUid = uid;
    try { localStorage.setItem('sv_uid', uid); } catch {}
    const url = new URL(location.href);
    url.searchParams.set('uid', uid);
    history.replaceState({}, '', url.toString());
    document.getElementById('modal-user').style.display = 'none';
  }

  renderHeader();
  updateAdminControls();
  renderSongs();
}

init();
