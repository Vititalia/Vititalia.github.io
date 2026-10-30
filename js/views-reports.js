/* Vignero · views-reports.js — access, home, the three reports, matrix, profile */
import * as S from './store.js';
import * as U from './ui.js';
import * as P from './permissions.js';
import * as A from './auth.js';
import { filterBar, parseFilters, serializeFilters, activeChips, mandatoryDefaults } from './filters.js';

/* ---------- report view mode: cards (phone default) or table ---------- */
const VIEW_KEY = 'vignero.reportView.v1';
export function wantsTableView(ctx) {
  const v = ctx.params ? ctx.params.get('view') : null;
  if (v === 'table') { try { localStorage.setItem(VIEW_KEY, 'table'); } catch { /* ignore */ } return true; }
  if (v === 'cards') { try { localStorage.setItem(VIEW_KEY, 'cards'); } catch { /* ignore */ } return false; }
  try { return localStorage.getItem(VIEW_KEY) === 'table'; } catch { return false; }
}
export function resetViewPreference() {
  try { localStorage.removeItem(VIEW_KEY); } catch { /* ignore */ }
}
function viewToggle(ctx, table) {
  const base = ctx.params || new URLSearchParams();
  const href = (mode) => {
    const p = new URLSearchParams(base);
    p.set('view', mode);
    return '#' + ctx.path + '?' + p.toString();
  };
  return `<div class="view-toggle" role="group" aria-label="Formato della tabella">
      <a class="seg${table ? '' : ' is-on'}" href="${href('cards')}" aria-pressed="${!table}">Schede</a>
      <a class="seg${table ? ' is-on' : ''}" href="${href('table')}" aria-pressed="${table}">Tabella</a>
    </div>`;
}

/* ------------------------------------------------------------- S-01 login */
export function viewLogin(root, ctx) {
  root.innerHTML = `
    <div style="max-width:420px;margin:4vh auto 0">
      <div class="card card-pad">
        <div style="text-align:center;margin-bottom:18px">
          <div class="login-mark" aria-hidden="true">${U.esc('V')}</div>
          <h1 style="font-size:20px;line-height:26px;color:var(--ink-900)">Accedi a Vignero</h1>
          <p class="caption">Fede Magazzino · disponibilità di barbatelle e portainnesti</p>
        </div>

        <div class="banner banner-error" id="loginErr" role="alert" hidden></div>

        <form id="loginForm" novalidate>
          <label class="field"><span>Email</span>
            <input type="email" name="email" autocomplete="username" required
                   placeholder="nome@vignero.it" autocapitalize="none" spellcheck="false"></label>
          <label class="field"><span>Password</span>
            <input type="password" name="password" autocomplete="current-password" required></label>
          <button class="btn btn-primary btn-block" type="submit" id="loginBtn">Accedi</button>
          <p class="hint" style="text-align:center">Sessione di 8 ore. Le credenziali vengono
            verificate nel browser: nessun dato lascia il dispositivo.</p>
        </form>

        ${A.backend && A.backend() === 'supabase' ? '' : `
        <details class="demo-accounts">
          <summary>Account dimostrativi (uno per profilo)</summary>
          <table>
            <tbody>
              ${A.USERS.map((u) => `
                <tr>
                  <td><b>${U.esc(P.roleLabel(u.role))}</b><br>
                      <span class="mono" style="font-size:11px">${U.esc(u.email)}</span><br>
                      <span class="mono" style="font-size:11px;color:var(--ink-500)">${U.esc(u.password)}</span></td>
                  <td style="text-align:right;width:64px">
                    <button class="btn btn-secondary btn-sm" type="button" data-fill="${U.esc(u.email)}">Usa</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <p class="hint">Autenticazione dimostrativa lato client: dimostra il flusso di accesso,
            non protegge nulla. In produzione l'accesso va verificato dal server.</p>
        </details>`}
      </div>
    </div>`;

  const form = root.querySelector('#loginForm');
  const errBox = root.querySelector('#loginErr');
  const btn = root.querySelector('#loginBtn');

  const showError = (msg, field) => {
    errBox.hidden = false;
    errBox.textContent = msg;
    if (field) {
      const el = form.elements[field];
      el.setAttribute('aria-invalid', 'true');
      el.focus();
    }
  };
  const attempt = async (email, password) => {
    btn.disabled = true; btn.textContent = 'Accesso…';
    let res;
    try { res = await A.authenticate(email, password); }
    catch (e) { res = { ok: false, error: 'Accesso non disponibile: ' + (e.message || e) }; }
    btn.disabled = false; btn.textContent = 'Accedi';
    if (!res.ok) { showError(res.error, 'password'); return; }
    ctx.login(res.user);
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errBox.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    const email = form.elements.email.value;
    const password = form.elements.password.value;
    if (!email || !password) { showError('Inserisci email e password.'); return; }
    attempt(email, password);
  });

  root.querySelectorAll('[data-fill]').forEach((b) => {
    b.addEventListener('click', () => {
      const u = A.USERS.find((x) => x.email === b.dataset.fill);
      form.elements.email.value = u.email;
      form.elements.password.value = u.password;
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  });

  const first = root.querySelector('[name="email"]');
  if (first) first.focus();
}

/* -------------------------------------------------------------- S-02 home */
/** The mobile-first launcher: one big tile per page the role can open. */
function launcherGroups(s, role, isPC) {
  const groups = [
    { title: 'Riepiloghi', items: [
      { cap: 'r.disponibilita', href: '#/r/disponibilita', icon: 'chart',
        title: 'Disponibilità', sub: 'Magazzino, ordinato, spedito' },
      { cap: 'r.produttore', href: '#/r/produttore', icon: 'users',
        title: 'Per produttore', sub: 'Le colonne dei soci' },
      { cap: 'r.indisponibilita', href: '#/r/indisponibilita', icon: 'alert',
        title: 'Mancanze', sub: 'Solo i deficit', badge: s.negativeCount, badgeTone: 'danger' },
      { cap: 'r.daspedire', href: '#/r/daspedire', icon: 'truck',
        title: 'Da spedire', sub: 'Impegni da evadere', badge: s.ordiniNonSpediti },
      { cap: 'r.messodisposizione', href: '#/r/messodisposizione', icon: 'leaf',
        title: 'Messo a disposizione', sub: 'I tuoi conferimenti' },
    ] },
    { title: 'Dati', items: [
      { cap: 'dati.lotti', href: '#/dati/lotti', icon: 'edit',
        title: 'Lotti magazzino', sub: 'Registra i conferimenti', pcOnly: true },
      { cap: 'dati.ordini', href: '#/dati/ordini', icon: 'truck',
        title: 'Ordini e impegni', sub: 'Spedito con undo', pcOnly: true, badge: s.ordiniNonSpediti },
      { cap: 'dati.import', href: '#/dati/import', icon: 'upload',
        title: 'Import CSV', sub: 'Valida e poi carica', pcOnly: true },
    ] },
    { title: 'Anagrafiche', items: [
      { cap: 'anag.viti', href: '#/anagrafiche/viti', icon: 'leaf',
        title: 'Vite', sub: 'Varietà e cloni' },
      { cap: 'anag.portainnesti', href: '#/anagrafiche/portainnesti', icon: 'layers',
        title: 'Portainnesti', sub: 'Codici di innesto' },
    ] },
    { title: 'Sistema', items: [
      { cap: 'config.utenti', href: '#/config/utenti', icon: 'users',
        title: 'Utenti', sub: 'Inviti, ruoli, accessi' },
      { cap: 'config.permessi', href: '#/config/permessi', icon: 'lock',
        title: 'Ruoli e permessi', sub: 'Chi vede cosa' },
      { cap: 'profilo', href: '#/profilo', icon: 'user',
        title: 'Profilo', sub: 'Sessione e uscita' },
    ] },
  ];
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => P.can(role, i.cap)) }))
    .filter((g) => g.items.length)
    .map((g) => ({
      ...g,
      items: g.items.map((i) => (i.pcOnly && !isPC ? { ...i, sub: 'Solo da PC · si apre sul computer', locked: true } : i)),
    }));
}

export function viewHome(root, ctx) {
  const s = S.summary();
  const isPC = !!(window.matchMedia && window.matchMedia('(min-width:1024px)').matches);
  const neg = s.negativeCount;
  const groups = launcherGroups(s, ctx.role, isPC);
  const tileCount = groups.reduce((n, g) => n + g.items.length, 0);
  const showProducer = P.can(ctx.role, 'home.lots.producer');
  const showNegKpi = P.can(ctx.role, 'home.kpi.indisponibilita');
  const showShipKpi = P.can(ctx.role, 'home.kpi.daspedire');
  const canSeeNeg = P.can(ctx.role, 'r.indisponibilita');
  const canSeeShip = P.can(ctx.role, 'r.daspedire');

  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Panoramica</p>
      <h1>${ctx.user ? U.esc(ctx.user.name.split(' ')[0]) + ', ' : ''}da dove vuoi iniziare?</h1>
      <p class="sub">${U.esc(P.roleLabel(ctx.role))} · ${tileCount} sezioni disponibili ·
        ${U.fmtQty(s.lotti)} lotti${P.can(ctx.role, 'r.daspedire')
          ? ` · ${U.fmtQty(s.ordiniNonSpediti)} impegni non spediti` : ''}</p>
    </div></div>

    <div class="kpis kpis-compact">
      <button class="kpi" type="button" data-go="#/r/disponibilita">
        <span class="k-label">Disponibilità totale</span>
        <span class="k-value">${U.fmtSigned(s.disponibilita)}</span>
        <span class="k-sub">giacenza ${U.fmtQty(s.giacenza)}</span>
      </button>
      ${showNegKpi ? `
      <button class="kpi ${neg ? 'tone-danger' : 'tone-ok'}" type="button"
              data-go="${canSeeNeg ? '#/r/indisponibilita' : '#/r/disponibilita'}">
        <span class="k-label">In mancanze</span>
        <span class="k-value">${neg}</span>
        <span class="k-sub">${neg ? 'combinazioni in deficit' : 'nessun deficit'}</span>
      </button>` : ''}
      <button class="kpi hide-sm" type="button" ${P.can(ctx.role, 'dati.lotti') ? 'data-go="#/dati/lotti"' : 'data-go="#/r/disponibilita"'}>
        <span class="k-label">Lotti registrati</span>
        <span class="k-value">${U.fmtQty(s.lotti)}</span>
        <span class="k-sub">anno di conferimento</span>
      </button>
      ${showShipKpi ? `
      <button class="kpi hide-sm" type="button" data-go="${canSeeShip ? '#/r/daspedire' : '#/dati/ordini'}">
        <span class="k-label">Da spedire</span>
        <span class="k-value">${U.fmtQty(s.daSpedire)}</span>
        <span class="k-sub">${s.ordiniNonSpediti} impegni aperti</span>
      </button>` : ''}
    </div>

    <nav class="launcher" aria-label="Sezioni dell'applicazione">
      ${groups.map((g) => `
        <div class="launcher-group">
          <h2 class="eyebrow">${U.esc(g.title)}</h2>
          <div class="launcher-grid">
            ${g.items.map((i) => `
              <a class="apptile${i.locked ? ' is-locked' : ''}" href="${i.href}"
                 aria-label="${U.esc(i.title)} — ${U.esc(i.sub)}">
                <span class="ai">${U.icon(i.locked ? 'lock' : i.icon)}</span>
                <b>${U.esc(i.title)}</b>
                <span>${U.esc(i.sub)}</span>
                ${i.badge ? `<span class="badge ${i.badgeTone === 'danger' ? 'badge-danger' : ''}">${U.fmtQty(i.badge)}</span>` : ''}
              </a>`).join('')}
          </div>
        </div>`).join('')}
    </nav>

    <div class="stack mt">
      <section class="card">
        <div class="card-pad" style="border-bottom:1px solid var(--line)">
          <div class="row-between">
            <h2 class="eyebrow">Ultimi lotti registrati</h2>
            ${P.can(ctx.role, 'dati.lotti') ? '<a class="link" href="#/dati/lotti" style="font-size:12px">Apri lotti ›</a>' : ''}
          </div>
        </div>
        ${U.buildTable({
          cols: [{ label: 'Anno' }, ...(showProducer ? [{ label: 'Produttore' }] : []),
                 { label: 'Varietà / clone' }, { label: 'Quantità', align: 'r' }],
          rows: s.ultimiLotti.length ? s.ultimiLotti.map((l) => ({
            type: 'row',
            cells: [
              { html: U.esc(l.anno), label: 'Anno' },
              ...(showProducer ? [{ html: U.esc(l.produttore || '—'), label: 'Produttore' }] : []),
              { html: `${U.esc(l.clone)}<small>${U.esc(l.varieta)} · ${U.esc(l.portainnesto)}</small>`, label: 'Varietà / clone', cls: 'ident' },
              U.metric('Quantità', U.fmtQty(l.quantita)),
            ],
          })) : [{ type: 'empty', cells: [{ html: 'Nessun lotto registrato.' }] }],
        })}
        ${showProducer ? '' : '<p class="card-pad caption">Il dettaglio dei produttori non è disponibile per questo profilo.</p>'}
      </section>

      ${canSeeNeg ? `
      <section class="card">
        <div class="card-pad" style="border-bottom:1px solid var(--line)">
          <div class="row-between">
            <h2 class="eyebrow">Mancanze principali</h2>
            <a class="link" href="#/r/indisponibilita" style="font-size:12px">Vedi tutte ›</a>
          </div>
        </div>
        ${s.topNegativi.length ? `
        <ul style="list-style:none;padding:8px 12px;display:grid;gap:8px">
          ${s.topNegativi.map((r) => `
            <li style="display:flex;justify-content:space-between;gap:10px;background:var(--danger-50);border-left:3px solid var(--danger-600);border-radius:6px;padding:8px 10px">
              <span class="ident" style="color:var(--danger)">⚠ ${U.esc(r.clone)}<small>${U.esc(r.varieta)} · ${U.esc(r.portainnesto)}</small></span>
              <b class="num" style="color:var(--danger)">\u2212${U.fmtQty(r.deficit)}</b>
            </li>`).join('')}
        </ul>` : `<p class="card-pad caption">Nessuna mancanza: magazzino ≥ ordinato su tutte le combinazioni.</p>`}
      </section>` : ''}

      ${canSeeShip ? `
      <section class="card">
        <div class="card-pad" style="border-bottom:1px solid var(--line)">
          <div class="row-between">
            <h2 class="eyebrow">Da spedire</h2>
            <a class="link" href="#/r/daspedire" style="font-size:12px">Apri ›</a>
          </div>
        </div>
        <p class="card-pad caption">${s.ordiniNonSpediti} impegni ancora da spedire, ${U.fmtQty(s.daSpedire)} pezzi.</p>
      </section>` : `
      <section class="card card-pad">
        <p class="caption">Profilo ${U.esc(P.roleLabel(ctx.role))}: consultazione. L'inserimento dati è riservato ad Amministratore e Amministrazione, da PC.</p>
      </section>`}
    </div>`;

  root.querySelectorAll('[data-go]').forEach((b) => {
    b.addEventListener('click', () => ctx.navigate(b.dataset.go));
  });
}

/* ------------------------------------------- shared report page scaffolding */
function reportShell(root, { eyebrow, title, sub, actions = '' }) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">${U.esc(eyebrow)}</p>
        <h1>${U.esc(title)}</h1>
        <p class="sub">${sub}</p>
      </div>
      <div class="spacer"></div>
      <div class="row">${actions}</div>
    </div>
    <div id="filterHost"></div>
    <div id="reportHost"></div>`;
}

/* ----------------------------------------------- S-04/S-05 disponibilità */
/* Report 1 and report 5 («Messo a disposizione») share this rendering: one
 * subtotal per rootstock *at the start of its group*, then the per-clone
 * lines it summarises (PD-7). A subtotal never crosses a variety: its key is
 * tipologia + produzione + varietà + portainnesto (PD-12). */

const grpKey = (r) => S.subtotalKey(r);

function subtotalRow(t) {
  return {
    type: 'subtotal',
    cells: [
      { html: `Totale per portainnesto<small>${U.esc(t.varieta || '')}</small>`, cls: 'ident' },
      { html: `<span class="ident">${U.esc(t.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
      { html: U.fmtQty(t.mag), cls: 'r metric', label: 'Magazzino' },
      { html: U.fmtQty(t.ord), cls: 'r metric', label: 'Ordinato' },
      { html: U.fmtQty(t.sped), cls: 'r metric', label: 'Di cui spedito' },
      { html: `<span class="${t.disponibilita < 0 ? 'neg' : ''}">${U.fmtSigned(t.disponibilita)}</span>`, cls: 'r metric', label: 'Disponibilità' },
    ],
  };
}

function cloneRow(row) {
  const neg = row.disponibilita < 0;
  return {
    type: 'row',
    cls: neg ? 'trow negative' : 'trow',
    cells: [
      { html: `${neg ? '⚠ ' : ''}${U.esc(row.clone)}<small>${U.esc(row.varieta)}</small>`, cls: 'ident' },
      { html: `<span class="ident">${U.esc(row.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
      U.metric('Magazzino', U.fmtQty(row.mag)),
      U.metric('Ordinato', U.fmtQty(row.ord)),
      U.metric('Di cui spedito', U.fmtQty(row.sped)),
      U.metric('Disponibilità', U.fmtSigned(row.disponibilita), { negative: neg, cls: 'disp' }),
    ],
  };
}

function grandTotalRow(totals) {
  return {
    type: 'total',
    cells: [
      { html: 'Totale generale', cls: 'ident' },
      { html: '', label: 'Portainnesto', cls: 'cell-sub' },
      { html: U.fmtQty(totals.mag), cls: 'r metric', label: 'Magazzino' },
      { html: U.fmtQty(totals.ord), cls: 'r metric', label: 'Ordinato' },
      { html: U.fmtQty(totals.sped), cls: 'r metric', label: 'Di cui spedito' },
      { html: `<span class="${totals.disponibilita < 0 ? 'neg' : ''}">${U.fmtSigned(totals.disponibilita)}</span>`, cls: 'r metric', label: 'Disponibilità' },
    ],
  };
}

/** Subtotal first, then its per-clone lines, and one grand total at the end. */
function availabilityRows(r) {
  const out = [];
  let prev = null;
  for (const row of r.rows) {
    if (grpKey(row) !== prev) {
      out.push(subtotalRow(r.subtotals.get(grpKey(row))));
      prev = grpKey(row);
    }
    out.push(cloneRow(row));
  }
  if (r.rows.length) out.push(grandTotalRow(r.totals));
  return out;
}

function availabilityCsvRows(r) {
  const out = [];
  let prev = null;
  for (const row of r.rows) {
    if (grpKey(row) !== prev) {
      const t = r.subtotals.get(grpKey(row));
      out.push(['Totale per portainnesto', '', t.portainnesto, t.mag, t.ord, t.sped, t.disponibilita]);
      prev = grpKey(row);
    }
    out.push([row.clone, row.varieta, row.portainnesto, row.mag, row.ord, row.sped, row.disponibilita]);
  }
  out.push(['Totale generale', '', '', r.totals.mag, r.totals.ord, r.totals.sped, r.totals.disponibilita]);
  return out;
}

const AVAILABILITY_COLS = [{ label: 'Codice clone' }, { label: 'Codice portainnesto' },
  { label: 'Magazzino', align: 'r' }, { label: 'Ordinato', align: 'r' },
  { label: 'Di cui spedito', align: 'r' }, { label: 'Disponibilità', align: 'r' }];

const AVAILABILITY_CSV_HEADERS = ['Codice clone', 'Codice varietà', 'Codice portainnesto',
  'Magazzino', 'Ordinato', 'Di cui spedito', 'Disponibilità'];

export function viewDisponibilita(root, ctx) {
  const f = parseFilters(ctx.params, { mandatory: true });
  const r = S.reportDisponibilita(f);
  const table = wantsTableView(ctx);
  reportShell(root, {
    eyebrow: 'Riepiloghi / Disponibilità',
    title: 'Riepilogo disponibilità',
    sub: `${r.rowCount} combinazioni · ${r.subtotals.size} portainnesti · ${r.negativeCount} in negativo`,
    actions: `${viewToggle(ctx, table)}
      <button class="btn btn-secondary btn-sm" type="button" id="exportBtn">Esporta CSV</button>`,
  });
  filterBar(root.querySelector('#filterHost'), f,
    (next) => ctx.navigate('#/r/disponibilita' + serializeFilters(next)),
    { showPortainnesto: true, mandatory: ['tipologia', 'produzione'] });

  const host = root.querySelector('#reportHost');
  if (!r.rows.length) {
    host.innerHTML = U.emptyState({
      icon: '◇', title: 'Nessun dato con i filtri selezionati',
      text: 'Prova un\'altra varietà o portainnesto.', action: 'Rimuovi i filtri facoltativi',
    });
    host.querySelector('[data-empty-action]').addEventListener('click',
      () => ctx.navigate('#/r/disponibilita'));
  } else {
    host.innerHTML = `<div class="report${table ? ' table-mode' : ''}">${U.buildTable({
      scroll: table,
      caption: {
        wide: 'Prima il totale del portainnesto, poi i cloni che lo compongono. Rosso = disponibilità negativa.',
        narrow: 'Prima il totale del portainnesto, poi i cloni.',
      },
      cols: AVAILABILITY_COLS,
      rows: availabilityRows(r),
    })}</div>`;
  }

  root.querySelector('#exportBtn').addEventListener('click', () => {
    U.exportCSV(`disponibilita_${U.nowStamp()}.csv`, AVAILABILITY_CSV_HEADERS, availabilityCsvRows(r));
  });
}

/* --------------------------------- S-23 «Messo a disposizione» (produttore) */
const MESSO_COLS = [{ label: 'Codice clone' }, { label: 'Codice portainnesto' },
  { label: 'Messo a disposizione', align: 'r' }, { label: 'Spedito', align: 'r' },
  { label: 'A magazzino', align: 'r' }];

const MESSO_CSV_HEADERS = ['Codice clone', 'Codice portainnesto',
  'Messo a disposizione', 'Spedito', 'A magazzino'];

function messoAggregateRow(t, type) {
  return {
    type,
    cells: [
      { html: type === 'subtotal' ? `Totale per portainnesto<small>${U.esc(t.varieta || '')}</small>`
                                  : 'Totale generale', cls: 'ident' },
      { html: type === 'subtotal' ? `<span class="ident">${U.esc(t.portainnesto)}</span>` : '',
        label: 'Portainnesto', cls: 'cell-sub' },
      { html: U.fmtQty(t.mag), cls: 'r metric', label: 'Messo a disposizione' },
      { html: U.fmtQty(t.sped), cls: 'r metric', label: 'Spedito' },
      { html: `<span class="${t.disponibilita < 0 ? 'neg' : ''}">${U.fmtSigned(t.disponibilita)}</span>`,
        cls: 'r metric', label: 'A magazzino' },
    ],
  };
}

function messoRows(r) {
  const out = [];
  let prev = null;
  for (const row of r.rows) {
    if (grpKey(row) !== prev) {
      out.push(messoAggregateRow(r.subtotals.get(grpKey(row)), 'subtotal'));
      prev = grpKey(row);
    }
    const neg = row.disponibilita < 0;
    out.push({
      type: 'row',
      cls: neg ? 'trow negative' : 'trow',
      cells: [
        { html: `${neg ? '⚠ ' : ''}${U.esc(row.clone)}<small>${U.esc(row.varieta)}</small>`, cls: 'ident' },
        { html: `<span class="ident">${U.esc(row.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
        U.metric('Messo a disposizione', U.fmtQty(row.mag)),
        U.metric('Spedito', U.fmtQty(row.sped)),
        U.metric('A magazzino', U.fmtSigned(row.disponibilita), { negative: neg, cls: 'disp' }),
      ],
    });
  }
  if (r.rows.length) out.push(messoAggregateRow(r.totals, 'total'));
  return out;
}

/** Same structure as Report 1, with the producer's own three quantities. */
export function viewMessoADisposizione(root, ctx) {
  const f = parseFilters(ctx.params, { mandatory: true });
  const grower = (ctx.session && ctx.session.grower) || null;
  delete f.produttore;            // the producer is the session, never a filter
  const r = S.reportMessoADisposizione(f, grower);
  const table = wantsTableView(ctx);
  reportShell(root, {
    eyebrow: 'Riepiloghi / Messo a disposizione',
    title: 'Messo a disposizione',
    sub: grower
      ? `${U.esc(grower)} · ${r.rowCount} combinazioni · ${r.subtotals.size} portainnesti · ${r.negativeCount} in negativo`
      : 'Nessun produttore collegato a questo profilo',
    actions: `${viewToggle(ctx, table)}
      <button class="btn btn-secondary btn-sm" type="button" id="exportBtn"${r.rows.length ? '' : ' disabled'}>Esporta CSV</button>`,
  });
  filterBar(root.querySelector('#filterHost'), f,
    (next) => ctx.navigate('#/r/messodisposizione' + serializeFilters(next)),
    { showPortainnesto: true, mandatory: ['tipologia', 'produzione'] });


  const host = root.querySelector('#reportHost');
  if (!grower) {
    host.innerHTML = U.emptyState({
      icon: '🔒', title: 'Profilo senza produttore collegato',
      text: 'Questo riepilogo mostra i conferimenti del produttore collegato al profilo. Chiedi a un amministratore di impostarlo in Utenti.',
      action: 'Torna alla panoramica',
    });
    host.querySelector('[data-empty-action]').addEventListener('click', () => ctx.navigate('#/home'));
    return;
  }
  if (!r.rows.length) {
    host.innerHTML = U.emptyState({
      icon: '◇', title: 'Nessun conferimento con i filtri selezionati',
      text: `Non risultano lotti di ${grower} per questa tipologia e produzione.`,
      action: 'Rimuovi i filtri facoltativi',
    });
    host.querySelector('[data-empty-action]').addEventListener('click',
      () => ctx.navigate('#/r/messodisposizione'));
  } else {
    host.innerHTML = `
      <div class="banner banner-info"><span aria-hidden="true">i</span>
        <span>Solo i lotti conferiti da <b>${U.esc(grower)}</b>: «Messo a disposizione» è la quantità entrata a
        magazzino, «Spedito» quella uscita con gli impegni collegati a quei lotti, «A magazzino» la differenza.</span></div>
      <div class="report${table ? ' table-mode' : ''}">${U.buildTable({
        scroll: table,
        caption: {
          wide: 'Prima il totale del portainnesto, poi i cloni conferiti da te. «A magazzino» = messo a disposizione − spedito: rosso quando è negativo.',
          narrow: 'Prima il totale del portainnesto, poi i tuoi cloni.',
        },
        cols: MESSO_COLS,
        rows: messoRows(r),
      })}</div>`;
  }

  root.querySelector('#exportBtn').addEventListener('click', () => {
    const out = [];
    let prev = null;
    for (const row of r.rows) {
      if (grpKey(row) !== prev) {
        const t = r.subtotals.get(grpKey(row));
        out.push(['Totale per portainnesto', t.portainnesto, t.mag, t.sped, t.disponibilita]);
        prev = grpKey(row);
      }
      out.push([row.clone, row.portainnesto, row.mag, row.sped, row.disponibilita]);
    }
    out.push(['Totale generale', '', r.totals.mag, r.totals.sped, r.totals.disponibilita]);
    U.exportCSV(`messo_a_disposizione_${U.nowStamp()}.csv`, MESSO_CSV_HEADERS, out);
  });
}

/* ------------------------------------------- S-06/S-07 per produttore */
function perProduttoreCells(row, growers, hl) {
  return [
    { html: `${row.disponibilita < 0 ? '⚠ ' : ''}${U.esc(row.clone)}<small>${U.esc(row.varieta)}</small>`, cls: 'ident' },
    { html: `<span class="ident">${U.esc(row.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
    U.metric('Magazzino', U.fmtQty(row.mag)),
    U.metric('Ordinato', U.fmtQty(row.ord)),
    U.metric('Di cui spedito', U.fmtQty(row.sped)),
    U.metric('Disponibilità', U.fmtSigned(row.disponibilita), { negative: row.disponibilita < 0, cls: 'disp' }),
    ...growers.map((g) => U.metric(g, U.fmtSigned(row.per[g]), { negative: row.per[g] < 0, cls: 'grower' })),
  ].map((c, i) => {
    const g = growers[i - 6];
    return g && hl(g) ? { ...c, cls: ((c.cls || '') + ' grower-hl').trim() } : c;
  });
}

function perProduttoreSubtotalRow(t, growers, hl) {
  return {
    type: 'subtotal',
    cells: [
      { html: `Totale per portainnesto<small>${U.esc(t.varieta || '')}</small>`, cls: 'ident' },
      { html: `<span class="ident">${U.esc(t.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
      { html: U.fmtQty(t.mag), cls: 'r metric', label: 'Magazzino' },
      { html: U.fmtQty(t.ord), cls: 'r metric', label: 'Ordinato' },
      { html: U.fmtQty(t.sped), cls: 'r metric', label: 'Di cui spedito' },
      { html: `<span class="${t.disponibilita < 0 ? 'neg' : ''}">${U.fmtSigned(t.disponibilita)}</span>`, cls: 'r metric', label: 'Disponibilità' },
      ...growers.map((g) => ({
        html: U.fmtSigned(t.per[g]),
        cls: `r metric grower${t.per[g] < 0 ? ' neg' : ''}${hl(g)}`,
        label: g,
      })),
    ],
  };
}

export function viewPerProduttore(root, ctx) {
  const f = parseFilters(ctx.params, { mandatory: true });
  const r = S.reportPerProduttore(f);
  const table = wantsTableView(ctx);
  const unattributed = r.rows.filter((row) => row.nonAttr !== 0).length;
  const hl = (g) => (f.produttore && g === f.produttore ? ' grower-hl' : '');

  reportShell(root, {
    eyebrow: 'Riepiloghi / Per produttore',
    title: 'Riepilogo per produttore',
    sub: `${r.rowCount} combinazioni · ${r.growers.length} produttori · ${r.negativeCount} con valori negativi`,
    actions: `${viewToggle(ctx, table)}
      <button class="btn btn-secondary btn-sm" type="button" id="exportBtn">Esporta CSV</button>`,
  });
  filterBar(root.querySelector('#filterHost'), f,
    (next) => ctx.navigate('#/r/produttore' + serializeFilters(next)),
    { showPortainnesto: true, showProduttore: true, mandatory: ['tipologia', 'produzione'] });

  const cols = [
    { label: 'Codice clone' }, { label: 'Codice portainnesto' },
    { label: 'Magazzino', align: 'r' }, { label: 'Ordinato', align: 'r' },
    { label: 'Di cui spedito', align: 'r' }, { label: 'Disponibilità', align: 'r' },
    ...r.growers.map((g) => ({ label: g, align: 'r', cls: hl(g).trim() })),
  ];

  // subtotal at the start of each rootstock group, then its per-clone lines
  const rows = [];
  let prev = null;
  for (const row of r.rows) {
    if (grpKey(row) !== prev) {
      rows.push(perProduttoreSubtotalRow(r.subtotals.get(grpKey(row)), r.growers, hl));
      prev = grpKey(row);
    }
    rows.push({
      type: 'row',
      cls: row.disponibilita < 0 ? 'trow negative' : 'trow',
      cells: perProduttoreCells(row, r.growers, hl),
    });
  }
  if (r.rows.length) {
    rows.push({
      type: 'total',
      cells: [
        { html: 'Totale generale', cls: 'ident' },
        { html: '', label: 'Portainnesto', cls: 'cell-sub' },
        { html: U.fmtQty(r.totals.mag), cls: 'r metric', label: 'Magazzino' },
        { html: U.fmtQty(r.totals.ord), cls: 'r metric', label: 'Ordinato' },
        { html: U.fmtQty(r.totals.sped), cls: 'r metric', label: 'Di cui spedito' },
        { html: U.fmtSigned(r.totals.disponibilita), cls: 'r metric', label: 'Disponibilità' },
        ...r.growers.map((g) => ({ html: U.fmtSigned(r.totals.per[g]), cls: `r metric${hl(g)}`, label: g })),
      ],
    });
  }

  const host = root.querySelector('#reportHost');
  if (!r.rows.length) {
    host.innerHTML = U.emptyState({
      icon: '◇', title: 'Nessun dato con i filtri selezionati',
      text: f.produttore
        ? `Nessuna combinazione con quantità di ${f.produttore} e questi filtri.`
        : 'Prova un\'altra varietà o portainnesto.',
      action: 'Rimuovi i filtri facoltativi',
    });
    host.querySelector('[data-empty-action]').addEventListener('click', () => ctx.navigate('#/r/produttore'));
    return;
  }

  host.innerHTML = `
    ${unattributed ? `<div class="banner banner-warn"><span aria-hidden="true">⚠</span>
      <span>${unattributed} combinazioni hanno impegni <b>non collegati a un lotto</b>: non sono
      attribuibili a un produttore e non compaiono nelle colonne. Collega gli impegni al lotto in
      <a class="link" href="#/dati/ordini">Ordini e impegni</a>.</span></div>` : ''}
    <div class="report${table ? ' table-mode' : ''}">${U.buildTable({
      scroll: true,
      tableClass: 'matrix',
      caption: {
        wide: 'Prima il totale del portainnesto (colonne dei produttori comprese), poi un rigo per combinazione. Le prime due colonne restano visibili allo scorrimento orizzontale; la colonna del produttore filtrato è evidenziata.',
        narrow: 'Prima il totale del portainnesto, poi le combinazioni. La colonna del produttore filtrato è evidenziata.',
      },
      cols, rows,
    })}</div>`;

  root.querySelector('#exportBtn').addEventListener('click', () => {
    const out = [];
    let prevRoot = null;
    for (const row of r.rows) {
      if (grpKey(row) !== prevRoot) {
        const t = r.subtotals.get(grpKey(row));
        out.push(['Totale per portainnesto', '', t.portainnesto, t.mag, t.ord, t.sped,
          t.disponibilita, ...r.growers.map((g) => t.per[g])]);
        prevRoot = grpKey(row);
      }
      out.push([row.clone, row.varieta, row.portainnesto, row.mag, row.ord, row.sped,
        row.disponibilita, ...r.growers.map((g) => row.per[g])]);
    }
    out.push(['Totale generale', '', '', r.totals.mag, r.totals.ord, r.totals.sped,
      r.totals.disponibilita, ...r.growers.map((g) => r.totals.per[g])]);
    U.exportCSV(`disponibilita_per_produttore_${U.nowStamp()}.csv`,
      ['Codice clone', 'Codice varietà', 'Codice portainnesto', 'Magazzino', 'Ordinato',
       'Di cui spedito', 'Disponibilità', ...r.growers], out);
  });
}

/* --------------------------------------------- S-08/S-09 indisponibilità */
export function viewIndisponibilita(root, ctx) {
  const f = parseFilters(ctx.params);
  const r = S.reportIndisponibilita(f);
  const table = wantsTableView(ctx);
  reportShell(root, {
    eyebrow: 'Riepiloghi / Mancanze',
    title: 'Mancanze',
    sub: r.count
      ? `${r.count} articoli in deficit · deficit totale ${U.fmtQty(r.deficitTot)} · ordinato per portainnesto → clone`
      : 'Ordinato per portainnesto → clone',
    actions: `${viewToggle(ctx, table)}
      <button class="btn btn-secondary btn-sm" type="button" id="exportBtn"${r.count ? '' : ' disabled'}>Esporta CSV</button>`,
  });
  filterBar(root.querySelector('#filterHost'), f,
    (next) => ctx.navigate('#/r/indisponibilita' + serializeFilters(next)));

  const host = root.querySelector('#reportHost');
  if (!r.count) {
    host.innerHTML = U.emptyState({
      icon: '✓', title: 'Nessuna mancanza con i filtri attuali',
      text: activeChips(f).length ? 'Prova a rimuovere i filtri.' : 'Magazzino ≥ ordinato su tutte le combinazioni.',
      action: activeChips(f).length ? 'Rimuovi filtri' : 'Vedi disponibilità',
    });
    host.querySelector('[data-empty-action]').addEventListener('click', () => ctx.navigate(
      activeChips(f).length ? '#/r/indisponibilita' : '#/r/disponibilita'));
    return;
  }

  const subRow = (t) => ({
    type: 'subtotal',
    cells: [
      { html: `Totale per portainnesto<small>${U.esc(t.varieta || '')}</small>`, cls: 'ident' },
      { html: '', label: 'Tipologia', cls: 'ctx' },
      { html: '', label: 'Produzione', cls: 'ctx' },
      { html: `<span class="ident">${U.esc(t.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
      { html: U.fmtQty(t.mag), cls: 'r metric', label: 'Magazzino' },
      { html: U.fmtQty(t.ord), cls: 'r metric', label: 'Ordinato' },
      { html: `<span class="neg">\u2212${U.fmtQty(t.deficit)}</span>`, cls: 'r metric', label: 'Deficit' },
    ],
  });

  const rows = [];
  let prev = null;
  for (const row of r.rows) {
    if (grpKey(row) !== prev) {
      rows.push(subRow(r.subtotals.get(grpKey(row))));
      prev = grpKey(row);
    }
    rows.push({
      type: 'row', cls: 'trow negative',
      cells: [
        { html: `⚠ ${U.esc(row.clone)}<small>${U.esc(row.varieta)}</small>`, cls: 'ident' },
        { html: U.esc(row.tipologia), label: 'Tipologia', cls: 'ctx' },
        { html: U.esc(row.produzione), label: 'Produzione', cls: 'ctx' },
        { html: `<span class="ident">${U.esc(row.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
        U.metric('Magazzino', U.fmtQty(row.mag)),
        U.metric('Ordinato', U.fmtQty(row.ord)),
        U.metric('Deficit', '\u2212' + U.fmtQty(row.deficit), { negative: true, cls: 'disp' }),
      ],
    });
  }

  host.innerHTML = `
    <div class="banner banner-error"><span aria-hidden="true">⚠</span>
      <span><b>${r.count} articoli</b> con disponibilità negativa · deficit totale <b>${U.fmtQty(r.deficitTot)}</b></span></div>
    <div class="report${table ? ' table-mode' : ''}">${U.buildTable({
      scroll: table,
      caption: {
        wide: 'Prima il totale del portainnesto, poi i cloni in deficit. Il deficit è |magazzino − ordinato| mostrato con il segno meno.',
        narrow: 'Prima il totale del portainnesto, poi i cloni in deficit.',
      },
      cols: [{ label: 'Codice clone' }, { label: 'Tipologia' }, { label: 'Produzione' },
             { label: 'Portainnesto' }, { label: 'Magazzino', align: 'r' },
             { label: 'Ordinato', align: 'r' }, { label: 'Deficit', align: 'r' }],
      rows,
    })}</div>`;

  root.querySelector('#exportBtn').addEventListener('click', () => {
    const out = [];
    let prevRoot = null;
    for (const x of r.rows) {
      if (grpKey(x) !== prevRoot) {
        const t = r.subtotals.get(grpKey(x));
        out.push(['Totale per portainnesto', '', '', '', t.portainnesto, t.mag, t.ord, -t.deficit]);
        prevRoot = grpKey(x);
      }
      out.push([x.clone, x.tipologia, x.produzione, x.varieta, x.portainnesto, x.mag, x.ord, -x.deficit]);
    }
    U.exportCSV(`mancanze_${U.nowStamp()}.csv`,
      ['Codice clone', 'Tipologia', 'Produzione', 'Codice varietà', 'Codice portainnesto',
       'Magazzino', 'Ordinato', 'Deficit'], out);
  });
}

/* ------------------------------------------------ S-21 da spedire */
export function viewDaSpedire(root, ctx) {
  const f = parseFilters(ctx.params, { mandatory: true });
  const r = S.reportDaSpedire(f);
  const table = wantsTableView(ctx);
  reportShell(root, {
    eyebrow: 'Riepiloghi / Da spedire',
    title: 'Da spedire',
    sub: `${r.rowCount} impegni da evadere · ${U.fmtQty(r.totals.quantita)} pezzi`,
    actions: `${viewToggle(ctx, table)}
      <button class="btn btn-secondary btn-sm" type="button" id="exportBtn"${r.rowCount ? '' : ' disabled'}>Esporta CSV</button>`,
  });
  filterBar(root.querySelector('#filterHost'), f,
    (next) => ctx.navigate('#/r/daspedire' + serializeFilters(next)),
    { showPortainnesto: true, mandatory: ['tipologia', 'produzione'] });

  const host = root.querySelector('#reportHost');
  if (!r.rowCount) {
    host.innerHTML = U.emptyState({
      icon: '✓', title: 'Nessun impegno da spedire',
      text: 'Tutti gli impegni con questi filtri risultano già spediti.',
      action: 'Apri ordini e impegni',
    });
    host.querySelector('[data-empty-action]').addEventListener('click', () => ctx.navigate('#/dati/ordini'));
    return;
  }

  const rows = r.rows.map((o) => ({
    type: 'row',
    cells: [
      { html: `${U.esc(o.clone)}<small>${U.esc(o.varieta)}</small>`, cls: 'ident' },
      { html: `<span class="ident">${U.esc(o.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
      { html: o.lotLabel ? U.esc(o.lotLabel) : '<span style="color:var(--ink-300)">—</span>', label: 'Lotto collegato' },
      U.metric('Quantità', U.fmtQty(o.quantita), { cls: 'disp' }),
    ],
  }));
  rows.push({
    type: 'total',
    cells: [
      { html: 'Totale generale', cls: 'ident' },
      { html: '', label: 'Portainnesto', cls: 'cell-sub' },
      { html: `${r.rowCount} impegni`, label: 'Lotto collegato' },
      { html: U.fmtQty(r.totals.quantita), cls: 'r metric', label: 'Quantità' },
    ],
  });

  host.innerHTML = `
    <div class="banner banner-warn"><span aria-hidden="true">🚚</span>
      <span><b>${r.rowCount} impegni</b> non ancora spediti, per <b>${U.fmtQty(r.totals.quantita)}</b> pezzi.</span></div>
    <div class="report${table ? ' table-mode' : ''}">${U.buildTable({
      scroll: table,
      caption: {
        wide: 'Solo gli impegni con «Spedito» disattivato, ordinati per portainnesto e clone.',
        narrow: 'Solo gli impegni da spedire.',
      },
      cols: [{ label: 'Codice clone' }, { label: 'Codice portainnesto' },
             { label: 'Lotto collegato' }, { label: 'Quantità', align: 'r' }],
      rows,
    })}</div>`;

  root.querySelector('#exportBtn').addEventListener('click', () => {
    U.exportCSV(`da_spedire_${U.nowStamp()}.csv`,
      ['Tipologia', 'Produzione', 'Codice varietà', 'Codice clone', 'Codice portainnesto', 'Lotto collegato', 'Quantità'],
      r.rows.map((o) => [o.tipologia, o.produzione, o.varieta, o.clone, o.portainnesto,
                         o.lotLabel || '', o.quantita]));
  });
}

/* ------------------------------------------------ S-19 permessi (matrix) */
export function viewPermessi(root, ctx) {
  const rows = P.MATRIX.map((m) => ({
    type: 'row',
    cells: [
      { html: U.esc(m.cap), cls: 'ident' },
      ...P.ROLES.map((r) => ({ html: m.v[r.key] === '—' ? '<span style="color:var(--ink-300)">—</span>' : `<b>${m.v[r.key]}</b>`, label: r.label, cls: 'metric' })),
    ],
  }));
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Configurazione</p>
      <h1>Ruoli e permessi</h1>
      <p class="sub">E = inserimento · R = lettura · — = non disponibile. Questa matrice guida la navigazione e i controlli di rotta.</p>
    </div></div>
    <div class="report">${U.buildTable({
      cols: [{ label: 'Capacità' }, ...P.ROLES.map((r) => ({ label: r.label }))],
      rows,
    })}</div>
    <div class="stack mt">
      ${P.ROLES.map((r) => `<article class="card card-pad">
          <h2 style="font-size:15px;color:var(--ink-900)">${U.esc(r.label)}</h2>
          <p class="caption">${U.esc(r.blurb)}</p></article>`).join('')}
    </div>`;
}

/* --------------------------------------------------------------- profilo */
export function viewProfilo(root, ctx) {
  const s = ctx.session || {};
  const seeAccounts = P.can(ctx.role, 'profilo.accounts');
  // demo only: edits live in localStorage, so they can be thrown away
  const hasLocalEdits = A.backend() === 'demo' && S.hasLocalEdits();
  const seeDocs = P.can(ctx.role, 'profilo.docs');
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Profilo</p>
      <h1>${U.esc(s.name || '—')}</h1>
      <p class="sub">${U.esc(P.roleLabel(s.role))}${s.grower ? ' · produttore ' + U.esc(s.grower) : ''} · ${U.esc(s.email || '')}</p>
    </div></div>
    <div class="stack">
      <section class="card card-pad">
        <h2 class="eyebrow" style="margin-bottom:8px">Sessione</h2>
        <p class="caption">${U.esc(P.ROLES.find((r) => r.key === s.role)?.blurb || '')}</p>
        <p class="caption mt">Valida ancora ${A.minutesLeft(s)} minuti.</p>
        <div class="row mt">
          <button class="btn btn-danger btn-sm" type="button" id="logoutBtn">Disconnetti</button>
          ${P.can(ctx.role, 'config.utenti') ? '<a class="btn btn-secondary btn-sm" href="#/config/utenti">Gestione utenti</a>' : ''}
        </div>
        ${(seeDocs || hasLocalEdits) ? `
        <div class="row mt">
          ${hasLocalEdits ? '<button class="btn btn-ghost btn-sm" type="button" id="resetBtn">Azzera le modifiche locali</button>' : ''}
          ${seeDocs ? `
            <a class="btn btn-ghost btn-sm" href="docs/01-gui-specification.md">Specifica</a>
            <a class="btn btn-ghost btn-sm" href="docs/mockups/fede-magazzino-mockup.drawio">Mockup</a>` : ''}
        </div>` : ''}
      </section>

      <section class="card card-pad">
        <h2 class="eyebrow" style="margin-bottom:8px">Password</h2>
        <p class="caption">Cambia la password del tuo accesso: per sicurezza serve quella attuale.
          Minimo 8 caratteri, massimo 72.</p>
        <div class="row mt">
          <button class="btn btn-secondary btn-sm" type="button" id="changePwBtn">Cambia password</button>
        </div>
      </section>

      ${seeAccounts ? `
      <section class="card card-pad">
        <h2 class="eyebrow" style="margin-bottom:8px">Account registrati</h2>
        <p class="caption">Elenco degli utenti del dimostrativo. La gestione è in
          <a class="link" href="#/config/utenti">Utenti</a>.</p>
        <div class="report mt">${U.buildTable({
          cols: [{ label: 'Profilo' }, { label: 'Utente' }, { label: 'Email' }, { label: 'Password' }],
          rows: A.listUsers().map((u) => ({
            type: 'row',
            cells: [
              { html: U.esc(P.roleLabel(u.role)), label: 'Profilo' },
              { html: U.esc(u.name), label: 'Utente' },
              { html: `<span class="ident">${U.esc(u.email)}</span>`, label: 'Email' },
              { html: `<span class="ident">${U.esc(u.password)}</span>`, label: 'Password' },
            ],
          })),
        })}</div>
      </section>` : ''}
    </div>`;
  root.querySelector('#logoutBtn').addEventListener('click', () => ctx.logout());
  root.querySelector('#changePwBtn').addEventListener('click', () => openPasswordSheet(ctx));
  const resetBtn = root.querySelector('#resetBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    U.confirmSheet({
      title: 'Azzerare le modifiche locali?',
      message: 'Lotti, impegni e anagrafiche inseriti in questa sessione vengono rimossi dal browser.',
      confirmLabel: 'Azzera', danger: true,
      onConfirm: () => { S.resetLocalEdits(); location.reload(); },
    });
  });
}

/**
 * «Cambia password» for the signed-in user: the current password is verified by
 * the backend (`changeOwnPassword`), never trusted from the session alone.
 */
function openPasswordSheet(ctx) {
  const email = (ctx.session && ctx.session.email) || '';
  let submitFn = null;
  U.openSheet({
    title: 'Cambia password',
    body: `<form id="ownPwForm" novalidate>
        <p class="caption">Accesso: <b>${U.esc(email)}</b></p>
        <label class="field"><span>Password attuale</span>
          <input type="password" name="current" autocomplete="current-password" required></label>
        <label class="field"><span>Nuova password</span>
          <input type="password" name="next" autocomplete="new-password" required minlength="8"></label>
        <label class="field"><span>Ripeti la nuova password</span>
          <input type="password" name="confirm" autocomplete="new-password" required minlength="8"></label>
        <p class="hint">Almeno 8 caratteri. Se non ricordi quella attuale, chiedi
          all'amministratore di reimpostarla.</p>
        <p class="field-error" id="ownPwErr" hidden></p>
      </form>`,
    actions: [
      { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
      { label: 'Salva password', class: 'btn-primary', run: () => { if (submitFn) submitFn(); } },
    ],
    onMount: (sheet) => {
      const form = sheet.querySelector('#ownPwForm');
      async function submit() {
        const err = sheet.querySelector('#ownPwErr');
        const current = form.elements.current.value;
        const next = form.elements.next.value;
        const problems = A.passwordIssues(next, { confirm: form.elements.confirm.value, email });
        if (problems.length) { err.hidden = false; err.textContent = problems.join(' '); return; }
        const btn = sheet.querySelector('.sheet-actions [data-act="1"]');
        btn.disabled = true; btn.textContent = 'Salvataggio…';
        const res = await A.changeOwnPassword({ email, currentPassword: current, newPassword: next });
        btn.disabled = false; btn.textContent = 'Salva password';
        if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
        U.closeSheet();
        U.toast('Password aggiornata');
      }
      submitFn = submit;
      form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    },
  });
}

/* ------------------------------------------- S-22 utenti (admin + ufficio) */
export function viewUtenti(root, ctx) {
  const users = A.listUsers();
  const canEdit = P.can(ctx.role, 'config.utenti');
  const live = A.backend() === 'supabase';
  const statusBadge = (st) => st === 'attivo' ? '<span class="badge badge-ok">attivo</span>'
    : st === 'invitato' ? '<span class="badge badge-warn">invitato</span>'
    : '<span class="badge badge-danger">sospeso</span>';

  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Configurazione / Utenti</p>
      <h1>Utenti</h1>
      <p class="sub">${users.length} account · inviti, ruoli, sospensioni e reset password</p>
    </div>
    <div class="spacer"></div>
    ${canEdit ? '<button class="btn btn-primary" type="button" id="inviteBtn">+ Nuovo utente</button>' : ''}</div>

    <div class="banner ${live ? 'banner-warn' : 'banner-info'}"><span aria-hidden="true">i</span>
      <span>${live
        ? 'Dati reali: l\'account viene creato nel database con una password temporanea da consegnare all\'interessato (oppure invia l\'email di impostazione password). I permessi sono applicati dal database.'
        : 'La gestione utenti è dimostrativa: gli account vivono nel browser. In produzione l\'invito parte dal server con password monouso e link a scadenza.'}</span></div>

    <div class="report">${U.buildTable({
      cols: [{ label: 'Nome' }, { label: 'Email' }, { label: 'Ruolo' }, { label: 'Produttore' },
             { label: 'Stato' }, { label: 'Azioni' }],
      rows: users.map((u) => ({
        type: 'row',
        cells: [
          { html: U.esc(u.name), cls: 'ident' },
          { html: `<span class="ident">${U.esc(u.email)}</span>`, label: 'Email' },
          { html: U.esc(P.roleLabel(u.role)), label: 'Ruolo' },
          { html: u.grower ? U.esc(u.grower) : '<span style="color:var(--ink-300)">—</span>', label: 'Produttore' },
          { html: statusBadge(u.status), label: 'Stato' },
          { html: `<div class="row" style="gap:6px">
              <button class="btn btn-secondary btn-sm" type="button" data-role-for="${U.esc(u.id)}">Ruolo</button>
              <button class="btn btn-secondary btn-sm" type="button" data-reset-pw="${U.esc(u.id)}">Password</button>
              ${u.status === 'sospeso'
                ? `<button class="btn btn-secondary btn-sm" type="button" data-unblock="${U.esc(u.id)}">Riattiva</button>`
                : `<button class="btn btn-danger btn-sm" type="button" data-block="${U.esc(u.id)}">Sospendi</button>`}
              ${u.id !== (ctx.session && ctx.session.userId)
                ? `<button class="btn btn-ghost btn-sm btn-del" type="button" data-del-user="${U.esc(u.id)}">Elimina</button>` : ''}
            </div>`, label: 'Azioni' },
        ],
      })),
    })}</div>

    <div class="row mt">
      <button class="btn btn-ghost btn-sm" type="button" id="resetRegistry">Ripristina gli utenti dimostrativi</button>
    </div>`;

  let submitFn = null;
  const inviteBtn = root.querySelector('#inviteBtn');
  if (inviteBtn) inviteBtn.addEventListener('click', async () => {
    // one cached probe: is the send-credentials Edge Function deployed?
    const canEmail = await A.ensureCredentialsEmail();
    U.openSheet({
      title: 'Invita utente',
      body: `<form id="inviteForm" novalidate>
          <label class="field"><span>Nome e cognome</span><input type="text" name="name" required autocomplete="off"></label>
          <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="off"></label>
          <label class="field"><span>Ruolo</span><select name="role">
            ${P.ROLES.map((r) => `<option value="${r.key}">${U.esc(r.label)}</option>`).join('')}
          </select></label>
          <label class="field" id="growerField"><span>Produttore collegato</span><select name="grower">
            <option value="">—</option>
            ${S.store.meta.produttori.map((g) => `<option value="${U.esc(g)}">${U.esc(g)}</option>`).join('')}
          </select></label>
          ${canEmail ? `<label class="field check-field">
            <input type="checkbox" name="viaEmail" value="1" checked>
            <span>Invia la password all'indirizzo indicato</span></label>
            <p class="hint">La password temporanea parte subito per email; resterà visibile una sola volta
            in questa schermata, come promemoria.</p>` : ''}
          <p class="field-error" id="inviteErr" hidden></p>
        </form>`,
      actions: [
        { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
        { label: 'Crea utente', class: 'btn-primary', run: () => { if (submitFn) submitFn(); } },
      ],
      onMount: (sheet) => {
        const form = sheet.querySelector('#inviteForm');
        const growerField = sheet.querySelector('#growerField');
        const syncGrower = () => { growerField.hidden = form.elements.role.value !== 'produttore'; };
        form.elements.role.addEventListener('change', syncGrower);
        syncGrower();
        async function submit() {
          const btn = sheet.querySelector('.sheet-actions [data-act="1"]');
          btn.disabled = true; btn.textContent = 'Creazione…';
          const payload = {
            name: form.elements.name.value,
            email: form.elements.email.value,
            role: form.elements.role.value,
            grower: form.elements.grower.value,
            viaEmail: !!(form.elements.viaEmail && form.elements.viaEmail.checked),
          };
          let res;
          try { res = await A.createUser(payload); }
          catch (e) { res = { ok: false, error: 'Errore: ' + (e.message || e) }; }
          btn.disabled = false; btn.textContent = 'Crea utente';
          const err = sheet.querySelector('#inviteErr');
          if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
          U.closeSheet();
          // refresh FIRST: render() closes any open sheet, so the password
          // panel must be opened afterwards or it would be wiped at once.
          ctx.refresh();
          showPassword(`Utente creato: ${payload.name || res.user.email}`,
            'Password temporanea: comunicala all\'interessato, non sarà più visibile.', res.password,
            A.backend() === 'supabase' ? payload.email : null,
            { mail: res.mail, name: payload.name, role: payload.role });
        }
        submitFn = submit;
      },
    });
  });

  root.querySelectorAll('[data-role-for]').forEach((b) => {
    b.addEventListener('click', () => {
      const u = A.listUsers().find((x) => x.id === b.dataset.roleFor);
      U.openSheet({
        title: 'Cambia ruolo · ' + u.name,
        body: `<form id="roleForm">
            <label class="field"><span>Ruolo</span><select name="role">
              ${P.ROLES.map((r) => `<option value="${r.key}"${u.role === r.key ? ' selected' : ''}>${U.esc(r.label)}</option>`).join('')}
            </select></label>
            <label class="field"><span>Produttore collegato</span><select name="grower">
              <option value="">—</option>
              ${S.store.meta.produttori.map((g) => `<option value="${U.esc(g)}"${u.grower === g ? ' selected' : ''}>${U.esc(g)}</option>`).join('')}
            </select></label>
            <p class="field-error" id="roleErr" hidden></p>
          </form>`,
        actions: [
          { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
          { label: 'Salva', class: 'btn-primary', run: () => save() },
        ],
        onMount: (sheet) => {
          const form = sheet.querySelector('#roleForm');
          async function save() {
            const res = await A.setRole(u.id, form.elements.role.value);
            const err = sheet.querySelector('#roleErr');
            if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
            if (form.elements.role.value === 'produttore') await A.setGrower(u.id, form.elements.grower.value);
            U.closeSheet();
            U.toast('Ruolo aggiornato');
            ctx.refresh();
          }
        },
      });
    });
  });

  /* Password: either generate a one-time password or type one yourself (PD-9) */
  let pwSubmitFn = null;
  root.querySelectorAll('[data-reset-pw]').forEach((b) => {
    b.addEventListener('click', () => {
      const u = A.listUsers().find((x) => x.id === b.dataset.resetPw);
      const canEmail = A.credentialsEmailAvailable();
      U.openSheet({
        title: 'Password · ' + u.name,
        body: `<form id="pwForm" novalidate>
            <p class="caption">Account <b>${U.esc(u.email)}</b> · ${U.esc(P.roleLabel(u.role))}</p>
            <div class="field">
              <span>Come vuoi procedere</span>
              <label class="radio-row"><input type="radio" name="mode" value="generate" checked>
                <span>Genera una password temporanea</span></label>
              <p class="hint" style="margin:2px 0 10px 30px">La vedi una sola volta e la consegni tu${canEmail ? ', oppure parte subito per email' : ''}.</p>
              <label class="radio-row"><input type="radio" name="mode" value="set">
                <span>Imposta una password scelta da te</span></label>
              <p class="hint" style="margin:2px 0 0 30px">Utile quando la persona deve usare una password già concordata.</p>
            </div>
            <div id="pwFields" hidden>
              <label class="field"><span>Nuova password</span>
                <input type="password" name="next" autocomplete="new-password" minlength="8"></label>
              <label class="field"><span>Ripeti la password</span>
                <input type="password" name="confirm" autocomplete="new-password" minlength="8"></label>
              <p class="hint">Almeno 8 caratteri, massimo 72. Comunicala tu: non viene mostrata altrove.</p>
            </div>
            <p class="field-error" id="pwErr" hidden></p>
          </form>`,
        actions: [
          { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
          { label: 'Applica', class: 'btn-primary', run: () => { if (pwSubmitFn) pwSubmitFn(); } },
        ],
        onMount: (sheet) => {
          const form = sheet.querySelector('#pwForm');
          const fields = sheet.querySelector('#pwFields');
          const err = sheet.querySelector('#pwErr');
          const mode = () => (form.querySelector('input[name="mode"]:checked') || {}).value || 'generate';
          const syncMode = () => {
            const set = mode() === 'set';
            fields.hidden = !set;
            sheet.querySelector('.sheet-actions [data-act="1"]').textContent = set ? 'Imposta' : 'Genera';
            err.hidden = true;
          };
          form.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', syncMode));
          syncMode();

          async function submit() {
            const btn = sheet.querySelector('.sheet-actions [data-act="1"]');
            if (mode() === 'set') {
              const problems = A.passwordIssues(form.elements.next.value,
                { confirm: form.elements.confirm.value, email: u.email });
              if (problems.length) { err.hidden = false; err.textContent = problems.join(' '); return; }
              btn.disabled = true; btn.textContent = 'Impostazione…';
              const res = await A.setUserPassword(u, form.elements.next.value);
              btn.disabled = false; syncMode();
              if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
              const pwd = form.elements.next.value;
              U.closeSheet();
              U.toast(`Password di ${u.name} aggiornata`, canEmail ? {
                ms: 8000,
                action: { label: 'Invia email', run: async () => {
                  const mail = await A.resendCredentialsEmail({
                    email: u.email, name: u.name, role: u.role, password: pwd,
                  });
                  const sent = mail.ok && mail.email_sent;
                  U.toast(sent ? 'Email inviata a ' + u.email
                    : (mail.error || mail.mail_error || 'Invio non riuscito'),
                  { tone: sent ? undefined : 'error' });
                } },
              } : undefined);
              ctx.refresh();
              return;
            }
            // generate: the one-time password panel (with the optional e-mail)
            btn.disabled = true; btn.textContent = 'Generazione…';
            const res = await A.resetPassword(u, { viaEmail: canEmail });
            btn.disabled = false; syncMode();
            if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
            U.closeSheet();
            ctx.refresh();          // render() closes sheets → refresh before the panel
            showPassword('Password reimpostata', `Nuova password per ${u.name}:`, res.password,
              A.backend() === 'supabase' ? u.email : null,
              { mail: res.mail, name: u.name, role: u.role });
          }
          pwSubmitFn = submit;
          form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
        },
      });
    });
  });

  root.querySelectorAll('[data-del-user]').forEach((b) => {
    b.addEventListener('click', () => {
      const u = A.listUsers().find((x) => x.id === b.dataset.delUser);
      U.confirmSheet({
        title: 'Eliminare l\'utente?',
        message: `${u.name} (${u.email}) viene rimosso: non potrà più accedere e il suo indirizzo torna libero. L\'operazione non si può annullare.`,
        confirmLabel: 'Elimina', danger: true,
        onConfirm: async () => {
          const res = await A.deleteUser(u);
          if (!res.ok) { U.toast(res.error, { tone: 'error' }); return; }
          U.toast('Utente eliminato');
          ctx.refresh();
        },
      });
    });
  });

  root.querySelectorAll('[data-block]').forEach((b) => {
    b.addEventListener('click', () => {
      const u = A.listUsers().find((x) => x.id === b.dataset.block);
      U.confirmSheet({
        title: 'Sospendere l\'utente?',
        message: `${u.name} non potrà più accedere finché non viene riattivato.`,
        confirmLabel: 'Sospendi', danger: true,
        onConfirm: async () => {
          const res = await A.blockUser(u.id);
          if (!res.ok) { U.toast(res.error, { tone: 'error' }); return; }
          U.toast('Utente sospeso');
          ctx.refresh();
        },
      });
    });
  });
  root.querySelectorAll('[data-unblock]').forEach((b) => {
    b.addEventListener('click', async () => {
      const res = await A.unblockUser(b.dataset.unblock);
      if (!res.ok) { U.toast(res.error, { tone: 'error' }); return; }
      U.toast('Utente riattivato');
      ctx.refresh();
    });
  });

  root.querySelector('#resetRegistry').addEventListener('click', () => {
    U.confirmSheet({
      title: 'Ripristinare gli utenti dimostrativi?',
      message: 'Inviti, sospensioni e password personalizzate vengono azzerati.',
      confirmLabel: 'Ripristina', danger: true,
      onConfirm: () => { A.resetRegistry(); ctx.refresh(); U.toast('Utenti dimostrativi ripristinati'); },
    });
  });
}

/**
 * Shows a one-time password with copy / e-mail actions.
 * `opts.mail` is what the backend reported about the delivery (sent / error).
 */
function showPassword(title, message, password, email, opts = {}) {
  const mail = opts.mail || null;
  const viaFunction = A.credentialsEmailAvailable();
  const actions = [
    { label: 'Chiudi', class: 'btn-secondary', run: U.closeSheet },
    { label: 'Copia', class: 'btn-primary', run: async () => {
      try { await navigator.clipboard.writeText(password); U.toast('Password copiata'); }
      catch { U.toast('Copia non disponibile', { tone: 'error' }); }
    } },
  ];
  if (email) {
    actions.splice(1, 0, {
      label: mail && mail.sent ? 'Reinvia email' : 'Invia email', class: 'btn-secondary',
      run: async () => {
        if (viaFunction) {
          const res = await A.resendCredentialsEmail({
            email, name: opts.name || '', role: opts.role || '', password,
          });
          const sent = res.ok && res.email_sent;
          U.toast(sent ? 'Email inviata a ' + email
            : (res.error || res.mail_error || 'Invio non riuscito'),
          { tone: sent ? undefined : 'error' });
          return;
        }
        // no Edge Function on the project: send the standard recovery link instead
        const res = await A.sendRecoveryEmail(email);
        U.toast(res.ok
          ? 'Email con il link per impostare la password inviata a ' + email
          : res.error, { tone: res.ok ? undefined : 'error' });
      },
    });
  }
  const status = !mail ? ''
    : mail.sent
      ? `<div class="banner banner-ok" style="margin-top:10px"><span aria-hidden="true">✓</span>
          <span>Password inviata per email a <b>${U.esc(email)}</b>${mail.provider ? ` (${U.esc(mail.provider)})` : ''}.</span></div>`
      : `<div class="banner banner-warn" style="margin-top:10px"><span aria-hidden="true">⚠</span>
          <span>Email non inviata: ${U.esc(mail.error || 'invio non riuscito')}.
          Copia la password e consegnala a mano.</span></div>`;
  U.openSheet({
    title,
    body: `<p class="caption">${U.esc(message)}</p>
      <p class="mono" style="font-size:18px;font-weight:700;background:var(--brand-50);
        border-radius:8px;padding:10px 12px;margin-top:10px">${U.esc(password)}</p>
      ${status}
      <p class="hint">Copiala ora: non verrà mostrata di nuovo.${email && !mail ? (viaFunction
        ? ' «Invia email» manda la password al destinatario.'
        : ' «Invia email» manda al destinatario il link per impostare la password da sé.') : ''}</p>`,
    actions,
  });
}

/* --------------------------------------------------- M-05 / S-13L helpers */
export function viewDenied(root) {
  root.innerHTML = `<div class="locked">
      <div class="lock-icon" aria-hidden="true">🔒</div>
      <h2>Non hai i permessi per questa sezione</h2>
      <p>Il tuo profilo non prevede questa schermata. Torna alla panoramica o cambia profilo.</p>
      <a class="btn btn-primary btn-block" href="#/home">Torna alla home</a>
    </div>`;
}

export function viewLockedPC(root) {
  root.innerHTML = `<div class="locked">
      <div class="lock-icon" aria-hidden="true">🔒</div>
      <h2>Inserimento dati disponibile solo da PC</h2>
      <p>Registra lotti, impegni e import da un computer (≥1024 dp). Da smartphone puoi consultare i riepiloghi.</p>
      <a class="btn btn-primary btn-block" href="#/r/disponibilita">Vai ai riepiloghi</a>
      <button class="btn btn-secondary btn-block mt" type="button" id="copyLink">Copia link per il PC</button>
    </div>`;
  root.querySelector('#copyLink').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.origin + location.pathname + '#/dati/lotti');
      U.toast('Link copiato');
    } catch { U.toast('Copia non disponibile in questo browser', { tone: 'error' }); }
  });
}
