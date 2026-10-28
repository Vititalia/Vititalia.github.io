/* Vignero · views-data.js — data entry (PC only), import, master data */
import * as S from './store.js';
import * as U from './ui.js';
import * as P from './permissions.js';

const PAGE = 40;
const state = { lottiLimit: PAGE, vitiLimit: 60, search: '', produttore: '' };

/* ------------------------------------------------------------- form bits */
function selectHTML(name, label, options, value, extra = '') {
  return `<label class="field"><span>${U.esc(label)}</span>
      <select name="${name}"${extra}>
        <option value="">— seleziona —</option>
        ${options.map((o) => `<option value="${U.esc(o)}"${o === value ? ' selected' : ''}>${U.esc(o)}</option>`).join('')}
      </select></label>`;
}

function yearRange() {
  const y = new Date().getFullYear();
  const out = [];
  for (let i = y + 1; i >= y - 8; i--) out.push(String(i));
  return out;
}

function cloneOptions(varieta) {
  if (!varieta) return [];
  return S.clonesOf(varieta);
}

/** Dependent variety → clone pair, shared by the lot and order forms. */
function wireVarietyClone(scope, preset = {}) {
  const cloneSel = scope.querySelector('[name="clone"]');
  const errBox = scope.querySelector('[data-clone-hint]');
  const hidden = scope.querySelector('input[type="hidden"][name="varieta"]');
  let varieta = preset.varieta || '';
  if (hidden) hidden.value = varieta;

  const paintClones = (v, selected) => {
    const clones = cloneOptions(v);
    cloneSel.innerHTML = clones.length
      ? `<option value="">— seleziona —</option>${clones.map((c) =>
          `<option value="${U.esc(c)}"${c === selected ? ' selected' : ''}>${U.esc(c)}</option>`).join('')}`
      : `<option value="">Seleziona prima la varietà</option>`;
    cloneSel.disabled = !clones.length;
    if (errBox) errBox.textContent = clones.length ? '' : 'Il clone si abilita dopo aver scelto la varietà (F-V2).';
  };

  U.combobox(scope.querySelector('[data-variety]'), {
    items: S.store.index.varieta.map((v) => ({
      value: v, label: v, sub: cloneOptions(v).length + ' cloni',
    })),
    placeholder: 'Cerca varietà…',
    value: preset.varieta || '',
    onPick: (value) => {
      varieta = value;
      if (hidden) hidden.value = value;      // makes the form self-contained
      paintClones(value, '');
    },
  });
  paintClones(varieta, preset.clone);
  return {
    get varieta() { return varieta; },
    /** Sets both box and clone list (used when a lot prefills the dimensions). */
    setVarieta(v, clone) {
      varieta = v;
      if (hidden) hidden.value = v;
      const box = scope.querySelector('[data-variety] input');
      if (box) box.value = v;
      paintClones(v, clone || '');
    },
  };
}

/* --------------------------------------------------------- S-13 lotti */
export function viewLotti(root, ctx) {
  const q = state.search.toLowerCase();
  const list = S.store.lotti
    .filter((l) => !state.produttore || l.produttore === state.produttore)
    .filter((l) => !q || [l.produttore, l.varieta, l.clone, l.portainnesto, l.tipologia]
      .some((x) => (x || '').toLowerCase().includes(q)))
    .slice()
    .reverse();
  const shown = list.slice(0, state.lottiLimit);

  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Dati / Lotti magazzino</p>
      <h1>Lotti magazzino</h1>
      <p class="sub">${U.fmtQty(list.length)} lotti · inserimento disponibile solo da PC</p>
    </div>
    <div class="spacer"></div>
    <div class="row">
      <button class="btn btn-secondary btn-sm" type="button" id="importBtn">Importa CSV</button>
      <button class="btn btn-primary" type="button" id="newBtn">+ Nuovo lotto</button>
    </div></div>

    <div class="card card-pad mb">
      <div class="filters" style="margin:0">
        <label class="field" style="margin:0"><span>Cerca</span>
          <input type="search" id="q" value="${U.esc(state.search)}" placeholder="produttore, varietà, clone…"></label>
        <label class="field" style="margin:0"><span>Produttore</span>
          <select id="prod">
            <option value="">Tutti</option>
            ${S.store.meta.produttori.map((p) => `<option value="${U.esc(p)}"${state.produttore === p ? ' selected' : ''}>${U.esc(p)}</option>`).join('')}
          </select></label>
      </div>
    </div>

    <div class="report">${U.buildTable({
      caption: 'Anagrafica validata: varietà → clone → portainnesto. Quantità intere.',
      cols: [{ label: 'Anno' }, { label: 'Produttore' }, { label: 'Tipologia' }, { label: 'Produzione' },
             { label: 'Varietà' }, { label: 'Clone' }, { label: 'Portainnesto' }, { label: 'Quantità', align: 'r' }, { label: 'Note' }],
      rows: shown.length ? shown.map((l) => ({
        type: 'row',
        cells: [
          { html: U.esc(l.anno), label: 'Anno' },
          { html: U.esc(l.produttore || '—'), label: 'Produttore' },
          { html: U.esc(l.tipologia || S.NON_INDICATA), label: 'Tipologia' },
          { html: U.esc(l.produzione || S.NON_INDICATA), label: 'Produzione' },
          { html: `<span class="ident">${U.esc(l.varieta)}</span>`, label: 'Varietà' },
          { html: `<span class="ident">${U.esc(l.clone)}</span>`, label: 'Clone' },
          { html: `<span class="ident">${U.esc(l.portainnesto)}</span>`, label: 'Portainnesto' },
          U.metric('Quantità', U.fmtQty(l.quantita)),
          { html: U.esc(l.note || ''), label: 'Note' },
        ],
      })) : [{ type: 'empty', cells: [{ html: 'Nessun lotto con questi criteri.' }] }],
    })}</div>
    ${list.length > shown.length ? `<div class="mt"><button class="btn btn-secondary btn-block" type="button" id="more">Mostra altri ${Math.min(PAGE, list.length - shown.length)} lotti</button></div>` : ''}`;

  root.querySelector('#q').addEventListener('input', U.debounce((e) => {
    state.search = e.target.value; state.lottiLimit = PAGE; ctx.refresh();
  }, 250));
  root.querySelector('#prod').addEventListener('change', (e) => {
    state.produttore = e.target.value; state.lottiLimit = PAGE; ctx.refresh();
  });
  const more = root.querySelector('#more');
  if (more) more.addEventListener('click', () => { state.lottiLimit += PAGE; ctx.refresh(); });
  root.querySelector('#importBtn').addEventListener('click', () => ctx.navigate('#/dati/import'));
  root.querySelector('#newBtn').addEventListener('click', () => openLottoForm(ctx));
}

function openLottoForm(ctx) {
  const body = `
    <form id="lotForm" novalidate>
      ${selectHTML('anno', 'Anno di conferimento', yearRange(), new Date().getFullYear())}
      ${selectHTML('produttore', 'Produttore', S.store.meta.produttori)}
      ${selectHTML('tipologia', 'Tipologia', S.store.meta.tipologie)}
      ${selectHTML('produzione', 'Produzione', S.store.meta.produzioni)}
      <label class="field"><span>Codice varietà</span><div data-variety></div></label>
      <input type="hidden" name="varieta">
      ${selectHTML('clone', 'Codice clone', [], '', ' disabled')}
      <p class="field-error" data-clone-hint></p>
      ${selectHTML('portainnesto', 'Codice portainnesto', S.store.index.rootstocks)}
      <label class="field"><span>Quantità (interi, no decimali)</span>
        <input type="number" name="quantita" min="0" step="1" inputmode="numeric" required></label>
      <label class="field"><span>Note</span><textarea name="note" maxlength="500"></textarea></label>
      <p class="field-error" id="formErr" hidden></p>
    </form>`;

  U.openSheet({
    title: 'Nuovo lotto',
    body,
    actions: [
      { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
      { label: 'Salva', class: 'btn-primary', run: submit },
    ],
    onMount: (sheet) => wireVarietyClone(sheet),
  });

  function submit() {
    const sheet = document.querySelector('.sheet');
    if (!sheet) return;
    const f = sheet.querySelector('#lotForm');
    if (!f || !f.isConnected) return;
    const data = Object.fromEntries(new FormData(f).entries());
    const errs = S.validateLotto(data);
    sheet.querySelectorAll('.field-error').forEach((e) => { if (e.id === 'formErr') e.hidden = true; });
    const keys = Object.keys(errs);
    if (keys.length) {
      const box = sheet.querySelector('#formErr');
      box.hidden = false;
      box.textContent = keys.map((k) => errs[k]).join(' ');
      const first = sheet.querySelector(`[name="${keys[0]}"]`);
      if (first) { first.setAttribute('aria-invalid', 'true'); first.focus(); }
      return;
    }
    S.addLotto(data);
    U.closeSheet();
    U.toast('Lotto salvato');
    ctx.refresh();
  }
}

/* ------------------------------------------------------- S-14 ordini */
export function viewOrdini(root, ctx) {
  const list = [...S.store.ordini].reverse();
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Dati / Ordini e impegni</p>
      <h1>Ordini e impegni</h1>
      <p class="sub">${U.fmtQty(list.length)} impegni · ${U.fmtQty(list.filter((o) => !o.spedito).length)} non spediti ·
        nessun campo cliente nello schema</p>
    </div>
    <div class="spacer"></div>
    <div class="row">
      <button class="btn btn-secondary btn-sm" type="button" id="importBtn">Importa CSV</button>
      <button class="btn btn-primary" type="button" id="newBtn">+ Nuovo impegno</button>
    </div></div>

    <div class="banner banner-info"><span aria-hidden="true">i</span>
      <span>L'impegno punta a un lotto (<code>id_magazzino</code>): solo così la quantità entra nella colonna di un produttore.
      Senza lotto finisce in <b>Non attribuito</b>.</span></div>

    <div class="report">${U.buildTable({
      caption: 'Il flag Spedito è un booleano: alimenta «Di cui spedito» nei riepiloghi.',
      cols: [{ label: 'Lotto collegato' }, { label: 'Tipologia' }, { label: 'Produzione' }, { label: 'Varietà' },
             { label: 'Clone' }, { label: 'Portainnesto' }, { label: 'Quantità', align: 'r' }, { label: 'Spedito' }],
      rows: list.length ? list.map((o) => {
        const lot = o.id_magazzino ? S.store.index.lotById.get(o.id_magazzino) : null;
        return {
          type: 'row',
          cells: [
            { html: lot ? `<span class="ident">${U.esc(lot.produttore || '—')}<small>${U.esc(lot.anno)} · ${U.esc(lot.varieta)}</small></span>` : '<span style="color:var(--ink-300)">—</span>', label: 'Lotto collegato' },
            { html: U.esc(o.tipologia), label: 'Tipologia' },
            { html: U.esc(o.produzione), label: 'Produzione' },
            { html: `<span class="ident">${U.esc(o.varieta)}</span>`, label: 'Varietà' },
            { html: `<span class="ident">${U.esc(o.clone)}</span>`, label: 'Clone' },
            { html: `<span class="ident">${U.esc(o.portainnesto)}</span>`, label: 'Portainnesto' },
            U.metric('Quantità', U.fmtQty(o.quantita)),
            { html: `<button class="btn btn-sm ${o.spedito ? 'btn-primary' : 'btn-secondary'}" type="button" data-toggle="${U.esc(o.id)}" aria-pressed="${o.spedito}">${o.spedito ? '✓ Spedito' : 'Segna spedito'}</button>`, label: 'Spedito' },
          ],
        };
      }) : [{ type: 'empty', cells: [{ html: 'Nessun impegno registrato.' }] }],
    })}</div>`;

  root.querySelectorAll('[data-toggle]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = S.toggleSpedito(b.dataset.toggle);
      if (!res) return;
      ctx.refresh();
      U.toast(res.ordine.spedito ? 'Impegno segnato come spedito' : 'Spedizione annullata', {
        action: { label: 'Annulla', run: () => { S.toggleSpedito(res.ordine.id, res.prev); ctx.refresh(); } },
      });
    });
  });
  root.querySelector('#newBtn').addEventListener('click', () => openOrdineForm(ctx));
  root.querySelector('#importBtn').addEventListener('click', () => ctx.navigate('#/dati/import'));
}

function openOrdineForm(ctx) {
  const lotItems = S.store.lotti.map((l) => ({
    value: l.id,
    label: `${l.produttore || 'Non attribuito'} · ${l.anno} · ${l.varieta} · ${l.clone}`,
    sub: `${l.portainnesto} · ${U.fmtQty(l.quantita)} piante`,
  }));
  const body = `
    <form id="ordForm" novalidate>
      <label class="field"><span>Lotto collegato (facoltativo)</span><div data-lot></div></label>
      ${selectHTML('tipologia', 'Tipologia', S.store.meta.tipologie)}
      ${selectHTML('produzione', 'Produzione', S.store.meta.produzioni)}
      <label class="field"><span>Codice varietà</span><div data-variety></div></label>
      <input type="hidden" name="varieta">
      ${selectHTML('clone', 'Codice clone', [], '', ' disabled')}
      <p class="field-error" data-clone-hint></p>
      ${selectHTML('portainnesto', 'Codice portainnesto', S.store.index.rootstocks)}
      <label class="field"><span>Quantità ordinata</span>
        <input type="number" name="quantita" min="1" step="1" inputmode="numeric" required></label>
      <label class="field" style="display:flex;gap:10px;align-items:center">
        <input type="checkbox" name="spedito" style="width:20px;height:20px;min-height:0">
        <span style="margin:0">Già spedito</span></label>
      <label class="field"><span>Note</span><textarea name="note" maxlength="500"></textarea></label>
      <div id="impact"></div>
      <p class="field-error" id="formErr" hidden></p>
    </form>`;

  let submitFn = null;
  U.openSheet({
    title: 'Nuovo impegno',
    body,
    actions: [
      { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
      { label: 'Salva', class: 'btn-primary', run: () => { if (submitFn) submitFn(); } },
    ],
    onMount: (sheet) => {
      const vc = wireVarietyClone(sheet);
      const form = sheet.querySelector('#ordForm');
      let chosenLot = null;
      U.combobox(sheet.querySelector('[data-lot]'), {
        items: lotItems, placeholder: 'Cerca lotto (produttore, varietà, clone)…',
        onPick: (id, item) => {
          const lot = S.store.index.lotById.get(id);
          if (!lot) return;
          chosenLot = lot;
          form.elements.tipologia.value = lot.tipologia || '';
          form.elements.produzione.value = lot.produzione || '';
          form.elements.portainnesto.value = lot.portainnesto || '';
          if (vc && vc.setVarieta) vc.setVarieta(lot.varieta, lot.clone);
          if (item) U.toast('Dimensioni compilate dal lotto');
        },
      });
      form.addEventListener('change', updateImpact);
      form.addEventListener('input', U.debounce(updateImpact, 300));
      function updateImpact() {
        if (!form || !form.isConnected) return;   // sheet already closed
        const data = Object.fromEntries(new FormData(form).entries());
        const box = form.querySelector('#impact');
        if (!data.varieta || !data.clone || !data.quantita) { box.innerHTML = ''; return; }
        const { before, after } = S.availabilityImpact(data);
        box.innerHTML = after < 0
          ? `<div class="banner banner-warn"><span aria-hidden="true">⚠</span><span>Disponibilità andrà sotto zero: da ${U.fmtSigned(before)} a <b>${U.fmtSigned(after)}</b>. Verrà segnalata in Indisponibilità.</span></div>`
          : '';
      }
      function submit() {
        if (!form || !form.isConnected) return;
        const data = Object.fromEntries(new FormData(form).entries());
        const errs = S.validateOrdine(data);
        const keys = Object.keys(errs);
        const errBox = form.querySelector('#formErr');
        if (keys.length) {
          errBox.hidden = false;
          errBox.textContent = keys.map((k) => errs[k]).join(' ');
          const first = form.querySelector(`[name="${keys[0]}"]`);
          if (first) { first.setAttribute('aria-invalid', 'true'); first.focus(); }
          return;
        }
        S.addOrdine({ ...data, id_magazzino: chosenLot ? chosenLot.id : null });
        U.closeSheet();
        U.toast('Impegno salvato');
        ctx.refresh();
      }
      submitFn = submit;
    },
  });
}

/* ------------------------------------------------------- S-15 import */
export function viewImport(root, ctx) {
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Dati / Import</p>
      <h1>Import CSV</h1>
      <p class="sub">Nessuna riga viene scritta prima della validazione. Errori per riga, colonna, valore e motivo.</p>
    </div></div>

    <div class="card card-pad mb">
      <div class="filters" style="margin:0">
        <label class="field" style="margin:0"><span>Destinazione</span>
          <select id="target">
            <option value="lotti">Lotti magazzino</option>
            <option value="ordini">Ordini e impegni</option>
          </select></label>
        <label class="field" style="margin:0"><span>File CSV (separatore ; o ,)</span>
          <input type="file" id="file" accept=".csv,text/csv"></label>
      </div>
      <p class="hint">Lotti: <code>anno;produttore;tipologia;produzione;varieta;clone;portainnesto;quantita;note</code><br>
        Ordini: <code>tipologia;produzione;varieta;clone;portainnesto;quantita;spedito;note</code>
        (<code>spedito</code> = sì/no, true/false, 1/0)</p>
    </div>
    <div id="importOut"></div>`;

  const target = root.querySelector('#target');
  const file = root.querySelector('#file');
  const out = root.querySelector('#importOut');

  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const text = await f.text();
    const { headers, rows } = parseCSV(text);
    const kind = target.value;
    const { valid, errors } = validateRows(rows, headers, kind);
    render(kind, { fileName: f.name, headers, rows, valid, errors });
  });

  function render(kind, r) {
    const total = r.rows.length;
    out.innerHTML = `
      <div class="card card-pad mb">
        <div class="row-between">
          <div><b>${U.esc(r.fileName)}</b>
            <p class="caption">${U.fmtQty(total)} righe · ${U.fmtQty(r.valid.length)} valide · ${U.fmtQty(r.errors.length)} con errori</p></div>
          <div class="row">
            <button class="btn btn-secondary btn-sm" type="button" id="errCsv"${r.errors.length ? '' : ' disabled'}>Scarica errori CSV</button>
            <button class="btn btn-primary btn-sm" type="button" id="apply"${r.errors.length || !r.valid.length ? ' disabled' : ''}>Importa ${U.fmtQty(r.valid.length)} righe</button>
          </div>
        </div>
      </div>
      ${r.errors.length ? `<div class="report mb">${U.buildTable({
        caption: 'Correggi il file e ricaricalo: gli errori bloccano l\'importazione.',
        cols: [{ label: 'Riga' }, { label: 'Colonna' }, { label: 'Valore' }, { label: 'Motivo' }],
        rows: r.errors.map((e) => ({
          type: 'row', cls: 'row negative',
          cells: [
            { html: String(e.riga), label: 'Riga' },
            { html: `<span class="ident">${U.esc(e.colonna)}</span>`, label: 'Colonna' },
            { html: `<span class="ident">${U.esc(e.valore)}</span>`, label: 'Valore' },
            { html: U.esc(e.motivo), label: 'Motivo' },
          ],
        })),
      })}</div>` : `<div class="banner banner-ok"><span aria-hidden="true">✓</span><span>Tutte le righe sono valide.</span></div>`}`;

    const apply = out.querySelector('#apply');
    if (apply) apply.addEventListener('click', () => {
      r.valid.forEach((row) => {
        if (kind === 'lotti') S.addLotto(row);
        else S.addOrdine(row);
      });
      U.toast(`Importate ${r.valid.length} righe`);
      ctx.navigate(kind === 'lotti' ? '#/dati/lotti' : '#/dati/ordini');
    });
    const errCsv = out.querySelector('#errCsv');
    if (errCsv) errCsv.addEventListener('click', () => {
      U.exportCSV(`errori_import_${U.nowStamp()}.csv`, ['Riga', 'Colonna', 'Valore', 'Motivo'],
        r.errors.map((e) => [e.riga, e.colonna, e.valore, e.motivo]));
    });
  }
}

function parseCSV(text) {
  const clean = text.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').trim();
  const lines = clean.split('\n').filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = (line) => {
    const out = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === sep) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map((l) => split(l));
  return { headers, rows };
}

function validateRows(rows, headers, kind) {
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  const pick = (row, name) => {
    const i = idx[name];
    return i == null ? '' : (row[i] || '').trim();
  };
  const valid = [];
  const errors = [];
  rows.forEach((row, n) => {
    const riga = n + 2;
    const varieta = pick(row, 'varieta');
    const clone = pick(row, 'clone');
    const portainnesto = pick(row, 'portainnesto');
    const quantita = pick(row, 'quantita');
    const rec = kind === 'lotti'
      ? {
          anno: pick(row, 'anno'), produttore: pick(row, 'produttore'),
          tipologia: pick(row, 'tipologia'), produzione: pick(row, 'produzione'),
          varieta, clone, portainnesto, quantita, note: pick(row, 'note') || null,
        }
      : {
          tipologia: pick(row, 'tipologia'), produzione: pick(row, 'produzione'),
          varieta, clone, portainnesto, quantita, note: pick(row, 'note') || null,
          spedito: /^(s[iì]|si|true|1|x|spedito)$/i.test(pick(row, 'spedito') || ''),
          id_magazzino: null,
        };
    const errs = kind === 'lotti' ? S.validateLotto(rec) : S.validateOrdine(rec);
    const local = [];
    for (const [col, motivo] of Object.entries(errs)) {
      local.push({ riga, colonna: col, valore: rec[col] || '(vuoto)', motivo });
    }
    if (local.length) errors.push(...local);
    else valid.push(rec);
  });
  return { valid, errors };
}

/* -------------------------------------------------- S-16 anagrafica vite */
export function viewViti(root, ctx) {
  const q = state.search.toLowerCase();
  const filtered = S.store.viti.filter((v) => !q ||
    v.varieta.toLowerCase().includes(q) || v.clone.toLowerCase().includes(q));
  const groups = new Map();
  for (const v of filtered) {
    if (!groups.has(v.varieta)) groups.set(v.varieta, []);
    groups.get(v.varieta).push(v.clone);
  }
  const varieties = [...groups.entries()].sort((a, b) => S.collator().compare(a[0], b[0]));
  const sliced = varieties.slice(0, state.vitiLimit);
  const rows = [];
  for (const [varieta, clones] of sliced) {
    rows.push({ type: 'group', cells: [{ html: `▦ ${U.esc(varieta)}`, sub: `${clones.length} cloni` }] });
    for (const clone of clones.slice(0, 12)) {
      rows.push({
        type: 'row',
        cells: [
          { html: `<span class="ident">${U.esc(clone)}</span>`, cls: 'ident', label: 'Codice clone' },
          { html: `<span class="ident">${U.esc(varieta)}</span>`, label: 'Codice varietà' },
          U.metric('Utilizzi', U.fmtQty(S.usageOfPair(varieta, clone))),
          { html: '<span class="badge badge-ok">attiva</span>', label: 'Stato' },
        ],
      });
    }
    if (clones.length > 12) {
      rows.push({ type: 'row', cells: [{ html: `<span class="caption">+${clones.length - 12} altri cloni</span>`, span: 4 }] });
    }
  }

  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Anagrafiche / Vite</p>
      <h1>Anagrafica vite</h1>
      <p class="sub">${U.fmtQty(S.store.viti.length)} coppie varietà/clone · una riga per coppia (nessun campo descrizione)</p>
    </div>
    <div class="spacer"></div>
    <div class="row">${P.can(ctx.role, 'anag.viti') ? '<button class="btn btn-primary" type="button" id="newBtn">+ Varietà / clone</button>' : ''}</div></div>

    <div class="card card-pad mb">
      <label class="field" style="margin:0"><span>Cerca varietà o clone</span>
        <input type="search" id="q" value="${U.esc(state.search)}" placeholder="es. CHARDONNAY"></label>
    </div>

    <div class="report">${U.buildTable({
      caption: 'Raggruppato per varietà: il clone appartiene sempre a una varietà (F-V2).',
      cols: [{ label: 'Codice clone' }, { label: 'Codice varietà' }, { label: 'Utilizzi', align: 'r' }, { label: 'Stato' }],
      rows: rows.length ? rows : [{ type: 'empty', cells: [{ html: 'Nessuna coppia trovata.' }] }],
    })}</div>
    ${varieties.length > sliced.length ? `<div class="mt"><button class="btn btn-secondary btn-block" type="button" id="more">Mostra altre varietà</button></div>` : ''}`;

  root.querySelector('#q').addEventListener('input', U.debounce((e) => {
    state.search = e.target.value; state.vitiLimit = 60; ctx.refresh();
  }, 250));
  const more = root.querySelector('#more');
  if (more) more.addEventListener('click', () => { state.vitiLimit += 60; ctx.refresh(); });
  const newBtn = root.querySelector('#newBtn');
  if (newBtn) newBtn.addEventListener('click', () => {
    U.openSheet({
      title: 'Nuova varietà / clone',
      body: `<form id="vitiForm">
          <label class="field"><span>Codice varietà</span><div data-variety></div></label>
          <label class="field"><span>Codice clone</span><input type="text" name="clone" required placeholder="es. CL-1"></label>
          <p class="field-error" id="vitiErr" hidden></p>
        </form>`,
      actions: [
        { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
        { label: 'Salva', class: 'btn-primary', run: save },
      ],
      onMount: (sheet) => {
        let varieta = '';
        const combo = U.combobox(sheet.querySelector('[data-variety]'), {
          items: S.store.index.varieta.map((v) => ({ value: v, label: v })),
          placeholder: 'Cerca o scrivi una nuova varietà…',
          onPick: (v) => { varieta = v; },
        });
        sheet.querySelector('[data-variety] input').addEventListener('input', (e) => {
          varieta = e.target.value;   // free text allowed: a variety exists through its pairs
        });
        function save() {
          const clone = sheet.querySelector('[name="clone"]').value;
          const res = S.addVitiPair(varieta || sheet.querySelector('[data-variety] input').value, clone);
          const err = sheet.querySelector('#vitiErr');
          if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
          U.closeSheet();
          U.toast('Coppia salvata');
          ctx.refresh();
        }
      },
    });
  });
}

/* ---------------------------------------------- S-17 anagrafica portainnesti */
export function viewPortainnesti(root, ctx) {
  const q = state.search.toLowerCase();
  const list = S.store.index.rootstocks.filter((c) => !q || c.toLowerCase().includes(q));
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Anagrafiche / Portainnesti</p>
      <h1>Anagrafica portainnesto</h1>
      <p class="sub">${U.fmtQty(S.store.portainnesti.length)} codici · solo codice, nessuna descrizione nello schema</p>
    </div>
    <div class="spacer"></div>
    <div class="row">${P.can(ctx.role, 'anag.portainnesti') ? '<button class="btn btn-primary" type="button" id="newBtn">+ Portainnesto</button>' : ''}</div></div>

    <div class="card card-pad mb">
      <label class="field" style="margin:0"><span>Cerca codice</span>
        <input type="search" id="q" value="${U.esc(state.search)}" placeholder="es. 1103"></label>
    </div>

    <div class="report">${U.buildTable({
      caption: 'Il codice portainnesto è la chiave di raggruppamento dei tre riepiloghi.',
      cols: [{ label: 'Codice portainnesto' }, { label: 'Utilizzi', align: 'r' }, { label: 'Stato' }],
      rows: list.length ? list.map((c) => ({
        type: 'row',
        cells: [
          { html: `<span class="ident">${U.esc(c)}</span>`, cls: 'ident' },
          U.metric('Utilizzi', U.fmtQty(S.usageOfRootstock(c))),
          { html: '<span class="badge badge-ok">attivo</span>', label: 'Stato' },
        ],
      })) : [{ type: 'empty', cells: [{ html: 'Nessun portainnesto trovato.' }] }],
    })}</div>`;

  root.querySelector('#q').addEventListener('input', U.debounce((e) => {
    state.search = e.target.value; ctx.refresh();
  }, 250));
  const newBtn = root.querySelector('#newBtn');
  if (newBtn) newBtn.addEventListener('click', () => {
    U.openSheet({
      title: 'Nuovo portainnesto',
      body: `<form id="rootForm">
          <label class="field"><span>Codice portainnesto</span><input type="text" name="code" required placeholder="es. 1103 PAULSEN"></label>
          <p class="field-error" id="rootErr" hidden></p>
        </form>`,
      actions: [
        { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
        { label: 'Salva', class: 'btn-primary', run: () => {
          const sheet = document.querySelector('.sheet');
          const res = S.addPortainnesto(sheet.querySelector('[name="code"]').value);
          const err = sheet.querySelector('#rootErr');
          if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
          U.closeSheet(); U.toast('Portainnesto salvato'); ctx.refresh();
        } },
      ],
    });
  });
}
