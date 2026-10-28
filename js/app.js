/* Vignero · app.js — shell, role, router, guards */
import * as S from './store.js';
import * as U from './ui.js';
import * as P from './permissions.js';
import * as R from './views-reports.js';
import * as D from './views-data.js';

const ROLE_KEY = 'vignero.role.v1';
const BANNER_KEY = 'vignero.demo.dismissed';
const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  table: '<path d="M3 5h18v14H3z"/><path d="M3 10h18M9 10v9"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9v5M12 17h.01"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const ROUTES = [
  { re: /^\/login$/, view: R.viewLogin, cap: null, title: 'Accedi', crumb: 'Accesso' },
  { re: /^\/home$/, view: R.viewHome, cap: 'home', title: 'Panoramica', crumb: 'Fede Magazzino' },
  { re: /^\/r\/disponibilita$/, view: R.viewDisponibilita, cap: 'r.disponibilita', title: 'Riepilogo disponibilità', crumb: 'Riepiloghi / Disponibilità' },
  { re: /^\/r\/produttore$/, view: R.viewPerProduttore, cap: 'r.produttore', title: 'Riepilogo per produttore', crumb: 'Riepiloghi / Per produttore' },
  { re: /^\/r\/indisponibilita$/, view: R.viewIndisponibilita, cap: 'r.indisponibilita', title: 'Indisponibilità', crumb: 'Riepiloghi / Indisponibilità' },
  { re: /^\/dati\/lotti$/, view: D.viewLotti, cap: 'dati.lotti', title: 'Lotti magazzino', crumb: 'Dati / Lotti magazzino', pcOnly: true },
  { re: /^\/dati\/ordini$/, view: D.viewOrdini, cap: 'dati.ordini', title: 'Ordini e impegni', crumb: 'Dati / Ordini e impegni', pcOnly: true },
  { re: /^\/dati\/import$/, view: D.viewImport, cap: 'dati.import', title: 'Import CSV', crumb: 'Dati / Import', pcOnly: true },
  { re: /^\/anagrafiche\/viti$/, view: D.viewViti, cap: 'anag.viti', title: 'Anagrafica vite', crumb: 'Anagrafiche / Vite' },
  { re: /^\/anagrafiche\/portainnesti$/, view: D.viewPortainnesti, cap: 'anag.portainnesti', title: 'Anagrafica portainnesto', crumb: 'Anagrafiche / Portainnesti' },
  { re: /^\/config\/permessi$/, view: R.viewPermessi, cap: 'config.permessi', title: 'Ruoli e permessi', crumb: 'Configurazione / Permessi' },
  { re: /^\/profilo$/, view: R.viewProfilo, cap: 'profilo', title: 'Profilo', crumb: 'Profilo' },
];

let role = null;
let current = { path: '/home', params: new URLSearchParams() };

function getRole() {
  try { return localStorage.getItem(ROLE_KEY); } catch { return null; }
}
export function setRole(r) {
  role = r;
  try { localStorage.setItem(ROLE_KEY, r); } catch { /* ignore */ }
  paintChrome();
  navigate('#/home');
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/home';
  const [path, qs] = raw.split('?');
  return { path: path || '/home', params: new URLSearchParams(qs || '') };
}

export function navigate(href) {
  if (location.hash === href) render();
  else location.hash = href;
}

/* ------------------------------------------------------------- chrome */
function paintChrome() {
  const chip = document.getElementById('roleChip');
  const rail = document.getElementById('rail');
  const tabbar = document.getElementById('tabbar');
  const signedIn = !!role;
  chip.textContent = signedIn ? P.roleShort(role) : 'ACCEDI';
  chip.title = signedIn ? 'Profilo: ' + P.roleLabel(role) + ' · cambia' : 'Scegli un profilo';

  if (!signedIn) {
    rail.innerHTML = '';
    tabbar.innerHTML = '';
    return;
  }

  rail.innerHTML = `
    <div class="rail-brand"><i>V</i><span>Vignero</span></div>
    ${P.RAIL.map((grp) => {
      const items = grp.items.filter((i) => P.can(role, i.cap));
      if (!items.length) return '';
      if (grp.pcOnly && !isDesktop()) return '';
      return `${grp.group ? `<div class="rail-group">${U.esc(grp.group)}</div>` : ''}
        ${items.map((i) => `<a href="${i.href}" data-nav="${i.href}">${U.esc(i.label)}</a>`).join('')}`;
    }).join('')}`;

  tabbar.innerHTML = P.tabsFor(role).map((t) =>
    `<a href="${t.href}" data-nav="${t.href}">${icon(t.icon)}<span>${U.esc(t.label)}</span></a>`).join('');
}

function setActiveNav(route) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const match = a.dataset.nav === '#' + current.path ||
      (route && a.dataset.nav === '#/r/disponibilita' && current.path.startsWith('/r/'));
    if (match) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* -------------------------------------------------------------- router */
export function render() {
  const main = document.getElementById('main');
  const { path, params } = parseHash();
  current = { path, params };
  U.closeSheet();

  let route = ROUTES.find((r) => r.re.test(path));
  if (!route) { navigate('#/home'); return; }

  document.getElementById('appTitle').textContent = route.title;
  document.getElementById('appCrumb').textContent = route.crumb;
  document.title = route.title + ' · Vignero';

  if (!role && route.cap) { navigate('#/login'); return; }

  const ctx = {
    role, params, navigate, refresh: () => render(),
    setRole,
  };

  main.innerHTML = '';
  if (route.cap && !P.can(role, route.cap)) { R.viewDenied(main); setActiveNav(route); return; }
  if (route.pcOnly && !isDesktop()) { R.viewLockedPC(main); setActiveNav(route); return; }

  setActiveNav(route);
  try {
    route.view(main, ctx);
  } catch (err) {
    console.error(err);
    main.innerHTML = U.emptyState({
      icon: '⚠', title: 'Qualcosa è andato storto',
      text: 'Ricarica la pagina. (' + (err && err.message ? err.message : 'errore') + ')',
      action: 'Ricarica',
    });
    const btn = main.querySelector('[data-empty-action]');
    if (btn) btn.addEventListener('click', () => location.reload());
  }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ---------------------------------------------------------------- boot */
async function boot() {
  role = getRole();
  paintChrome();
  try {
    await S.init();
  } catch (err) {
    document.getElementById('main').innerHTML = U.emptyState({
      icon: '⚠', title: 'Dati non disponibili',
      text: 'Impossibile caricare data/snapshot.json (' + (err.message || err) + ').',
      action: 'Riprova',
    });
    const btn = document.querySelector('[data-empty-action]');
    if (btn) btn.addEventListener('click', () => location.reload());
    return;
  }

  const banner = document.getElementById('demoBanner');
  try {
    if (localStorage.getItem(BANNER_KEY) !== '1') banner.hidden = false;
  } catch { /* ignore */ }
  document.getElementById('demoDismiss').addEventListener('click', () => {
    banner.hidden = true;
    try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* ignore */ }
  });

  document.getElementById('roleChip').addEventListener('click', () => {
    if (!role) { navigate('#/login'); return; }
    U.openSheet({
      title: 'Cambia profilo',
      body: `<p class="caption" style="margin-bottom:12px">Ambiente dimostrativo: il cambio profilo ricalcola subito navigazione e permessi.</p>
        <div class="tile-list">${P.ROLES.map((r) => `
          <button class="tile" type="button" data-role="${r.key}" style="text-align:left;cursor:pointer">
            <span class="badge" style="background:var(--brand-50);color:var(--brand-600)">${U.esc(r.short)}</span>
            <span><span class="t-title">${U.esc(r.label)}</span><span class="t-sub">${U.esc(r.blurb)}</span></span>
          </button>`).join('')}</div>`,
    });
    document.querySelectorAll('.sheet [data-role]').forEach((b) => {
      b.addEventListener('click', () => { U.closeSheet(); setRole(b.dataset.role); });
    });
  });

  window.addEventListener('resize', U.debounce(() => { paintChrome(); render(); }, 180));
  window.addEventListener('hashchange', render);

  if (!location.hash) location.hash = role ? '#/home' : '#/login';
  else render();
  if (!location.hash) render();
}

boot();
