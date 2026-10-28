/* Vignero · views-reports.js — access, home, the three reports, matrix, profile */
import * as S from './store.js';
import * as U from './ui.js';
import * as P from './permissions.js';
import * as A from './auth.js';
import { filterBar, parseFilters, serializeFilters, activeChips } from './filters.js';

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
        </details>
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
  const attempt = (email, password) => {
    const res = A.authenticate(email, password);
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
    btn.disabled = true;
    btn.textContent = 'Accesso…';
    attempt(email, password);
    btn.disabled = false;
    btn.textContent = 'Accedi';
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
        title: 'Indisponibilità', sub: 'Solo i deficit', badge: s.negativeCount, badgeTone: 'danger' },
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

  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Panoramica</p>
      <h1>${ctx.user ? U.esc(ctx.user.name.split(' ')[0]) + ', ' : ''}da dove vuoi iniziare?</h1>
      <p class="sub">${U.esc(P.roleLabel(ctx.role))} · ${tileCount} sezioni disponibili ·
        ${s.lotti} lotti · ${s.ordiniNonSpediti} impegni non spediti</p>
    </div></div>

    <div class="kpis kpis-compact">
      <button class="kpi" type="button" data-go="#/r/disponibilita">
        <span class="k-label">Disponibilità totale</span>
        <span class="k-value">${U.fmtSigned(s.disponibilita)}</span>
        <span class="k-sub">giacenza ${U.fmtQty(s.giacenza)}</span>
      </button>
      <button class="kpi ${neg ? 'tone-danger' : 'tone-ok'}" type="button"
              ${P.can(ctx.role, 'r.indisponibilita') ? 'data-go="#/r/indisponibilita"' : 'data-go="#/r/disponibilita"'}>
        <span class="k-label">In indisponibilità</span>
        <span class="k-value">${neg}</span>
        <span class="k-sub">${neg ? 'combinazioni in deficit' : 'nessun deficit'}</span>
      </button>
      <button class="kpi hide-sm" type="button" ${P.can(ctx.role, 'dati.lotti') ? 'data-go="#/dati/lotti"' : 'data-go="#/r/disponibilita"'}>
        <span class="k-label">Lotti registrati</span>
        <span class="k-value">${U.fmtQty(s.lotti)}</span>
        <span class="k-sub">anno di conferimento</span>
      </button>
      <button class="kpi hide-sm" type="button" ${P.can(ctx.role, 'dati.ordini') ? 'data-go="#/dati/ordini"' : 'data-go="#/r/disponibilita"'}>
        <span class="k-label">Da spedire</span>
        <span class="k-value">${U.fmtQty(s.daSpedire)}</span>
        <span class="k-sub">${s.ordiniNonSpediti} impegni aperti</span>
      </button>
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
          cols: [{ label: 'Anno' }, { label: 'Produttore' }, { label: 'Varietà / clone' }, { label: 'Quantità', align: 'r' }],
          rows: s.ultimiLotti.length ? s.ultimiLotti.map((l) => ({
            type: 'row',
            cells: [
              { html: U.esc(l.anno), label: 'Anno' },
              { html: U.esc(l.produttore || '—'), label: 'Produttore' },
              { html: `<span class="ident">${U.esc(l.clone)}<small>${U.esc(l.varieta)} · ${U.esc(l.portainnesto)}</small></span>`, label: 'Varietà / clone' },
              U.metric('Quantità', U.fmtQty(l.quantita)),
            ],
          })) : [{ type: 'empty', cells: [{ html: 'Nessun lotto registrato.' }] }],
        })}
      </section>

      ${P.can(ctx.role, 'r.indisponibilita') ? `
      <section class="card">
        <div class="card-pad" style="border-bottom:1px solid var(--line)">
          <div class="row-between">
            <h2 class="eyebrow">Indisponibilità principali</h2>
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
        </ul>` : `<p class="card-pad caption">Nessuna indisponibilità: magazzino ≥ ordinato su tutte le combinazioni.</p>`}
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
export function viewDisponibilita(root, ctx) {
  const f = parseFilters(ctx.params);
  const r = S.reportDisponibilita(f);
  const stamp = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  reportShell(root, {
    eyebrow: 'Riepiloghi / Disponibilità',
    title: 'Riepilogo disponibilità',
    sub: `${r.rowCount} combinazioni · ${r.groups.length} portainnesti · ${r.negativeCount} in negativo · aggiornato ${stamp}`,
    actions: `<button class="btn btn-secondary btn-sm" type="button" id="exportBtn">Esporta CSV</button>`,
  });

  filterBar(root.querySelector('#filterHost'), f,
    (next) => ctx.navigate('#/r/disponibilita' + serializeFilters(next)));

  const rows = [];
  for (const g of r.groups) {
    rows.push({
      type: 'group',
      cells: [{ html: `▦ ${U.esc(g.portainnesto)}`, sub: `Totale portainnesto ${U.fmtSigned(g.sub.disponibilita)}` }],
    });
    for (const row of g.rows) {
      const neg = row.disponibilita < 0;
      rows.push({
        type: 'row',
        cls: neg ? 'trow negative' : 'trow',
        cells: [
          { html: `${neg ? '⚠ ' : ''}${U.esc(row.clone)}<small>${U.esc(row.varieta)}</small>`, cls: 'ident' },
          U.metric('Magazzino', U.fmtQty(row.mag)),
          U.metric('Ordinato', U.fmtQty(row.ord)),
          U.metric('Di cui spedito', U.fmtQty(row.sped)),
          U.metric('Da spedire', U.fmtQty(row.daSpedire)),
          U.metric('Disponibilità', U.fmtSigned(row.disponibilita), { negative: neg }),
        ],
      });
    }
    rows.push({
      type: 'subtotal',
      cells: [
        { html: `Totale portainnesto <span class="mono">${U.esc(g.portainnesto)}</span>`, cls: 'ident' },
        { html: U.fmtQty(g.sub.mag), cls: 'r metric', label: 'Magazzino' },
        { html: U.fmtQty(g.sub.ord), cls: 'r metric', label: 'Ordinato' },
        { html: U.fmtQty(g.sub.sped), cls: 'r metric', label: 'Di cui spedito' },
        { html: U.fmtQty(g.sub.daSpedire), cls: 'r metric', label: 'Da spedire' },
        { html: `<span class="${g.sub.disponibilita < 0 ? 'neg' : ''}">${U.fmtSigned(g.sub.disponibilita)}</span>`, cls: 'r metric', label: 'Disponibilità' },
      ],
    });
  }
  if (r.groups.length) {
    rows.push({
      type: 'total',
      cells: [
        { html: 'Totale generale', cls: 'ident' },
        { html: U.fmtQty(r.totals.mag), cls: 'r metric', label: 'Magazzino' },
        { html: U.fmtQty(r.totals.ord), cls: 'r metric', label: 'Ordinato' },
        { html: U.fmtQty(r.totals.sped), cls: 'r metric', label: 'Di cui spedito' },
        { html: U.fmtQty(r.totals.daSpedire), cls: 'r metric', label: 'Da spedire' },
        { html: `<span class="${r.totals.disponibilita < 0 ? 'neg' : ''}">${U.fmtSigned(r.totals.disponibilita)}</span>`, cls: 'r metric', label: 'Disponibilità' },
      ],
    });
  }

  const host = root.querySelector('#reportHost');
  if (!r.groups.length) {
    host.innerHTML = U.emptyState({
      icon: '◇', title: 'Nessun dato con i filtri selezionati',
      text: 'Rimuovi i filtri per vedere tutte le combinazioni.', action: 'Rimuovi filtri',
    });
    host.querySelector('[data-empty-action]').addEventListener('click',
      () => ctx.navigate('#/r/disponibilita'));
  } else {
    host.innerHTML = `<div class="report">${U.buildTable({
      caption: 'Raggruppato per portainnesto, ordinato per codice portainnesto e clone. Rosso = disponibilità negativa.',
      cols: [{ label: 'Codice clone' }, { label: 'Magazzino', align: 'r' }, { label: 'Ordinato', align: 'r' },
             { label: 'Di cui spedito', align: 'r' }, { label: 'Da spedire', align: 'r' }, { label: 'Disponibilità', align: 'r' }],
      rows,
    })}</div>`;
  }

  root.querySelector('#exportBtn').addEventListener('click', () => {
    const out = [];
    for (const g of r.groups) {
      for (const row of g.rows) {
        out.push([row.clone, row.varieta, row.portainnesto, row.mag, row.ord, row.sped, row.daSpedire, row.disponibilita]);
      }
      out.push(['Totale portainnesto', '', g.portainnesto, g.sub.mag, g.sub.ord, g.sub.sped, g.sub.daSpedire, g.sub.disponibilita]);
    }
    out.push(['Totale generale', '', '', r.totals.mag, r.totals.ord, r.totals.sped, r.totals.daSpedire, r.totals.disponibilita]);
    U.exportCSV(`disponibilita_${U.nowStamp()}.csv`,
      ['Codice clone', 'Codice varietà', 'Codice portainnesto', 'Magazzino', 'Ordinato', 'Di cui spedito', 'Da spedire', 'Disponibilità'],
      out);
  });
}

/* ------------------------------------------- S-06/S-07 per produttore */
export function viewPerProduttore(root, ctx) {
  const f = parseFilters(ctx.params);
  const r = S.reportPerProduttore(f);
  reportShell(root, {
    eyebrow: 'Riepiloghi / Per produttore',
    title: 'Riepilogo per produttore',
    sub: `${r.growers.length} produttori + non attribuito · ${r.negativeCount} combinazioni con valori negativi`,
    actions: `<button class="btn btn-secondary btn-sm" type="button" id="exportBtn">Esporta CSV</button>`,
  });
  filterBar(root.querySelector('#filterHost'), f,
    (next) => ctx.navigate('#/r/produttore' + serializeFilters(next)));

  const cols = [
    { label: 'Codice clone' }, { label: 'Portainnesto' },
    { label: 'Magazzino', align: 'r' }, { label: 'Ordinato', align: 'r' },
    { label: 'Di cui spedito', align: 'r' }, { label: 'Disponibilità', align: 'r' },
    ...r.growers.map((g) => ({ label: g, align: 'r' })),
    { label: 'Non attribuito', align: 'r' }, { label: 'Tot. produttori', align: 'r' },
  ];

  const growerCells = (o) => r.growers.map((g) => {
    const v = o.per[g];
    return U.metric(g, U.fmtSigned(v), { negative: v < 0 });
  });

  const rows = [];
  for (const grp of r.groups) {
    rows.push({ type: 'group', cells: [{ html: `▦ ${U.esc(grp.portainnesto)}`, sub: `Totale portainnesto ${U.fmtSigned(grp.sub.disponibilita)}` }] });
    for (const row of grp.rows) {
      const neg = row.disponibilita < 0;
      rows.push({
        type: 'row', cls: neg ? 'trow negative' : 'trow',
        cells: [
          { html: `${neg ? '⚠ ' : ''}${U.esc(row.clone)}<small>${U.esc(row.varieta)}</small>`, cls: 'ident' },
          { html: U.esc(row.portainnesto), label: 'Portainnesto' },
          U.metric('Magazzino', U.fmtQty(row.mag)),
          U.metric('Ordinato', U.fmtQty(row.ord)),
          U.metric('Di cui spedito', U.fmtQty(row.sped)),
          U.metric('Disponibilità', U.fmtSigned(row.disponibilita), { negative: neg }),
          ...growerCells(row),
          U.metric('Non attribuito', U.fmtSigned(row.nonAttr), { negative: row.nonAttr < 0 }),
          U.metric('Tot. produttori', U.fmtSigned(row.totaleProduttori), { negative: row.totaleProduttori < 0 }),
        ],
      });
    }
    rows.push({
      type: 'subtotal',
      cells: [
        { html: `Totale portainnesto <span class="mono">${U.esc(grp.portainnesto)}</span>`, cls: 'ident' },
        { html: '', label: 'Portainnesto' },
        { html: U.fmtQty(grp.sub.mag), cls: 'r metric', label: 'Magazzino' },
        { html: U.fmtQty(grp.sub.ord), cls: 'r metric', label: 'Ordinato' },
        { html: U.fmtQty(grp.sub.sped), cls: 'r metric', label: 'Di cui spedito' },
        { html: U.fmtSigned(grp.sub.disponibilita), cls: 'r metric', label: 'Disponibilità' },
        ...r.growers.map((g) => ({ html: U.fmtSigned(grp.sub.per[g]), cls: 'r metric', label: g })),
        { html: U.fmtSigned(grp.sub.nonAttr), cls: 'r metric', label: 'Non attribuito' },
        { html: U.fmtSigned(grp.sub.totaleProduttori), cls: 'r metric', label: 'Tot. produttori' },
      ],
    });
  }
  if (r.groups.length) {
    rows.push({
      type: 'total',
      cells: [
        { html: 'Totale generale', cls: 'ident' }, { html: '', label: 'Portainnesto' },
        { html: U.fmtQty(r.totals.mag), cls: 'r metric', label: 'Magazzino' },
        { html: U.fmtQty(r.totals.ord), cls: 'r metric', label: 'Ordinato' },
        { html: U.fmtQty(r.totals.sped), cls: 'r metric', label: 'Di cui spedito' },
        { html: U.fmtSigned(r.totals.disponibilita), cls: 'r metric', label: 'Disponibilità' },
        ...r.growers.map((g) => ({ html: U.fmtSigned(r.totals.per[g]), cls: 'r metric', label: g })),
        { html: U.fmtSigned(r.totals.nonAttr), cls: 'r metric', label: 'Non attribuito' },
        { html: U.fmtSigned(r.totals.totaleProduttori), cls: 'r metric', label: 'Tot. produttori' },
      ],
    });
  }

  const host = root.querySelector('#reportHost');
  host.innerHTML = r.groups.length
    ? `<div class="banner banner-info"><span aria-hidden="true">i</span>
         <span>Le quantità a magazzino sono divise per <code>lotti_magazzino.produttore</code>.
         Un impegno entra nella colonna di un produttore solo se è collegato a un lotto
         (<code>id_magazzino</code>); altrimenti finisce in <b>Non attribuito</b>.</span></div>
       <div class="report">${U.buildTable({
         caption: 'Disponibilità per produttore, raggruppata per portainnesto. Le prime due colonne restano visibili allo scorrimento orizzontale.',
         scroll: true, cols, rows,
       })}</div>`
    : U.emptyState({ icon: '◇', title: 'Nessun dato con i filtri selezionati', text: 'Rimuovi i filtri.', action: 'Rimuovi filtri' });
  if (!r.groups.length) {
    host.querySelector('[data-empty-action]').addEventListener('click', () => ctx.navigate('#/r/produttore'));
  }

  root.querySelector('#exportBtn').addEventListener('click', () => {
    const out = [];
    for (const grp of r.groups) {
      for (const row of grp.rows) {
        out.push([row.clone, row.varieta, row.portainnesto, row.mag, row.ord, row.sped,
                  row.disponibilita, ...r.growers.map((g) => row.per[g]), row.nonAttr, row.totaleProduttori]);
      }
      out.push(['Totale portainnesto', '', grp.portainnesto, grp.sub.mag, grp.sub.ord, grp.sub.sped,
                grp.sub.disponibilita, ...r.growers.map((g) => grp.sub.per[g]), grp.sub.nonAttr, grp.sub.totaleProduttori]);
    }
    U.exportCSV(`disponibilita_per_produttore_${U.nowStamp()}.csv`,
      ['Codice clone', 'Codice varietà', 'Codice portainnesto', 'Magazzino', 'Ordinato', 'Di cui spedito',
       'Disponibilità', ...r.growers, 'Non attribuito', 'Tot. produttori'], out);
  });
}

/* --------------------------------------------- S-08/S-09 indisponibilità */
export function viewIndisponibilita(root, ctx) {
  const f = parseFilters(ctx.params);
  const r = S.reportIndisponibilita(f);
  reportShell(root, {
    eyebrow: 'Riepiloghi / Indisponibilità',
    title: 'Indisponibilità',
    sub: r.count
      ? `${r.count} articoli in deficit · deficit totale ${U.fmtQty(r.deficitTot)} · ordinato per varietà → portainnesto → clone`
      : 'Ordinato per varietà → portainnesto → clone',
    actions: `<button class="btn btn-secondary btn-sm" type="button" id="exportBtn"${r.count ? '' : ' disabled'}>Esporta CSV</button>`,
  });
  filterBar(root.querySelector('#filterHost'), f,
    (next) => ctx.navigate('#/r/indisponibilita' + serializeFilters(next)));

  const host = root.querySelector('#reportHost');
  if (!r.count) {
    host.innerHTML = U.emptyState({
      icon: '✓', title: 'Nessuna indisponibilità con i filtri attuali',
      text: activeChips(f).length ? 'Prova a rimuovere i filtri.' : 'Magazzino ≥ ordinato su tutte le combinazioni.',
      action: activeChips(f).length ? 'Rimuovi filtri' : 'Vedi disponibilità',
    });
    host.querySelector('[data-empty-action]').addEventListener('click', () => ctx.navigate(
      activeChips(f).length ? '#/r/indisponibilita' : '#/r/disponibilita'));
    return;
  }

  const rows = r.rows.map((row) => ({
    type: 'row', cls: 'trow negative',
    cells: [
      { html: `⚠ ${U.esc(row.clone)}<small>${U.esc(row.varieta)}</small>`, cls: 'ident' },
      { html: U.esc(row.tipologia), label: 'Tipologia' },
      { html: U.esc(row.produzione), label: 'Produzione' },
      { html: U.esc(row.portainnesto), label: 'Portainnesto' },
      U.metric('Magazzino', U.fmtQty(row.mag)),
      U.metric('Ordinato', U.fmtQty(row.ord)),
      U.metric('Deficit', '\u2212' + U.fmtQty(row.deficit), { negative: true }),
    ],
  }));

  host.innerHTML = `
    <div class="banner banner-error"><span aria-hidden="true">⚠</span>
      <span><b>${r.count} articoli</b> con disponibilità negativa · deficit totale <b>${U.fmtQty(r.deficitTot)}</b></span></div>
    <div class="report">${U.buildTable({
      caption: 'Il deficit è |magazzino − ordinato| mostrato con il segno meno.',
      cols: [{ label: 'Codice clone' }, { label: 'Tipologia' }, { label: 'Produzione' },
             { label: 'Portainnesto' }, { label: 'Magazzino', align: 'r' },
             { label: 'Ordinato', align: 'r' }, { label: 'Deficit', align: 'r' }],
      rows,
    })}</div>`;

  root.querySelector('#exportBtn').addEventListener('click', () => {
    U.exportCSV(`indisponibilita_${U.nowStamp()}.csv`,
      ['Tipologia', 'Produzione', 'Codice varietà', 'Codice clone', 'Codice portainnesto', 'Magazzino', 'Ordinato', 'Deficit'],
      r.rows.map((x) => [x.tipologia, x.produzione, x.varieta, x.clone, x.portainnesto, x.mag, x.ord, -x.deficit]));
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
  const counts = {
    viti: S.store.viti.length, portainnesti: S.store.portainnesti.length,
    lotti: S.store.lotti.length, ordini: S.store.ordini.length,
  };
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
        </div>
      </section>
      <section class="card card-pad">
        <h2 class="eyebrow" style="margin-bottom:8px">Dati del dimostrativo</h2>
        <p class="caption">${U.fmtQty(counts.viti)} coppie varietà/clone · ${U.fmtQty(counts.portainnesti)} portainnesti ·
          ${U.fmtQty(counts.lotti)} lotti · ${U.fmtQty(counts.ordini)} impegni. Quantità sintetiche, struttura reale.</p>
        <div class="row mt">
          <button class="btn btn-secondary btn-sm" type="button" id="resetBtn">Azzera le modifiche locali</button>
          <a class="btn btn-ghost btn-sm" href="docs/01-gui-specification.md">Specifica</a>
          <a class="btn btn-ghost btn-sm" href="docs/mockups/fede-magazzino-mockup.drawio">Mockup</a>
        </div>
      </section>
      <section class="card card-pad">
        <h2 class="eyebrow" style="margin-bottom:8px">Account dimostrativi</h2>
        <p class="caption">Un utente per profilo (l'autenticazione è lato client: dimostra il flusso,
          non protegge nulla).</p>
        <div class="report mt">${U.buildTable({
          cols: [{ label: 'Profilo' }, { label: 'Utente' }, { label: 'Email' }, { label: 'Password' }],
          rows: A.USERS.map((u) => ({
            type: 'row',
            cells: [
              { html: U.esc(P.roleLabel(u.role)), label: 'Profilo' },
              { html: U.esc(u.name), label: 'Utente' },
              { html: `<span class="ident">${U.esc(u.email)}</span>`, label: 'Email' },
              { html: `<span class="ident">${U.esc(u.password)}</span>`, label: 'Password' },
            ],
          })),
        })}</div>
      </section>
    </div>`;
  root.querySelector('#logoutBtn').addEventListener('click', () => ctx.logout());
  root.querySelector('#resetBtn').addEventListener('click', () => {
    U.confirmSheet({
      title: 'Azzerare le modifiche locali?',
      message: 'Lotti, impegni e anagrafiche inseriti in questa sessione vengono rimossi dal browser.',
      confirmLabel: 'Azzera', danger: true,
      onConfirm: () => { S.resetLocalEdits(); location.reload(); },
    });
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
