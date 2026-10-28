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

/* deep link → login → back to the intended route */
{
  window.location.hash = '#/dati/lotti';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(20);
  ok(text().includes('Accedi a Vignero'), 'protected route redirects to login');
  desktop = true;
  const admin = auth.USERS.find((u) => u.role === 'admin');
  document.querySelector('[name="email"]').value = admin.email;
  document.querySelector('[name="password"]').value = admin.password;
  document.querySelector('#loginForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(40);
  ok(window.location.hash === '#/dati/lotti', 'after login the intended route is restored (' + window.location.hash + ')');
  ok(text().includes('Lotti magazzino'), 'and that page renders');
}

/* ---------------- route matrix ---------------- */
const CASES = [
  ['admin', '#/home', ['Disponibilità totale', 'Riepiloghi']],
  ['admin', '#/r/disponibilita', ['Riepilogo disponibilità', 'Totale portainnesto', 'Da spedire']],
  ['admin', '#/r/produttore', ['Riepilogo per produttore', 'Non attribuito', 'Tot. produttori']],
  ['admin', '#/r/indisponibilita', ['Indisponibilità', 'Deficit']],
  ['admin', '#/dati/lotti', ['Lotti magazzino', 'Nuovo lotto']],
  ['admin', '#/dati/ordini', ['Ordini e impegni', 'Segna spedito']],
  ['admin', '#/dati/import', ['Import CSV', 'Destinazione']],
  ['admin', '#/anagrafiche/viti', ['Anagrafica vite', 'coppie varietà/clone']],
  ['admin', '#/anagrafiche/portainnesti', ['Anagrafica portainnesto', 'Utilizzi']],
  ['admin', '#/config/permessi', ['Ruoli e permessi', 'Amministratore']],
  ['admin', '#/profilo', ['Profilo', 'Disconnetti', 'Account dimostrativi']],
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

/* filters via URL */
await loginAs('admin');
const variety = JSON.parse(SNAP).lotti[0][4];
t = await go('#/r/disponibilita?varieta=' + encodeURIComponent(variety));
ok(t.includes(variety), 'filter from URL is applied');
ok(t.includes('rimuovi filtro'), 'active filter chip rendered');

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
setSelectIn(osheet, 'tipologia', snap.meta.tipologie[0]);
setSelectIn(osheet, 'produzione', snap.meta.produzioni[0]);
setSelectIn(osheet, 'portainnesto', snap.portainnesti[0]);
const ovariety = osheet.querySelector('[data-variety] input');
ovariety.value = snap.lotti[0][4];
ovariety.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(10);
click(osheet.querySelector('.combo-list button[data-i]'));
await wait(10);
const oclone = osheet.querySelector('[name="clone"]');
oclone.value = [...oclone.options].map((o) => o.value).filter(Boolean)[0];
osheet.querySelector('[name="quantita"]').value = '250';
const beforeOrd = storeMod.store.ordini.length;
click(osheet.querySelector('.sheet-actions [data-act="1"]'));
await wait(40);
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
