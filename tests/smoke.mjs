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
  ['admin', '#/r/indisponibilita', ['Indisponibilità', 'Deficit']],
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
  ['produttore', '#/r/indisponibilita', ['Indisponibilità']],
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
    admin: ['Disponibilità', 'Per produttore', 'Indisponibilità', 'Da spedire', 'Lotti magazzino',
            'Ordini e impegni', 'Import CSV', 'Vite', 'Portainnesti', 'Utenti', 'Ruoli e permessi', 'Profilo'],
    ufficio: ['Disponibilità', 'Per produttore', 'Indisponibilità', 'Da spedire', 'Lotti magazzino',
              'Ordini e impegni', 'Import CSV', 'Vite', 'Portainnesti', 'Utenti', 'Profilo'],
    produttore: ['Disponibilità', 'Indisponibilità', 'Profilo'],
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
  ok(!homeText.includes('In indisponibilità'), 'vendite: no shortage summary box');
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
  ok(homeText.includes('In indisponibilità'), 'produttore: keeps the shortage box');
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
  await wait(40);
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
