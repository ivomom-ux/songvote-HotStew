/* ══════════════════════════════════════════════════
   SongVote — Excel export / import (beoordelingslijst)
   Vereist: config.js en app.js geladen voor dit script
══════════════════════════════════════════════════ */

/*
  WAAROM
  ------
  De beoordelingslijst werd los in Excel bijgehouden. Daardoor was hij
  verouderd zodra iemand stemde, en ging handmatig ingevulde info verloren
  bij een nieuwe export.

  OPLOSSING
  ---------
  De app is de enige bron van waarheid. De handmatige beoordelingskolommen
  worden per nummer opgeslagen in songvote_data.json onder `review`:

    review: { genre, categorie, matchZang, hotstew, blazers,
              bekendheid, dansbaarheid }

  Export bouwt op elk moment een verse xlsx uit live stemmen + opgeslagen
  beoordeling. Import leest een ingevulde xlsx en zet alleen die
  beoordelingskolommen terug. Stemmen, titels en reacties worden nooit
  aangeraakt.
*/

// ── KOLOMMEN ───────────────────────────────────────
// Handmatige kolommen: deze gaan heen en weer tussen app en Excel.
const REVIEW_COLS = [
  { key: 'genre',        header: 'Genre',          type: 'text'  },
  { key: 'categorie',    header: 'Categorie',      type: 'text'  },
  { key: 'matchZang',    header: 'Match met zang', type: 'score' },
  { key: 'hotstew',      header: 'HotStew factor', type: 'score' },
  { key: 'blazers',      header: 'Blazersfactor',  type: 'score' },
  { key: 'bekendheid',   header: 'Bekendheid',     type: 'score' },
  { key: 'dansbaarheid', header: 'Dansbaarheid',   type: 'score' },
];

// Volledige kolomvolgorde in het werkblad.
const SHEET_COLS = [
  { header: 'Nummer',           w: 46 },
  { header: 'Artiest',          w: 26 },
  ...REVIEW_COLS.map(c => ({ header: c.header, w: c.type === 'score' ? 14 : 16 })),
  { header: 'Populariteit',     w: 13 },
  { header: 'Totaal',           w: 10 },
  { header: 'Opmerking',        w: 40 },
  { header: 'Voorgesteld door', w: 18 },
  { header: 'Aantal stemmers',  w: 15 },
  { header: 'Link',             w: 40 },
  { header: 'ID',               w: 15 },
];

function colOf(header) { return SHEET_COLS.findIndex(c => c.header === header); }

const HEADER_ROW = 3;                       // 1-based rij met de kolomkoppen
const COL_MATCH  = colOf('Match met zang'); // eerste kolom van de somreeks
const COL_POP    = colOf('Populariteit');   // laatste kolom van de somreeks
const COL_TOTAL  = colOf('Totaal');

// ── HELPERS ────────────────────────────────────────
// Normaliseert voor vergelijken: accenten weg, alleen letters en cijfers.
// Vangt ook mojibake op: een kapotte ’ verdwijnt gewoon.
function xlNorm(s) {
  return String(s == null ? '' : s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}
function xlScore(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim());
  return isFinite(n) ? Math.round(n * 10) / 10 : null;
}
function xlText(v) {
  const t = String(v == null ? '' : v).trim();
  return t || null;
}
// Wie heeft daadwerkelijk een stem uitgebracht; een teruggenomen stem telt niet mee.
function voterCount(s) {
  return Object.values(s.votes || {}).filter(v => v).length;
}
function pushInto(map, key, val) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(val);
}

// ── SHEETJS LAZY LOAD ──────────────────────────────
// Alleen ophalen als iemand echt op een Excel-knop drukt.
let xlsxPromise = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxPromise) return xlsxPromise;
  const urls = [
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  ];
  xlsxPromise = new Promise((resolve, reject) => {
    let i = 0;
    (function next() {
      if (i >= urls.length) { xlsxPromise = null; reject(new Error('SheetJS niet geladen')); return; }
      const sc = document.createElement('script');
      sc.src = urls[i++];
      sc.onload  = () => resolve(window.XLSX);
      sc.onerror = next;
      document.head.appendChild(sc);
    })();
  });
  return xlsxPromise;
}

// ── EXPORT ─────────────────────────────────────────
function buildSheetRows() {
  const sorted = [...songs].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  return sorted.map(s => {
    const r = s.review || {};
    return [
      s.title,
      s.artist,
      ...REVIEW_COLS.map(c => (r[c.key] === undefined || r[c.key] === null) ? '' : r[c.key]),
      s.upvotes - s.downvotes,
      '',                                   // Totaal — wordt hieronder een formule
      s.suggesterComment || '',
      nameOf(s.suggesterUid) || s.suggesterName || '',
      voterCount(s),
      (s.links || [])[0] || '',
      String(s.id),
    ];
  });
}

async function exportExcel() {
  const XLSX  = await loadXlsx();
  const stamp = new Date();
  const nl    = stamp.toLocaleString('nl-NL',
    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const aoa = [
    [`Hot Stew repertoire keuzelijst, export ${nl}`],
    ['Vul alleen Genre t/m Dansbaarheid in. De overige kolommen worden bij elke export ververst vanuit de app. Laat de kolom ID staan.'],
    SHEET_COLS.map(c => c.header),
    ...buildSheetRows(),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Totaal als echte Excel-formule, zodat hij meerekent zodra iemand scoort.
  // Onder de 3 op "Match met zang" valt het nummer af: dan telt de rest niet.
  for (let r = HEADER_ROW; r < aoa.length; r++) {
    const excelRow = r + 1;                 // 1-based rijnummer voor de formule
    const from = XLSX.utils.encode_col(COL_MATCH) + excelRow;
    const to   = XLSX.utils.encode_col(COL_POP)   + excelRow;
    ws[XLSX.utils.encode_cell({ r, c: COL_TOTAL })] = { t: 'n', f: `IF(${from}<3,0,SUM(${from}:${to})*4)` };
  }

  ws['!cols']   = SHEET_COLS.map(c => ({ wch: c.w }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({
    s: { r: HEADER_ROW - 1, c: 0 },
    e: { r: aoa.length - 1, c: SHEET_COLS.length - 1 },
  }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Keuzelijst');
  XLSX.writeFile(wb, `Repertoire_keuzelijst_${stamp.toISOString().slice(0, 10)}.xlsx`);
  toast(`Excel geëxporteerd (${songs.length} nummers) 📊`);
}

// ── IMPORT ─────────────────────────────────────────
// Leest een ingevulde lijst en zet alleen de beoordelingskolommen terug.
// Koppelt op ID; ontbreekt die kolom (zoals in de oude handgemaakte lijst),
// dan op titel + artiest en anders op titel alleen.
function readSheet(XLSX, buf) {
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('leeg werkblad');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true, defval: '' });

  const hIdx = rows.findIndex(r => (r || []).some(c => xlNorm(c) === 'nummer'));
  if (hIdx < 0) throw new Error('geen kolom "Nummer" gevonden');

  const head = {};
  (rows[hIdx] || []).forEach((c, i) => { const k = xlNorm(c); if (k && !(k in head)) head[k] = i; });
  return { rows: rows.slice(hIdx + 1), head };
}

function cellOf(row, head, header) {
  const i = head[xlNorm(header)];
  return i === undefined ? '' : row[i];
}

function resolveSong(row, head, idx) {
  const id = String(cellOf(row, head, 'ID') || '').trim();
  if (id && idx.byId.has(id)) return { song: idx.byId.get(id) };

  const rawTitle = cellOf(row, head, 'Nummer');
  const title    = xlNorm(rawTitle);
  if (!title) return { skip: true };
  const artist = xlNorm(cellOf(row, head, 'Artiest'));

  if (artist) {
    const hit = idx.byTitleArtist.get(title + '|' + artist);
    if (hit && hit.length === 1) return { song: hit[0] };
  }
  const hit = idx.byTitle.get(title);
  if (hit && hit.length === 1) return { song: hit[0] };
  if (hit && hit.length > 1)   return { ambiguous: rawTitle };
  return { missing: rawTitle };
}

function reviewFromRow(row, head) {
  const out = {};
  let any = false;
  for (const c of REVIEW_COLS) {
    const parsed = c.type === 'score'
      ? xlScore(cellOf(row, head, c.header))
      : xlText(cellOf(row, head, c.header));
    if (parsed !== null) { out[c.key] = parsed; any = true; }
  }
  return any ? out : null;
}

async function importExcel(file) {
  const XLSX = await loadXlsx();
  const { rows, head } = readSheet(XLSX, await file.arrayBuffer());

  const idx = { byId: new Map(), byTitle: new Map(), byTitleArtist: new Map() };
  songs.forEach(s => {
    const t = xlNorm(s.title);
    idx.byId.set(String(s.id), s);
    pushInto(idx.byTitle, t, s);
    pushInto(idx.byTitleArtist, t + '|' + xlNorm(s.artist), s);
  });

  const changes = [], missing = [], ambiguous = [];
  for (const row of rows) {
    const res = resolveSong(row, head, idx);
    if (res.skip)      continue;
    if (res.missing)   { missing.push(res.missing);     continue; }
    if (res.ambiguous) { ambiguous.push(res.ambiguous); continue; }
    const next = reviewFromRow(row, head);
    const prev = res.song.review || null;
    if (JSON.stringify(prev) !== JSON.stringify(next)) changes.push({ song: res.song, next });
  }

  const lines = [
    `Bestand: ${file.name}`, '',
    `• ${rows.length} regels gelezen`,
    `• ${changes.length} nummer(s) met een gewijzigde beoordeling`,
  ];
  if (missing.length)   lines.push(`• ${missing.length} niet teruggevonden: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
  if (ambiguous.length) lines.push(`• ${ambiguous.length} dubbele titel, overgeslagen: ${ambiguous.slice(0, 5).join(', ')}`);

  if (!changes.length) { alert(lines.join('\n') + '\n\nEr valt niets bij te werken.'); return; }

  lines.push('', 'Alleen de beoordelingskolommen worden overgenomen.',
             'Stemmen, titels en reacties blijven ongewijzigd.', '', 'Doorvoeren?');
  if (!confirm(lines.join('\n'))) { toast('Import geannuleerd'); return; }

  changes.forEach(({ song, next }) => { if (next) song.review = next; else delete song.review; });
  renderSongs(); scheduleSave();
  toast(`${changes.length} beoordeling(en) bijgewerkt ✓`);
}

// ── KNOPPEN ────────────────────────────────────────
document.getElementById('btn-xls-export').onclick = () => {
  if (!isAdmin()) return;
  exportExcel().catch(e => { console.error(e); toast('Excel-export mislukt', 'err'); });
};
document.getElementById('btn-xls-import').onclick = () => {
  if (!isAdmin()) return;
  document.getElementById('file-xls-import').click();
};
document.getElementById('file-xls-import').onchange = e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  importExcel(f).catch(err => { console.error(err); toast(`Kon Excel niet lezen: ${err.message}`, 'err'); });
};
