/* Vignero · views-reports.js — access, home, the three reports, matrix, profile */
import * as S from './store.js';
import * as U from './ui.js';
import * as P from './permissions.js';
import { filterBar, parseFilters, serializeFilters, activeChips } from './filters.js';

/* ------------------------------------------------------------- S-01 login */
export function viewLogin(root, ctx) {
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Accesso</p>
      <h1>Scegli il profilo</h1>
      <p class="sub">Ambiente dimostrativo: nessuna password richiesta. Ogni profilo
        vede solo le sezioni consentite dalla matrice dei permessi.</p>
    </div></div>
    <div class="tile-list" role="list">
      ${P.ROLES.map((r) => `
        <button class="tile" type="button" role="listitem" data-role="${r.key}" style="text-align:left;cursor:pointer;border:1px solid var(--line)">
          <span class="badge" style="background:var(--brand-50);color:var(--brand-600)">${U.esc(r.short)}</span>
          <span>
            <span class="t-title">${U.esc(r.label)}</span>
            <span class="t-sub">${U.esc(r.blurb)}</span>
          </span>
          <span class="t-go" aria-hidden="true">›</span>
        </button>`).join('')}
    </div>
    <p class="hint">Dati dimostrativi: struttura e anagrafiche reali, quantità sintetiche.</p>`;
  root.querySelectorAll('[data-role]').forEach((b) => {
    b.addEventListener('click', () => ctx.setRole(b.dataset.role));
  });
}

/* -------------------------------------------------------------- S-02 home */
export function viewHome(root, ctx) {
  const s = S.summary();
  const neg = s.negativeCount;
  const tiles = [
    P.can(ctx.role, 'r.disponibilita') && { href: '#/r/disponibilita', title: 'Riepilogo disponibilità', sub: 'Magazzino, ordinato, di cui spedito, disponibilità.' },
    P.can(ctx.role, 'r.produttore') && { href: '#/r/produttore', title: 'Riepilogo per produttore', sub: 'Le stesse quantità divise nelle 8 colonne dei produttori.' },
    P.can(ctx.role, 'r.indisponibilita') && { href: '#/r/indisponibilita', title: 'Indisponibilità', sub: 'Solo le combinazioni con disponibilità negativa.' },
  ].filter(Boolean);

  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Panoramica</p>
      <h1>Disponibilità di magazzino</h1>
      <p class="sub">Profilo ${U.esc(P.roleLabel(ctx.role))} · ${s.lotti} lotti · ${s.ordiniNonSpediti} impegni non spediti</p>
    </div></div>

    <div class="kpis">
      <button class="kpi" type="button" data-go="#/r/disponibilita">
        <span class="k-label">Disponibilità totale</span>
        <span class="k-value">${U.fmtSigned(s.disponibilita)}</span>
        <span class="k-sub">giacenza ${U.fmtQty(s.giacenza)} · ordinato ${U.fmtQty(s.ordinato)}</span>
      </button>
      <button class="kpi ${neg ? 'tone-danger' : 'tone-ok'}" type="button" ${P.can(ctx.role, 'r.indisponibilita') ? 'data-go="#/r/indisponibilita"' : 'data-go="#/r/disponibilita"'}>
        <span class="k-label">In indisponibilità</span>
        <span class="k-value">${neg}</span>
        <span class="k-sub">${neg ? 'combinazioni in deficit' : 'nessun deficit'}</span>
      </button>
      <button class="kpi" type="button" ${P.can(ctx.role, 'dati.lotti') ? 'data-go="#/dati/lotti"' : 'data-go="#/r/disponibilita"'}>
        <span class="k-label">Lotti registrati</span>
        <span class="k-value">${U.fmtQty(s.lotti)}</span>
        <span class="k-sub">anno di conferimento</span>
      </button>
      <button class="kpi" type="button" ${P.can(ctx.role, 'dati.ordini') ? 'data-go="#/dati/ordini"' : 'data-go="#/r/disponibilita"'}>
        <span class="k-label">Da spedire</span>
        <span class="k-value">${U.fmtQty(s.daSpedire)}</span>
        <span class="k-sub">${s.ordiniNonSpediti} impegni aperti</span>
      </button>
    </div>

    <div class="stack">
      <section>
        <h2 class="eyebrow" style="margin-bottom:8px">Riepiloghi</h2>
        <div class="tile-list">
          ${tiles.map((t) => `
            <a class="tile" href="${t.href}">
              <span><span class="t-title">${U.esc(t.title)}</span><span class="t-sub">${U.esc(t.sub)}</span></span>
              <span class="t-go" aria-hidden="true">›</span>
            </a>`).join('')}
        </div>
      </section>

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
      </section>` : ''}

      ${!P.can(ctx.role, 'dati.lotti') ? `
      <section class="card card-pad">
        <p class="caption">Profilo ${U.esc(P.roleLabel(ctx.role))}: consultazione. L'inserimento dati è riservato ad Amministratore e Amministrazione, da PC.</p>
      </section>` : `
      <section class="card card-pad">
        <div class="row-between">
          <p class="caption">Inserimento dati disponibile solo da PC (≥1024 dp): lotti, impegni e import.</p>
          <a class="btn btn-secondary btn-sm" href="#/dati/lotti">Apri dati</a>
        </div>
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
        cls: neg ? 'row negative' : 'row',
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
        type: 'row', cls: neg ? 'row negative' : 'row',
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
    ? `<div class="banner banner-info">Le colonne produttore derivano da <code>lotti_magazzino.produttore</code>; gli impegni entrano nella colonna di un produttore solo se collegati a un lotto (<code>id_magazzino</code>), altrimenti finiscono in <b>Non attribuito</b>.</div>
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
    type: 'row', cls: 'row negative',
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
  const counts = {
    viti: S.store.viti.length, portainnesti: S.store.portainnesti.length,
    lotti: S.store.lotti.length, ordini: S.store.ordini.length,
  };
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Profilo</p>
      <h1>${U.esc(P.roleLabel(ctx.role))}</h1>
      <p class="sub">${U.esc(P.ROLES.find((r) => r.key === ctx.role)?.blurb || '')}</p>
    </div></div>
    <div class="stack">
      <section class="card card-pad">
        <h2 class="eyebrow" style="margin-bottom:8px">Cambia profilo (dimostrazione)</h2>
        <div class="row">
          ${P.ROLES.map((r) => `<button class="btn ${r.key === ctx.role ? 'btn-primary' : 'btn-secondary'} btn-sm" type="button" data-role="${r.key}">${U.esc(r.label)}</button>`).join('')}
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
    </div>`;
  root.querySelectorAll('[data-role]').forEach((b) => {
    b.addEventListener('click', () => ctx.setRole(b.dataset.role));
  });
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
