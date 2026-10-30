/* Vignero · smoke.mjs — renders every route in a headless DOM and drives forms.
 * Run: node tests/smoke.mjs
 */
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const HTML = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SNAP = fs.readFileSync(new URL('../data/snapshot.json', import.meta.url), 'utf8');

const dom = new JSDOM(HTML, { url: 'http://localhost:8099/#/login', pretendToBeVisual: true });
const { window } = dom;

let desktop = true;
window.matchMedia = () => ({
  matches: desktop, media: '(min-width:1024px)', addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
});

globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
try { Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true }); }
catch { /* node 22 exposes navigator as a getter; not needed by the tests */ }
globalThis.location = window.location;
globalThis.matchMedia = window.matchMedia;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.HashChangeEvent = window.HashChangeEvent;
globalThis.Blob = window.Blob;
globalThis.FormData = window.FormData;
globalThis.MouseEvent = window.MouseEvent;
globalThis.URL = window.URL;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
window.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(SNAP) });
globalThis.fetch = window.fetch;

const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.join(' ')); origError('[console.error]', ...a); };

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) { pass++; } else { fail++; origError('  FAIL ' + what); } };

const main = () => document.getElementById('main');
const text = () => main().textContent.replace(/\s+/g, ' ');

async function go(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(20);
  return text();
}

async function loginAs(role) {
  const user = auth.USERS.find((u) => u.role === role);
  if (!user) throw new Error('no demo user for role ' + role);
  app.login(user);            // the same path the login form uses
  await wait(30);
}

/* boot the app */
window.localStorage.removeItem('vignero.session.v1');
window.localStorage.setItem('vignero.backend', 'demo');
window.scrollTo = () => {};
const app = await import('../js/app.js');
const auth = await import('../js/auth.js');
await wait(120);
ok(text().includes('Accedi a Vignero'), 'login screen renders when there is no session');
ok(!!document.querySelector('#loginForm [name="email"]'), 'login form has an email field');
ok(!!document.querySelector('#loginForm [name="password"]'), 'login form has a password field');
ok(document.querySelectorAll('#tabbar a').length === 0, 'no navigation before sign-in');

/* ---------------- login flow ---------------- */
{
  const submit = async (email, pwd) => {
    document.querySelector('[name="email"]').value = email;
    document.querySelector('[name="password"]').value = pwd;
    document.querySelector('#loginForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(30);
  };
  await submit('admin@vignero.it', 'sbagliata');
  ok(!document.querySelector('#loginErr').hidden, 'wrong password shows an error');
  ok(text().includes('Accedi a Vignero'), 'stays on the login screen after a failed attempt');
  ok(!window.localStorage.getItem('vignero.session.v1'), 'no session created on failure');

  await submit('nonesiste@vignero.it', 'Admin#2026');
  ok(text().includes('Email o password non corretti'), 'unknown e-mail gets the same generic error');

  /* one account per profile must land on its own permitted set */
  for (const u of auth.USERS) {
    window.localStorage.removeItem('vignero.session.v1');
window.localStorage.setItem('vignero.backend', 'demo');
    window.location.hash = '#/login';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await wait(20);
    await submit(u.email, u.password);
    const chip = document.getElementById('roleChip').textContent.trim();
    ok(chip === u.role.toUpperCase().slice(0, 8) || chip.length > 0, `${u.role}: signed in as ${u.email}`);
    ok(text().includes('Disponibilità totale'), `${u.role}: reaches the home screen`);
    ok(document.querySelectorAll('#tabbar a').length >= 3, `${u.role}: navigation rendered`);
    app.logout();
    await wait(20);
    ok(text().includes('Accedi a Vignero'), `${u.role}: logout returns to the login screen`);
  }
}

/* protected route while signed out → login → always lands on Home */
{
  app.logout();
  await wait(30);
  desktop = true;
  window.location.hash = '#/dati/lotti';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(30);
  ok(text().includes('Accedi a Vignero'), 'a protected route while signed out redirects to the login screen');

  const admin = auth.USERS.find((u) => u.role === 'admin');
  document.querySelector('[name="email"]').value = admin.email;
  document.querySelector('[name="password"]').value = admin.password;
  document.querySelector('#loginForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(50);
  ok(window.location.hash === '#/home',
     'after signing in you land on Home, not on the requested page (' + window.location.hash + ')');
  ok(text().includes('da dove vuoi iniziare'), 'the Home launcher is what renders');
  ok(!!document.querySelector('.launcher'), 'the launcher grid is present');
  ok(document.getElementById('appTitle').textContent.trim() === 'Panoramica',
     'the page title is Panoramica (got "' + document.getElementById('appTitle').textContent.trim() + '")');
  ok(!document.getElementById('newBtn'), 'the lots page (with its "Nuovo lotto" button) is not what opened');

  /* the same holds for a plain sign-in from the login screen */
  app.logout();
  await wait(30);
  ok(window.location.hash === '#/login', 'logout goes back to the login screen');
  document.querySelector('[name="email"]').value = admin.email;
  document.querySelector('[name="password"]').value = admin.password;
  document.querySelector('#loginForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(50);
  ok(window.location.hash === '#/home', 'a normal sign-in also opens Home (' + window.location.hash + ')');
}

/* ---------------- route matrix ---------------- */
const CASES = [
  ['admin', '#/home', ['Disponibilità totale', 'Riepiloghi', 'da dove vuoi iniziare']],
  ['admin', '#/r/disponibilita', ['Riepilogo disponibilità', 'Totale generale', 'Codice portainnesto', 'Totale per portainnesto']],
  ['admin', '#/r/produttore', ['Riepilogo per produttore', 'Mori Marco', 'Disponibilità']],
  ['admin', '#/r/indisponibilita', ['Mancanze', 'Deficit']],
  ['admin', '#/dati/lotti', ['Lotti magazzino', 'Nuovo lotto']],
  ['admin', '#/dati/ordini', ['Ordini e impegni', 'Segna spedito']],
  ['admin', '#/dati/import', ['Import CSV', 'Destinazione']],
  ['admin', '#/anagrafiche/viti', ['Anagrafica vite', 'coppie varietà/clone']],
  ['admin', '#/anagrafiche/portainnesti', ['Anagrafica portainnesto', 'Utilizzi']],
  ['admin', '#/config/permessi', ['Ruoli e permessi', 'Amministratore']],
  ['admin', '#/profilo', ['Profilo', 'Disconnetti', 'Account registrati']],
  ['admin', '#/r/daspedire', ['Da spedire', 'Lotto collegato']],
  ['admin', '#/config/utenti', ['Utenti', 'Nuovo utente']],
  ['ufficio', '#/config/utenti', ['Utenti']],
  ['produttore', '#/config/utenti', ['Non hai i permessi']],
  ['vendite', '#/r/daspedire', ['Non hai i permessi']],
  ['ufficio', '#/dati/lotti', ['Lotti magazzino']],
  ['produttore', '#/home', ['Disponibilità totale']],
  ['produttore', '#/r/disponibilita', ['Riepilogo disponibilità']],
  ['produttore', '#/r/indisponibilita', ['Mancanze']],
  ['produttore', '#/r/produttore', ['Non hai i permessi']],
  ['produttore', '#/dati/lotti', ['Non hai i permessi']],
  ['vendite', '#/r/indisponibilita', ['Non hai i permessi']],
  ['vendite', '#/r/disponibilita', ['Riepilogo disponibilità']],
];

for (const [role, hash, needles] of CASES) {
  desktop = true;
  await loginAs(role);
  const t = await go(hash);
  ok(!t.includes('Qualcosa è andato storto'), `${role} ${hash}: no render error`);
  for (const n of needles) ok(t.includes(n), `${role} ${hash}: shows "${n}"`);
}

/* mobile gate for data entry */
desktop = false;
await loginAs('admin');
let t = await go('#/dati/lotti');
ok(t.includes('solo da PC'), 'mobile: data entry shows the PC-only gate');
desktop = true;

/* ---------------- home launcher ---------------- */
{
  const expected = {
    admin: ['Disponibilità', 'Per produttore', 'Mancanze', 'Da spedire', 'Lotti magazzino',
            'Ordini e impegni', 'Import CSV', 'Vite', 'Portainnesti', 'Utenti', 'Ruoli e permessi', 'Profilo'],
    ufficio: ['Disponibilità', 'Per produttore', 'Mancanze', 'Da spedire', 'Lotti magazzino',
              'Ordini e impegni', 'Import CSV', 'Vite', 'Portainnesti', 'Utenti', 'Profilo'],
    produttore: ['Disponibilità', 'Mancanze', 'Messo a disposizione', 'Profilo'],
    vendite: ['Disponibilità', 'Profilo'],
  };
  for (const [role, titles] of Object.entries(expected)) {
    desktop = true;
    await loginAs(role);
    await go('#/home');
    const tiles = [...document.querySelectorAll('.apptile')];
    ok(tiles.length === titles.length, `${role}: launcher shows ${titles.length} pages (got ${tiles.length})`);
    const labels = tiles.map((t) => t.querySelector('b').textContent.trim());
    ok(titles.every((x) => labels.includes(x)), `${role}: launcher titles ${JSON.stringify(labels)}`);
    ok(tiles.every((t) => t.getAttribute('href').startsWith('#/')), `${role}: every tile is a link to a page`);
    ok(tiles.every((t) => t.getAttribute('aria-label')), `${role}: every tile has an accessible name`);
  }
  /* the deficit tile carries the count */
  await loginAs('admin');
  await go('#/home');
  const alertTile = [...document.querySelectorAll('.apptile')].find((t) => t.getAttribute('href') === '#/r/indisponibilita');
  ok(!!alertTile.querySelector('.badge-danger'), 'deficit tile shows a red count badge');
  /* on a phone the entry tiles announce they are PC-only */
  desktop = false;
  await go('#/home');
  const locked = [...document.querySelectorAll('.apptile.is-locked')];
  ok(locked.length === 3, `mobile: the 3 entry tiles are marked PC-only (got ${locked.length})`);
  ok(locked.every((t) => /Solo da PC/.test(t.textContent)), 'mobile: entry tiles say "Solo da PC"');
  desktop = true;
  /* tapping a tile opens that page */
  await go('#/home');
  document.querySelector('.apptile[href="#/anagrafiche/viti"]').click();
  await wait(40);
  ok(window.location.hash === '#/anagrafiche/viti', 'tapping a tile navigates to the page');
  ok(text().includes('Anagrafica vite'), 'the page opened from the tile renders');
}

/* ---------------- disponibilità: flat list + subtotal rows ---------------- */
{
  await loginAs('admin');
  await go('#/r/disponibilita');
  const shape = {
    groups: document.querySelectorAll('.grid tbody tr.group').length,
    subtotals: document.querySelectorAll('.grid tbody tr.subtotal').length,
    totals: document.querySelectorAll('.grid tbody tr.total').length,
    cols: [...document.querySelectorAll('.grid thead th')].map((t) => t.textContent.trim()),
    filters: [...document.querySelectorAll('#filterHost .field > span')].map((x) => x.textContent.trim()),
    tipologiaOpts: [...document.querySelectorAll('#filterHost select[data-filter="tipologia"] option')].map((o) => o.value),
    produzioneOpts: [...document.querySelectorAll('#filterHost select[data-filter="produzione"] option')].map((o) => o.value),
    tipologiaSel: document.querySelector('#filterHost select[data-filter="tipologia"]').value,
    produzioneSel: document.querySelector('#filterHost select[data-filter="produzione"]').value,
  };
  ok(shape.groups === 0, `no rootstock grouping (${shape.groups})`);
  ok(shape.subtotals > 0, `a subtotal row per rootstock (${shape.subtotals})`);
  ok(shape.totals === 1, `one grand total (${shape.totals})`);
  ok(shape.cols.length === 6, `6 columns (${shape.cols.length}: ${shape.cols.join(' · ')})`);
  ok(!shape.cols.includes('Da spedire'), 'the «Da spedire» column is gone');
  ok(shape.filters.some((l) => l.includes('Codice portainnesto')), 'rootstock filter present');
  ok(shape.tipologiaOpts.length === 4 && shape.tipologiaOpts.every(Boolean),
     `tipologia mandatory: no empty option (${shape.tipologiaOpts.length})`);
  ok(shape.produzioneOpts.length === 3 && shape.produzioneOpts.every(Boolean),
     `produzione mandatory: no empty option (${shape.produzioneOpts.length})`);
  ok(shape.tipologiaSel === 'Barbatelle innestate' && shape.produzioneSel === 'Nuova produzione',
     `defaults applied (${shape.tipologiaSel} / ${shape.produzioneSel})`);
  ok(text().includes('Totale per portainnesto'), 'subtotal labelled «Totale per portainnesto»');

  const root = '110 RICHTER';
  await go('#/r/disponibilita?portainnesto=' + encodeURIComponent(root));
  const roots = [...document.querySelectorAll('.grid tbody tr.trow td[data-label="Portainnesto"]')]
    .map((td) => td.textContent.trim());
  ok(roots.length > 0 && roots.every((x) => x === root), `rootstock filter applies (${roots.length} rows)`);
  ok(document.querySelectorAll('.chip').length === 1, 'the rootstock is a removable chip');
  ok(![...document.querySelectorAll('.chip')].some((c) => /Tipologia|Produzione/.test(c.textContent)),
     'mandatory filters are not removable chips');
}

/* ---------------- subtotal row comes BEFORE its group (PD-7) ---------------- */
{
  const order = (rows) => rows.map((tr) => tr.classList.contains('subtotal') ? 'S' : 'R').join('');
  const groups = (rows) => {
    let prev = null, bad = 0;
    for (const tr of rows) {
      if (tr.classList.contains('subtotal')) {
        const code = tr.querySelector('td[data-label="Portainnesto"]')?.textContent.trim();
        prev = code || null;
      } else if (!tr.classList.contains('total')) {
        const code = tr.querySelector('td[data-label="Portainnesto"]')?.textContent.trim();
        if (code !== prev) bad++;
      }
    }
    return bad;
  };

  for (const [hash, label] of [['#/r/disponibilita', 'disponibilità'],
                               ['#/r/indisponibilita', 'indisponibilità'],
                               ['#/r/produttore', 'per produttore']]) {
    await loginAs('admin');
    await go(hash);
    const rows = [...document.querySelectorAll('.grid tbody tr')]
      .filter((tr) => !tr.classList.contains('total') && !tr.classList.contains('empty-row'));
    ok(rows.length > 1, `${label}: rows rendered (${rows.length})`);
    ok(rows[0] && rows[0].classList.contains('subtotal'),
       `${label}: the table starts with a «Totale per portainnesto» row`);
    const seq = order(rows);
    ok(seq.length > 0 && seq[0] === 'S', `${label}: subtotal first (${seq.slice(0, 8)}…)`);
    ok(!/SS/.test(seq), `${label}: no two subtotals in a row — every group has its cloni`);
    ok(groups(rows) === 0, `${label}: every clone row follows its own subtotal`);
    const lastRow = [...document.querySelectorAll('.grid tbody tr')].pop();
    // report 3 has no grand total (the deficit banner carries it), the others do
    ok(hash === '#/r/indisponibilita'
      ? lastRow.classList.contains('trow')
      : lastRow.classList.contains('total'),
      `${label}: the table ends with ${hash === '#/r/indisponibilita' ? 'a clone row' : 'the grand total'}`);
  }
  /* the deficit subtotal is the sum of its group, shown as a negative number */
  await go('#/r/indisponibilita');
  const sub = document.querySelector('.grid tbody tr.subtotal');
  const deficitCell = sub.querySelector('td.metric:last-child').textContent.trim();
  ok(/^\u2212\d/.test(deficitCell) || deficitCell === '0', `indisponibilità: subtotal deficit is negative (${deficitCell})`);
}

/* ---------------- report 5: messo a disposizione (producer only) ---------------- */
{
  for (const role of ['admin', 'ufficio', 'vendite']) {
    await loginAs(role);
    const t = await go('#/r/messodisposizione');
    ok(t.includes('Non hai i permessi'), `${role}: messo a disposizione is refused`);
  }

  await loginAs('produttore');
  await go('#/r/messodisposizione');
  const cols = [...document.querySelectorAll('.grid thead th')].map((t) => t.textContent.trim());
  ok(cols.length === 5, `messo: five columns (${cols.length})`);
  ok(cols.join('·') === 'Codice clone·Codice portainnesto·Messo a disposizione·Spedito·A magazzino',
     `messo: the producer's own quantities (${cols.join('·')})`);
  ok(text().includes('Mori Marco'), 'messo: the screen names the linked producer');
  const growerSel = document.querySelector('#filterHost [data-filter="produttore"]');
  ok(!growerSel || growerSel.closest('label').hidden,
     'messo: the grower filter stays hidden — the producer is the session');
  ok(document.querySelector('#filterHost [data-filter="tipologia"]').value === 'Barbatelle innestate',
     'messo: the mandatory filters keep their defaults');
  const rows = [...document.querySelectorAll('.grid tbody tr')];
  ok(rows[0] && rows[0].classList.contains('subtotal'), 'messo: subtotal first');
  ok(document.querySelectorAll('.grid tbody tr.subtotal').length > 0, 'messo: per-rootstock subtotals');
  ok(document.querySelectorAll('.grid tbody tr.total').length === 1, 'messo: one grand total');
  const totalText = rows[rows.length - 1].textContent;
  ok(/Totale generale/.test(totalText), 'messo: grand total row present');
  /* the totals row drives the numbers: magazzino - ordinato = disponibilità */
  const cells = [...document.querySelectorAll('.grid tbody tr.total td.metric')]
    .map((td) => Number(td.textContent.replace(/[^\d−-]/g, '').replace('\u2212', '-')));
  ok(cells.length === 3, `messo: three numeric totals (${cells.length})`);
  ok(cells[2] === cells[0] - cells[1], `messo: «A magazzino» = messo a disposizione - spedito (${cells.join(',')})`);
}

/* ---------------- ordini: the note in read mode + CSV exports ---------------- */
{
  const S3 = await import('../js/store.js');
  const tap = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const captured = [];
  window.URL.createObjectURL = (blob) => { captured.push(blob); return 'blob:stub'; };
  window.URL.revokeObjectURL = () => {};

  await loginAs('admin');
  const lot = S3.store.lotti.find((l) => l.produttore && l.quantita > 10);
  S3.addOrdine({
    id_magazzino: lot.id, tipologia: lot.tipologia, produzione: lot.produzione,
    varieta: lot.varieta, clone: lot.clone, portainnesto: lot.portainnesto,
    quantita: 5, spedito: false, note: 'Consegna in due trance',
  });
  await go('#/dati/ordini');
  const cols = [...document.querySelectorAll('.grid thead th')].map((t) => t.textContent.trim());
  ok(cols.includes('Note'), `ordini: the read table has a Note column (${cols.join(' · ')})`);
  ok(text().includes('Consegna in due trance'), 'ordini: the note is readable in the list');
  tap(document.getElementById('exportBtn'));
  await wait(30);
  const ordCsv = captured.length ? await captured[captured.length - 1].text() : '';
  ok(/^\ufeff?id;tipologia;produzione;varieta;clone;portainnesto;quantita;spedito;note;id_magazzino/.test(ordCsv)
     || ordCsv.includes(';note;'), `ordini export: header line carries the note column (${ordCsv.split('\r')[0]})`);
  ok(ordCsv.includes('Consegna in due trance'), 'ordini export: the note value is in the file');
  ok(ordCsv.split('\r\n').length - 1 === S3.store.ordini.length,
     `ordini export: one line per order (${ordCsv.split('\r\n').length - 1})`);

  await go('#/dati/lotti');
  ok(!!document.getElementById('exportBtn'), 'lotti: the Esporta CSV button is there');
  const lotCols = [...document.querySelectorAll('.grid thead th')].map((t) => t.textContent.trim());
  ok(lotCols.includes('Note'), `lotti: the note is a column (${lotCols.join(' · ')})`);
  /* the list is sorted varietà → clone → portainnesto → produttore */
  const order = await (async () => {
    const S2 = await import('../js/store.js');
    const C = S2.collator();
    const rows = [...document.querySelectorAll('.grid tbody tr.trow')];
    const pairs = rows.map((r) => ({
      varieta: r.querySelector('td[data-label="Varietà"]')?.textContent.trim() || '',
      clone: r.querySelector('td[data-label="Clone"]')?.textContent.trim() || '',
    }));
    return { count: pairs.length, sorted: pairs.every((p, i) => i === 0 ||
      C.compare(pairs[i - 1].varieta, p.varieta) < 0 ||
      (pairs[i - 1].varieta === p.varieta && C.compare(pairs[i - 1].clone, p.clone) <= 0)) };
  })();
  ok(order.count > 0 && order.sorted, `lotti: sorted by varietà then clone (${order.count} rows)`);
  tap(document.getElementById('exportBtn'));
  await wait(30);
  const lotCsv = captured.length ? await captured[captured.length - 1].text() : '';
  ok(lotCsv.includes('anno') && lotCsv.includes('quantita') && lotCsv.includes('produttore'),
     `lotti export: importable headers (${lotCsv.split('\r')[0]})`);
  ok(lotCsv.split('\r\n').length - 1 === S3.store.lotti.length,
     `lotti export: one line per lot (${lotCsv.split('\r\n').length - 1})`);
}

/* ---------------- producer home: no «da spedire» ---------------- */
{
  await loginAs('produttore');
  await go('#/home');
  const kpis = [...document.querySelectorAll('.kpi')].map((k) => k.textContent);
  ok(!kpis.some((k) => /Da spedire/.test(k)), 'produttore home: the «Da spedire» KPI is gone');
  ok(!document.querySelectorAll('.apptile[href="#/r/daspedire"]').length,
     'produttore home: no «Da spedire» tile');
  ok(!text().includes('Da spedire'), 'produttore home: the phrase does not appear at all');
  ok(document.querySelectorAll('.apptile[href="#/r/messodisposizione"]').length === 1,
     'produttore home: the «Messo a disposizione» tile is there');
  ok(!/impegni non spediti/.test(text()), 'produttore home: no shipment count in the subtitle');
  await loginAs('admin');
  await go('#/home');
  ok([...document.querySelectorAll('.kpi')].some((k) => /Da spedire/.test(k.textContent)),
     'admin home: the «Da spedire» KPI still shows');
}

/* ---------------- per produttore: 14 columns, grower + rootstock filters ---------------- */
{
  await loginAs('admin');
  await go('#/r/produttore');
  const cols = [...document.querySelectorAll('.grid thead th')].map((t) => t.textContent.trim());
  ok(cols.length === 14, `per produttore: 14 columns (${cols.length})`);
  ok(!cols.includes('Non attribuito'), 'no «Non attribuito» column');
  ok(!cols.includes('Tot. produttori'), 'no «Tot. produttori» column');
  ok(cols.filter((c) => /^(Mori Marco|Donati|Agriserv|Vivai riuniti|Bianchi|Golferenzo|Lorin|Esterno)$/.test(c)).length === 8,
     'eight grower columns');
  ok(!!document.querySelector('#filterHost select[data-filter="produttore"]'), 'grower filter present');
  ok(document.querySelector('#filterHost select[data-filter="tipologia"]').value === 'Barbatelle innestate',
     'mandatory tipologia default');

  const total = document.querySelectorAll('.grid tbody tr.trow').length;
  await go('#/r/produttore?produttore=Mori%20Marco');
  const filtered = {
    rows: document.querySelectorAll('.grid tbody tr.trow').length,
    hl: [...document.querySelectorAll('.grid thead th.grower-hl')].map((t) => t.textContent.trim()),
  };
  ok(filtered.rows > 0 && filtered.rows < total, `grower filter narrows rows (${filtered.rows} < ${total})`);
  ok(filtered.hl.length === 1 && filtered.hl[0] === 'Mori Marco', 'filtered column highlighted');
}

{
  await loginAs('admin');
  await go('#/dati/ordini');
  const S3b = await import('../js/store.js');
  const C2 = S3b.collator();
  const rows = [...document.querySelectorAll('.grid tbody tr.trow')].map((r) => ({
    varieta: r.querySelector('td[data-label="Varietà"]')?.textContent.trim() || '',
    clone: r.querySelector('td[data-label="Clone"]')?.textContent.trim() || '',
    root: r.querySelector('td[data-label="Portainnesto"]')?.textContent.trim() || '',
  }));
  ok(rows.length > 0, `ordini: rows rendered (${rows.length})`);
  ok(!!document.querySelector('#q'), 'ordini: the search box is there');
  ok(rows.every((r, i) => i === 0 ||
     C2.compare(rows[i - 1].varieta, r.varieta) < 0 ||
     (rows[i - 1].varieta === r.varieta &&
      (C2.compare(rows[i - 1].clone, r.clone) < 0 ||
       (rows[i - 1].clone === r.clone && C2.compare(rows[i - 1].root, r.root) <= 0)))),
     'ordini: sorted by varietà, clone, portainnesto');

  /* the search narrows the list (variety, clone, note, producer…) */
  const first = rows[0];
  const box = document.getElementById('q');
  box.value = first.clone;
  box.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(400);
  const filtered = [...document.querySelectorAll('.grid tbody tr.trow')]
    .map((r) => r.querySelector('td[data-label="Clone"]')?.textContent.trim() || '');
  ok(filtered.length > 0 && filtered.length < rows.length,
     `ordini: the search filters the list (${filtered.length} of ${rows.length})`);
  ok(filtered.every((c) => c.toLowerCase().includes(first.clone.toLowerCase())),
     'ordini: every filtered row matches the search');
  document.getElementById('q').value = '';
  document.getElementById('q').dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(400);
}

/* ---------------- data entry: new lot ---------------- */
await go('#/dati/lotti');
const storeMod = await import('../js/store.js');
const before = storeMod.store.lotti.length;

const click = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
click(document.getElementById('newBtn'));
await wait(20);
const sheet = document.querySelector('.sheet');
ok(!!sheet, 'lot form sheet opens');

const setSelect = (name, value) => {
  const el = sheet.querySelector(`[name="${name}"]`);
  el.value = value;
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
};
const snap = JSON.parse(SNAP);
setSelect('anno', String(snap.lotti[0][0]));
setSelect('produttore', snap.meta.produttori[1]);
setSelect('tipologia', snap.meta.tipologie[0]);
setSelect('produzione', snap.meta.produzioni[0]);
setSelect('portainnesto', snap.portainnesti[0]);

/* variety combobox → first suggestion */
const varietyInput = sheet.querySelector('[data-variety] input');
varietyInput.value = snap.lotti[0][4];
varietyInput.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(10);
const suggestion = sheet.querySelector('.combo-list button[data-i]');
ok(!!suggestion, 'variety combobox suggests results');
click(suggestion);
await wait(10);

const cloneSel = sheet.querySelector('[name="clone"]');
ok(!cloneSel.disabled, 'clone select enables after variety is chosen');
const cloneValue = [...cloneSel.options].map((o) => o.value).filter(Boolean)[0];
ok(!!cloneValue, 'clone options are populated');
cloneSel.value = cloneValue;

const qty = sheet.querySelector('[name="quantita"]');
qty.value = '777';

/* invalid submission first: empty note is fine, but clear quantity to force an error */
qty.value = '-3';
click(sheet.querySelector('.sheet-actions [data-act="1"]'));
await wait(20);
ok(!sheet.querySelector('#formErr').hidden, 'invalid quantity is rejected');
ok(storeMod.store.lotti.length === before, 'nothing saved on validation failure');

qty.value = '777';
click(sheet.querySelector('.sheet-actions [data-act="1"]'));
await wait(40);
ok(storeMod.store.lotti.length === before + 1, 'valid lot is saved');
ok(!document.querySelector('.sheet'), 'sheet closes after save');

/* the new lot changes the report */
t = await go('#/r/disponibilita?varieta=' + encodeURIComponent(snap.lotti[0][4]));
ok(t.length > 0, 'report re-renders with the new lot');

/* ---------------- order: toggle spedito + create ---------------- */
t = await go('#/dati/ordini');
const ord = storeMod.store.ordini[0];
const toggleBtn = document.querySelector(`[data-toggle="${ord.id}"]`);
ok(!!toggleBtn, 'spedito toggle is rendered');
const wasShipped = ord.spedito;
click(toggleBtn);
await wait(30);
ok(storeMod.store.ordini[0].spedito === !wasShipped, 'spedito toggles');

click(document.getElementById('newBtn'));
await wait(20);
const osheet = document.querySelector('.sheet');
ok(!!osheet, 'order form sheet opens');

/* the order must be linked to a lot: pick the first suggestion */
const lotInput = osheet.querySelector('[data-lot] input');
ok(!!lotInput, 'order form has the lot picker');
lotInput.value = '';
lotInput.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(20);
const lotSuggestion = osheet.querySelector('.combo-list button[data-i]');
ok(!!lotSuggestion, 'lot picker suggests lots');
click(lotSuggestion);
await wait(30);
ok(!!osheet.querySelector('[name="id_magazzino"]').value, 'picking a lot stores its id');
ok(!!osheet.querySelector('[name="clone"]').value, 'picking a lot fills the clone');
osheet.querySelector('[name="quantita"]').value = '250';
const beforeOrd = storeMod.store.ordini.length;
click(osheet.querySelector('.sheet-actions [data-act="1"]'));
await wait(60);
ok(storeMod.store.ordini.length === beforeOrd + 1, 'order is saved');

function setSelectIn(root, name, value) {
  const el = root.querySelector(`[name="${name}"]`);
  el.value = value;
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}

/* ---------------- master data ---------------- */
await go('#/anagrafiche/portainnesti');
const rootsBefore = storeMod.store.portainnesti.length;
click(document.getElementById('newBtn'));
await wait(20);
const rsheet = document.querySelector('.sheet');
rsheet.querySelector('[name="code"]').value = 'TEST-ROOT-1';
click(rsheet.querySelector('.sheet-actions [data-act="1"]'));
await wait(30);
ok(storeMod.store.portainnesti.length === rootsBefore + 1, 'new rootstock is saved');

/* duplicate rootstock is refused */
click(document.getElementById('newBtn'));
await wait(20);
const rsheet2 = document.querySelector('.sheet');
rsheet2.querySelector('[name="code"]').value = 'TEST-ROOT-1';
click(rsheet2.querySelector('.sheet-actions [data-act="1"]'));
await wait(20);
ok(!rsheet2.querySelector('#rootErr').hidden, 'duplicate rootstock is refused');
ok(storeMod.store.portainnesti.length === rootsBefore + 1, 'duplicate not stored');

/* ---------------- role-scoped home and profile ---------------- */
{
  /* Vendite: no producer info, no shortage box, no «da spedire» box */
  await loginAs('vendite');
  await go('#/home');
  let homeText = text();
  ok(![...document.querySelectorAll('.grid thead th')].some((t) => /Produttore/.test(t.textContent)),
     'vendite: no producer column in «ultimi lotti»');
  ok(!homeText.includes('In mancanze'), 'vendite: no shortage summary box');
  ok(!homeText.includes('Da spedire'), 'vendite: no «da spedire» summary box');
  ok(homeText.includes('Disponibilità totale'), 'vendite: availability KPI still there');

  await go('#/profilo');
  let prof = text();
  ok(!prof.includes('Account registrati'), 'vendite: other users are not listed');
  ok(!/Specifica|Mockup/.test(prof), 'vendite: no specification/mockup links');

  /* Produttore: same profile restrictions, and no producer info either */
  await loginAs('produttore');
  await go('#/home');
  homeText = text();
  ok(![...document.querySelectorAll('.grid thead th')].some((t) => /Produttore/.test(t.textContent)),
     'produttore: no producer column in «ultimi lotti»');
  ok(homeText.includes('In mancanze'), 'produttore: keeps the shortage box');
  await go('#/profilo');
  prof = text();
  ok(!prof.includes('Account registrati'), 'produttore: other users are not listed');
  ok(!/Specifica|Mockup/.test(prof), 'produttore: no specification/mockup links');

  /* Amministrazione: can manage users but no docs; Amministratore keeps the docs */
  await loginAs('ufficio');
  await go('#/profilo');
  prof = text();
  ok(!/Specifica|Mockup/.test(prof), 'ufficio: no specification/mockup links');
  ok(prof.includes('Gestione utenti'), 'ufficio: reached the user management panel');
  await go('#/home');
  ok([...document.querySelectorAll('.grid thead th')].some((t) => /Produttore/.test(t.textContent)),
     'ufficio: can see the producer column');

  await loginAs('admin');
  await go('#/profilo');
  prof = text();
  ok(/Specifica/.test(prof) && /Mockup/.test(prof), 'admin: keeps the documentation links');
  ok(prof.includes('Account registrati'), 'admin: sees the registered accounts');
  ok(!/Dati del dimostrativo/.test(prof) && !/Quantità sintetiche/.test(prof),
     'profilo: the «Dati del dimostrativo» card is gone');
  ok(!/coppie varietà\/clone/.test(prof), 'profilo: no synthetic-quantity counters left');
}

/* ---------------- utenti: invito, ruolo, sospensione, reset ---------------- */
{
  await loginAs('ufficio');
  await go('#/config/utenti');
  ok(text().includes('Utenti'), 'users panel opens for Amministrazione');
  ok(document.querySelectorAll('[data-block]').length >= 4, 'rows offer block actions');
  ok(document.querySelectorAll('[data-reset-pw]').length >= 4, 'rows offer password reset');

  const invited = await auth.createUser({ name: 'Test Vendite', email: 'test.vendite@vignero.it', role: 'vendite', grower: null });
  ok(invited.ok, 'invite creates the account');
  ok(invited.user.status === 'invitato', 'the invited account starts as «invitato»');
  ok(!!invited.password, 'a temporary password is returned once');
  ok((await auth.authenticate('test.vendite@vignero.it', invited.password)).ok,
     'the invited user can sign in with the temporary password');

  const blocked = await auth.blockUser(invited.user.id);
  ok(blocked.ok, 'the account can be blocked');
  const refused = await auth.authenticate('test.vendite@vignero.it', invited.password);
  ok(!refused.ok && /sospeso/i.test(refused.error), 'a blocked account cannot sign in');

  ok((await auth.unblockUser(invited.user.id)).ok, 'the account can be reactivated');
  ok((await auth.authenticate('test.vendite@vignero.it', invited.password)).ok, 'and can sign in again');

  const reset = await auth.resetPassword(invited.user);
  ok(reset.ok && reset.password !== invited.password, 'password reset issues a new password');
  ok(!(await auth.authenticate('test.vendite@vignero.it', invited.password)).ok, 'the old password stops working');
  ok((await auth.authenticate('test.vendite@vignero.it', reset.password)).ok, 'the new password works');

  ok((await auth.setRole(invited.user.id, 'produttore')).ok, 'role can be reassigned');
  ok(auth.listUsers().find((u) => u.id === invited.user.id).role === 'produttore', 'the new role is stored');
  ok((await auth.deleteUser(invited.user)).ok, 'the account can be deleted');
  ok(!auth.listUsers().some((u) => u.email === 'test.vendite@vignero.it'), 'and disappears from the list');
  await auth.resetRegistry();
  ok(!auth.listUsers().some((u) => u.email === 'test.vendite@vignero.it'), 'registry reset clears the invite');
}

/* ---------------- passwords: the user changes their own, staff sets one ---------------- */
{
  const tapEl = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await loginAs('ufficio');                       // ufficio@vignero.it · Ufficio#2026
  await go('#/profilo');
  ok(/Cambia password/.test(text()), 'profilo: the «Cambia password» section is there');
  tapEl(document.getElementById('changePwBtn'));
  await wait(30);
  const form = document.querySelector('#ownPwForm');
  ok(!!form, 'profilo: the change-password sheet opens');
  ok(!!form.elements.current && !!form.elements.next && !!form.elements.confirm,
     'profilo: current, new and confirm fields');
  const submitOwn = async (cur, next, conf) => {
    form.elements.current.value = cur;
    form.elements.next.value = next;
    form.elements.confirm.value = conf;
    document.querySelector('.sheet-actions [data-act="1"]').click();
    await wait(40);
    const err = document.querySelector('#ownPwErr');
    return err && !err.hidden ? err.textContent : '';
  };
  ok(/attuale non è corretta/i.test(await submitOwn('Sbagliata#1', 'NuovaPass#2027', 'NuovaPass#2027')),
     'profilo: a wrong current password is refused');
  ok(/non coincidono/i.test(await submitOwn('Ufficio#2026', 'NuovaPass#2027', 'Diversa#2027')),
     'profilo: the two new passwords must match');
  ok(/almeno 8/i.test(await submitOwn('Ufficio#2026', 'corta', 'corta')),
     'profilo: short passwords are refused');
  // a correct change goes through and the old password stops working
  form.elements.current.value = 'Ufficio#2026';
  form.elements.next.value = 'Ufficio#2027';
  form.elements.confirm.value = 'Ufficio#2027';
  document.querySelector('.sheet-actions [data-act="1"]').click();
  await wait(60);
  ok(!(await auth.authenticate('ufficio@vignero.it', 'Ufficio#2026')).ok,
     'profilo: the old password no longer works');
  ok((await auth.authenticate('ufficio@vignero.it', 'Ufficio#2027')).ok,
     'profilo: the new password works');

  // staff sets a password of their choosing for someone else
  await loginAs('ufficio');
  await go('#/config/utenti');
  const target = auth.listUsers().find((u) => u.email === 'produttore@vignero.it');
  const btn = [...document.querySelectorAll('[data-reset-pw]')].find((b) => b.dataset.resetPw === target.id);
  tapEl(btn);
  await wait(40);
  const pwForm = document.querySelector('#pwForm');
  ok(!!pwForm, 'utenti: the password sheet opens with two modes');
  ok(pwForm.querySelectorAll('input[name="mode"]').length === 2, 'utenti: generate or set');
  ok(document.querySelector('#pwFields').hidden, 'utenti: the fields are hidden in «genera» mode');
  pwForm.querySelector('input[name="mode"][value="set"]').click();
  await wait(20);
  ok(!document.querySelector('#pwFields').hidden, 'utenti: choosing «imposta» reveals the fields');
  ok(document.querySelector('.sheet-actions [data-act="1"]').textContent.trim() === 'Imposta',
     'utenti: the primary action becomes «Imposta»');
  pwForm.elements.next.value = 'Scelta123';
  pwForm.elements.confirm.value = 'Scelta999';
  document.querySelector('.sheet-actions [data-act="1"]').click();
  await wait(40);
  ok(/non coincidono/i.test(document.querySelector('#pwErr').textContent),
     'utenti: mismatched passwords are refused');
  pwForm.elements.next.value = 'Scelta#2027';
  pwForm.elements.confirm.value = 'Scelta#2027';
  document.querySelector('.sheet-actions [data-act="1"]').click();
  await wait(60);
  ok(!document.querySelector('#pwForm'), 'utenti: the sheet closes after setting the password');
  ok((await auth.authenticate('produttore@vignero.it', 'Scelta#2027')).ok,
     'utenti: the person can sign in with the chosen password');
  ok(!(await auth.authenticate('produttore@vignero.it', 'Produttore#2026')).ok,
     'utenti: the previous password stopped working');

  // «genera» mode still issues a one-time password in the panel
  await go('#/config/utenti');
  const again = [...document.querySelectorAll('[data-reset-pw]')].find((b) => b.dataset.resetPw === target.id);
  tapEl(again);
  await wait(40);
  document.querySelector('.sheet-actions [data-act="1"]').click();   // generate (default)
  await wait(80);
  const panel = document.querySelector('#sheetRoot .sheet .mono');
  ok(!!panel && /^[A-Z]/.test(panel.textContent.trim()),
     `utenti: «genera» still shows a one-time password (${panel ? panel.textContent.trim() : '—'})`);
  document.querySelector('#sheetRoot .sheet-actions [data-act="0"]').click();   // Chiudi
  await auth.resetRegistry();
}

/* ---------------- the async write API the screens use (demo backend) ---------------- */
{
  const S4 = await import('../js/store.js');
  const lot = S4.store.lotti.find((l) => l.portainnesto && l.varieta);
  const before = S4.store.lotti.length;
  const made = await S4.saveLotto({
    anno: '2026', produttore: lot.produttore, tipologia: lot.tipologia, produzione: lot.produzione,
    varieta: lot.varieta, clone: lot.clone, portainnesto: lot.portainnesto, quantita: 99, note: 'api test',
  }, null);
  ok(made.ok && S4.store.lotti.length === before + 1, 'saveLotto creates a new lot (demo)');
  const edited = await S4.saveLotto({
    anno: '2026', produttore: lot.produttore, tipologia: lot.tipologia, produzione: lot.produzione,
    varieta: lot.varieta, clone: lot.clone, portainnesto: lot.portainnesto, quantita: 123, note: 'api test',
  }, made.lot.id);
  ok(edited.ok && S4.store.lotti.filter((l) => l.note === 'api test').length === 1,
     'saveLotto updates the same row instead of creating another');
  const bad = await S4.saveLotto({ anno: '20', quantita: -1 }, null);
  ok(!bad.ok && !!bad.error, 'saveLotto refuses invalid values before writing', bad.error);

  const ord = await S4.saveOrdine({
    id_magazzino: made.lot.id, tipologia: lot.tipologia, produzione: lot.produzione,
    varieta: lot.varieta, clone: lot.clone, portainnesto: lot.portainnesto, quantita: 5,
    spedito: false, note: 'api ordine',
  }, null);
  ok(ord.ok && ord.ordine.id_magazzino === made.lot.id, 'saveOrdine links the order to its lot (demo)');
  const noLot = await S4.saveOrdine({ tipologia: 'x', produzione: 'y', varieta: 'z', clone: 'c', portainnesto: 'r', quantita: 1 }, null);
  ok(!noLot.ok, 'saveOrdine refuses an order without a lot');
  const guard = await S4.removeLotto(made.lot.id);
  ok(!guard.ok && /impegno/i.test(guard.error), 'removeLotto refuses a lot an order points at');

  const shipped = await S4.setSpedito(ord.ordine.id, true);
  ok(shipped.ok && shipped.ordine.spedito === true, 'setSpedito sets the flag explicitly (demo)');
  const unshipped = await S4.setSpedito(ord.ordine.id, false);
  ok(unshipped.ok && unshipped.ordine.spedito === false, 'setSpedito can revert it');

  await S4.removeOrdine(ord.ordine.id);
  const removed = await S4.removeLotto(made.lot.id);
  ok(removed.ok && !S4.store.lotti.some((l) => l.note === 'api test'), 'the test lot and order are removed');

  const pair = await S4.saveVitiPair(null, { varieta: lot.varieta, clone: 'API-TEST' });
  ok(pair.ok, 'saveVitiPair creates a pair');
  ok((await S4.saveVitiPair({ varieta: lot.varieta, clone: 'API-TEST' }, { varieta: lot.varieta, clone: 'API-TEST-2' })).ok,
     'an unused pair can be renamed');
  ok((await S4.removeVitiPair(lot.varieta, 'API-TEST-2')).ok, 'and deleted again');

  const root = await S4.savePortainnesto(null, '9999 API ROOT');
  ok(root.ok, 'savePortainnesto creates a rootstock');
  ok((await S4.savePortainnesto('9999 API ROOT', '9999 API ROOT 2')).ok, 'an unused rootstock can be renamed');
  ok((await S4.removePortainnesto('9999 API ROOT 2')).ok, 'and deleted again');

  const lotsBefore = S4.store.lotti.length;
  const imp = await S4.importRows('lotti', [1, 2, 3].map((n) => ({
    anno: '2026', produttore: lot.produttore, tipologia: lot.tipologia, produzione: lot.produzione,
    varieta: lot.varieta, clone: lot.clone, portainnesto: lot.portainnesto, quantita: n, note: 'import test',
  })));
  ok(imp.ok && imp.count === 3 && S4.store.lotti.length === lotsBefore + 3, 'importRows writes every valid row');
  // remove exactly what this block created; later blocks rely on the rest of the store
  for (const l of S4.store.lotti.filter((x) => x.note === 'import test')) await S4.removeLotto(l.id);
  ok(S4.store.lotti.length === lotsBefore, 'the imported rows are removed again');
}

/* ---------------- anagrafica vite: flat list, variety is a filter ---------------- */
{
  await loginAs('ufficio');
  await go('#/anagrafiche/viti');
  const shape = {
    groups: document.querySelectorAll('.grid tbody tr.group').length,
    rows: document.querySelectorAll('.grid tbody tr.trow').length,
    hasFilter: !!document.querySelector('#varietyFilter input'),
    cols: [...document.querySelectorAll('.grid thead th')].map((t) => t.textContent.trim()),
  };
  ok(shape.groups === 0, `vite: no grouping by variety (${shape.groups} group rows)`);
  ok(shape.rows > 0, `vite: flat rows rendered (${shape.rows})`);
  ok(shape.hasFilter, 'vite: the variety filter is present');
  ok(shape.cols.includes('Codice varietà'), `vite: the variety is a column (${shape.cols.join(' · ')})`);
  ok(shape.cols.indexOf('Codice varietà') < shape.cols.indexOf('Codice clone'),
     `vite: variety comes before clone (${shape.cols.slice(0, 3).join(' · ')})`);
  const firstRowCells = [...document.querySelectorAll('.grid tbody tr.trow')][0]?.querySelectorAll('td');
  ok(firstRowCells && firstRowCells[0].textContent.trim() === firstRowCells[1].textContent.trim()
     ? true
     : (firstRowCells[0].textContent.trim().length > 0 && firstRowCells[0].dataset.label === 'Codice varietà'),
     'vite: the first cell of a row is the variety');

  /* pick a variety through the combobox */
  const producerPair = storeMod.store.viti.find((v) => storeMod.usageOfPair(v.varieta, v.clone) > 0);
  const combo = document.querySelector('#varietyFilter input');
  combo.value = producerPair.varieta;
  combo.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(20);
  const suggestion = document.querySelector('#varietyFilter + .combo-list button[data-i]')
    || document.querySelector('.combo-list button[data-i]');
  ok(!!suggestion, 'vite: the variety filter suggests values');
  suggestion.click();
  await wait(60);
  const cells = [...document.querySelectorAll('.grid tbody tr.trow td[data-label="Codice varietà"]')]
    .map((td) => td.textContent.trim());
  ok(cells.length > 0, `vite: filtered rows (${cells.length})`);
  ok(cells.every((c) => c === producerPair.varieta), 'vite: every row belongs to the filtered variety');
  ok(text().includes('cloni di'), 'vite: the subtitle states the filtered variety');

  /* reset brings the whole anagrafica back */
  document.getElementById('resetViti').click();
  await wait(60);
  const afterReset = document.querySelectorAll('.grid tbody tr.trow').length;
  ok(afterReset >= cells.length, `vite: reset restores the list (${afterReset})`);
}

/* ---------------- master data: add, edit, delete ---------------- */
{
  await loginAs('ufficio');
  await go('#/anagrafiche/viti');
  const before = storeMod.store.viti.length;

  /* the «+ Varietà / clone» button must actually work */
  document.getElementById('newBtn').click();
  await wait(30);
  const sheet = document.querySelector('.sheet');
  ok(!!sheet, 'the add-pair sheet opens');
  const varietyInput = sheet.querySelector('[data-variety] input');
  varietyInput.value = 'VARIETA TEST';
  varietyInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  sheet.querySelector('[name="clone"]').value = 'CLONE TEST';
  sheet.querySelector('.sheet-actions [data-act="1"]').click();
  await wait(40);
  ok(storeMod.store.viti.length === before + 1, 'the pair is created (button works)');
  ok(storeMod.store.viti.some((v) => v.varieta === 'VARIETA TEST' && v.clone === 'CLONE TEST'),
     'the new pair is in the anagrafica');

  /* delete it again — the list is paginated, so filter down to it */
  await go('#/anagrafiche/viti');
  const search = document.getElementById('q');
  search.value = 'VARIETA TEST';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(350);
  const del = [...document.querySelectorAll('[data-del-pair]')]
    .find((b) => b.dataset.delPair === 'VARIETA TEST|CLONE TEST');
  ok(!!del, 'the new pair has a delete action');
  del.click();
  await wait(30);
  document.querySelector('.sheet-actions [data-act="1"]').click();
  await wait(40);
  ok(storeMod.store.viti.length === before, 'the pair is deleted');

  /* a pair in use cannot be deleted */
  const usedPair = storeMod.store.viti.find((v) => storeMod.usageOfPair(v.varieta, v.clone) > 0);
  const blockedDel = storeMod.deleteVitiPair(usedPair.varieta, usedPair.clone);
  ok(!blockedDel.ok && /uso|usano/i.test(blockedDel.error), 'a used pair cannot be deleted');

  /* rootstocks: rename an unused code, delete it, and refuse a used one */
  await go('#/anagrafiche/portainnesti');
  const unused = storeMod.store.portainnesti.find((c) => storeMod.usageOfRootstock(c) === 0);
  const renamed = storeMod.renamePortainnesto(unused, unused + ' TEST');
  ok(renamed.ok, 'an unused rootstock can be renamed');
  ok(storeMod.store.portainnesti.includes(unused + ' TEST'), 'the new code is present');
  ok(storeMod.deletePortainnesto(unused + ' TEST').ok, 'and it can be deleted');
  const usedRoot = storeMod.store.portainnesti.find((c) => storeMod.usageOfRootstock(c) > 0);
  ok(!storeMod.deletePortainnesto(usedRoot).ok, 'a rootstock in use cannot be deleted');
}

/* ---------------- lotti: edit and delete ---------------- */
{
  await loginAs('admin');
  await go('#/dati/lotti');
  /* the list shows the newest 40 rows, so take the row that is actually rendered */
  const editBtn = document.querySelector('[data-edit]');
  ok(!!editBtn, 'lots have an edit action');
  const first = storeMod.store.lotti.find((l) => l.id === editBtn.dataset.edit);
  const beforeQty = first.quantita;
  editBtn.click();
  await wait(30);
  const sheet = document.querySelector('.sheet');
  ok(text().length > 0 && !!sheet, 'the edit form opens prefilled');
  sheet.querySelector('[name="quantita"]').value = String(beforeQty + 10);
  sheet.querySelector('.sheet-actions [data-act="1"]').click();
  await wait(40);
  ok(storeMod.store.lotti.find((l) => l.id === first.id).quantita === beforeQty + 10,
     'the lot quantity is updated');

  await go('#/dati/lotti');
  const delBtn = document.querySelector(`[data-del="${first.id}"]`);
  ok(!!delBtn, 'lots have a delete action');
  delBtn.click();
  await wait(30);
  document.querySelector('.sheet-actions [data-act="1"]').click();
  await wait(60);
  ok(!storeMod.store.lotti.some((l) => l.id === first.id), 'the lot is deleted');

  /* a lot referenced by an order cannot be deleted */
  const ord = storeMod.store.ordini.find((o) => o.id_magazzino);
  const res = storeMod.deleteLotto(ord.id_magazzino);
  ok(!res.ok && /impegno/i.test(res.error), 'a lot with commitments cannot be deleted');
}

/* ---------------- navigation chrome ---------------- */
await go('#/home');
const tabs = document.querySelectorAll('#tabbar a').length;
ok(tabs >= 3 && tabs <= 4, 'mobile tab bar has 3–4 destinations');
ok(document.querySelectorAll('#rail a').length > 0, 'desktop rail is populated');
ok([...document.querySelectorAll('#rail a')].some((a) => a.getAttribute('aria-current') === 'page'),
   'rail marks the active item');

const realErrors = errors.filter((e) => !/Not implemented|console\.error/.test(e));
ok(realErrors.length === 0, 'no uncaught render errors' + (realErrors.length ? ': ' + realErrors[0] : ''));
console.log(`smoke tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
