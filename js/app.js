/* Vignero · app.js — shell, session, router, guards */
import * as S from './store.js';
import * as U from './ui.js';
import * as P from './permissions.js';
import * as A from './auth.js';
import * as R from './views-reports.js';
import * as D from './views-data.js';

const BANNER_KEY = 'vignero.demo.dismissed';
const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
const layoutModeNow = () => (isDesktop() ? 'desktop' : 'mobile');

const ROUTES = [
  { re: /^\/login$/, view: R.viewLogin, cap: null, title: 'Accedi', crumb: 'Accesso' },
  { re: /^\/home$/, view: R.viewHome, cap: 'home', title: 'Panoramica', crumb: 'Fede Magazzino' },
  { re: /^\/r\/disponibilita$/, view: R.viewDisponibilita, cap: 'r.disponibilita', title: 'Riepilogo disponibilità', crumb: 'Riepiloghi / Disponibilità' },
  { re: /^\/r\/produttore$/, view: R.viewPerProduttore, cap: 'r.produttore', title: 'Riepilogo per produttore', crumb: 'Riepiloghi / Per produttore' },
  { re: /^\/r\/indisponibilita$/, view: R.viewIndisponibilita, cap: 'r.indisponibilita', title: 'Mancanze', crumb: 'Riepiloghi / Mancanze' },
  { re: /^\/r\/daspedire$/, view: R.viewDaSpedire, cap: 'r.daspedire', title: 'Da spedire', crumb: 'Riepiloghi / Da spedire' },
  { re: /^\/r\/messodisposizione$/, view: R.viewMessoADisposizione, cap: 'r.messodisposizione', title: 'Messo a disposizione', crumb: 'Riepiloghi / Messo a disposizione' },
  { re: /^\/dati\/lotti$/, view: D.viewLotti, cap: 'dati.lotti', title: 'Lotti magazzino', crumb: 'Dati / Lotti magazzino', pcOnly: true },
  { re: /^\/dati\/ordini$/, view: D.viewOrdini, cap: 'dati.ordini', title: 'Ordini e impegni', crumb: 'Dati / Ordini e impegni', pcOnly: true },
  { re: /^\/dati\/import$/, view: D.viewImport, cap: 'dati.import', title: 'Import CSV', crumb: 'Dati / Import', pcOnly: true },
  { re: /^\/anagrafiche\/viti$/, view: D.viewViti, cap: 'anag.viti', title: 'Anagrafica vite', crumb: 'Anagrafiche / Viti' },
  { re: /^\/anagrafiche\/portainnesti$/, view: D.viewPortainnesti, cap: 'anag.portainnesti', title: 'Anagrafica portainnesto', crumb: 'Anagrafiche / Portainnesti' },
  { re: /^\/config\/utenti$/, view: R.viewUtenti, cap: 'config.utenti', title: 'Utenti', crumb: 'Configurazione / Utenti' },
  { re: /^\/config\/permessi$/, view: R.viewPermessi, cap: 'config.permessi', title: 'Ruoli e permessi', crumb: 'Configurazione / Permessi' },
  { re: /^\/profilo$/, view: R.viewProfilo, cap: 'profilo', title: 'Profilo', crumb: 'Profilo' },
];

let session = null;      // { userId, name, email, role, grower, exp, user }
let role = null;
let current = { path: '/home', params: new URLSearchParams() };
let lastHash = null;     // to tell a real navigation from a re-render
let layoutMode = null;   // 'mobile' | 'desktop' — only a *mode* change triggers a re-render

export const currentSession = () => session;

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/home';
  const [path, qs] = raw.split('?');
  return { path: path || '/home', params: new URLSearchParams(qs || '') };
}

export function navigate(href) {
  if (location.hash === href) render();
  else location.hash = href;
}

/* --------------------------------------------------------------- session */
export async function login(user) {
  // the backend has already established the session (demo: local storage,
  // supabase: auth.signInWithPassword); here we only mirror it for the UI
  session = {
    userId: user.id || user.userId, email: user.email, name: user.name,
    role: user.role, grower: user.grower || null,
    issuedAt: Date.now(), exp: Date.now() + 8 * 3600 * 1000, user,
  };
  role = session.role;
  paintChrome();
  U.toast(`Ciao ${session.name.split(' ')[0]} · ${P.roleLabel(role)}`);
  // load the data the new role is allowed to see (the reports depend on the role)
  try {
    await S.init(role);
    await A.refreshUsers();
  } catch (err) {
    console.error(err);
    U.toast('Dati non disponibili: ' + (err.message || err), { tone: 'error' });
  }
  // After signing in you always start from the home page, whatever URL you came
  // from (an expired session on a sub-page, a shared link, a bookmark).
  navigate('#/home');
}

export async function logout() {
  try { await A.logout(); } catch { /* offline */ }
  session = null;
  role = null;
  paintChrome();
  navigate('#/login');
  U.toast('Sessione terminata');
}

function sessionSheet() {
  if (!session) { navigate('#/login'); return; }
  U.openSheet({
    title: 'Sessione',
    body: `
      <div class="card card-pad mb">
        <p class="eyebrow">Utente collegato</p>
        <p style="font-size:16px;font-weight:700;color:var(--ink-900)">${U.esc(session.name)}</p>
        <p class="caption">${U.esc(session.email)}</p>
        <p style="margin-top:8px">
          <span class="badge badge-ok">${U.esc(P.roleLabel(session.role))}</span>
          ${session.grower ? `<span class="badge">Produttore: ${U.esc(session.grower)}</span>` : ''}
        </p>
        <p class="caption" style="margin-top:8px">Sessione valida ancora ${A.minutesLeft(session)} min.</p>
      </div>`,
    actions: [
      { label: 'Chiudi', class: 'btn-secondary', run: U.closeSheet },
      { label: 'Disconnetti', class: 'btn-danger', run: () => { U.closeSheet(); logout(); } },
    ],
  });
}

/* ---------------------------------------------------------------- chrome */
function paintChrome() {
  const chip = document.getElementById('roleChip');
  const rail = document.getElementById('rail');
  const tabbar = document.getElementById('tabbar');
  const signedIn = !!session;

  chip.textContent = signedIn ? P.roleShort(role) : 'ACCEDI';
  chip.title = signedIn ? `${session.name} · ${P.roleLabel(role)}` : 'Accedi';

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
    `<a href="${t.href}" data-nav="${t.href}">${U.icon(t.icon)}<span>${U.esc(t.label)}</span></a>`).join('');
}

function setActiveNav() {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === '#' + current.path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ---------------------------------------------------------------- router */
export function render() {
  const main = document.getElementById('main');
  const { path, params } = parseHash();
  current = { path, params };
  U.closeSheet();

  const rawHash = location.hash;
  const navigated = rawHash !== lastHash;
  lastHash = rawHash;

  const route = ROUTES.find((r) => r.re.test(path));
  if (!route) { navigate('#/home'); return; }

  document.getElementById('appTitle').textContent = route.title;
  document.getElementById('appCrumb').textContent = route.crumb;
  document.title = route.title + ' · Vignero';

  // not signed in → ask for credentials (the destination is not carried over:
  // after signing in the user always lands on Home)
  if (!session && route.cap) { navigate('#/login'); return; }
  // already signed in → the login screen is meaningless
  if (session && path === '/login') { navigate('#/home'); return; }

  const ctx = {
    role, params, path, navigate, refresh: () => render(),
    session, user: session ? session.user : null, login, logout,
  };

  main.innerHTML = '';
  if (route.cap && !P.can(role, route.cap)) { R.viewDenied(main, ctx); setActiveNav(); return; }
  if (route.pcOnly && !isDesktop()) { R.viewLockedPC(main); setActiveNav(); return; }

  setActiveNav();
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
  // A re-render of the same route (refresh after a save, a filter, a layout
  // change) must never yank the reader back to the top: only a navigation does.
  if (navigated) window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  S.store.mode = A.backend() === 'supabase' ? 'supabase' : 'demo';   // known before login
  session = await A.getSession();
  role = session ? session.role : null;
  paintChrome();

  // Without a session the live backend cannot read anything (RLS denies anon), so
  // the data layer only runs once we know who is asking. The demo always loads.
  const needData = !!session || A.backend() === 'demo';
  if (needData) {
    try {
      await S.init(role);
      if (session) { try { await A.refreshUsers(); } catch { /* not permitted → empty list */ } }
    } catch (err) {
      document.getElementById('main').innerHTML = U.emptyState({
        icon: '⚠', title: 'Dati non disponibili',
        text: 'Impossibile caricare i dati (' + (err.message || err) + ').',
        action: 'Riprova',
      });
      const btn = document.querySelector('[data-empty-action]');
      if (btn) btn.addEventListener('click', () => location.reload());
      return;
    }
  }

  const banner = document.getElementById('demoBanner');
  const demo = S.store.mode === 'demo';
  if (!demo) {
    banner.hidden = true;                 // live data: nothing to disclaim
  } else {
    try { if (localStorage.getItem(BANNER_KEY) !== '1') banner.hidden = false; } catch { /* ignore */ }
  }
  document.getElementById('demoDismiss').addEventListener('click', () => {
    banner.hidden = true;
    try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* ignore */ }
  });

  document.getElementById('roleChip').addEventListener('click', () => {
    if (!session) navigate('#/login');
    else sessionSheet();
  });

  layoutMode = layoutModeNow();
  window.addEventListener('resize', U.debounce(() => {
    const mode = layoutModeNow();
    // Mobile browsers fire `resize` every time the address bar hides or shows
    // while scrolling, and when the keyboard opens. Those are height-only
    // changes: the layout does not change, so do not re-render (that used to
    // jump the page back to the top mid-scroll).
    if (mode === layoutMode) return;
    layoutMode = mode;
    paintChrome();
    render();
  }, 180));
  window.addEventListener('hashchange', render);

  if (!location.hash) location.hash = session ? '#/home' : '#/login';
  else render();
}

boot();
