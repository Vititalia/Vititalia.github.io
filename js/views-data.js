/* Vignero · views-data.js — data entry (PC only), import, master data with CRUD */
import * as S from './store.js';
import * as U from './ui.js';
import * as P from './permissions.js';

const PAGE = 40;
/* one search term per list: a filter typed on one page must not leak into another */
const state = { lottiLimit: PAGE, vitiLimit: 60, lottiSearch: '', ordiniSearch: '', vitiSearch: '', vitiVarieta: '', rootsSearch: '', produttore: '' };

/* ------------------------------------------------------------- form bits */
function selectHTML(name, label, options, value, extra = '') {
  return `<label class="field"><span>${U.esc(label)}</span>
      <select name="${name}"${extra}>
        <option value="">— seleziona —</option>
        ${options.map((o) => `<option value="${U.esc(o)}"${String(o) === String(value) ? ' selected' : ''}>${U.esc(o)}</option>`).join('')}
      </select></label>`;
}

function yearRange(current) {
  const y = new Date().getFullYear();
  const out = [];
  for (let i = y + 1; i >= y - 8; i--) out.push(String(i));
  if (current && !out.includes(String(current))) out.unshift(String(current));
  return out;
}

const cloneOptions = (varieta) => (varieta ? S.clonesOf(varieta) : []);

/** Dependent variety → clone pair (F-V2), shared by both forms. */
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
      if (hidden) hidden.value = value;
      paintClones(value, '');
    },
  });
  paintClones(varieta, preset.clone);
  return {
    get varieta() { return varieta; },
    setVarieta(v, clone) {
      varieta = v;
      if (hidden) hidden.value = v;
      const box = scope.querySelector('[data-variety] input');
      if (box) box.value = v;
      paintClones(v, clone || '');
    },
  };
}

/**
 * Re-renders the list and puts the caret back where it was: the debounced
 * search refreshes the view (new DOM), which used to drop the focus and make the
 * cursor disappear while typing.
 */
function refreshKeepingCaret(ctx, inputId = 'q') {
  const el = document.getElementById(inputId);
  const caret = el && typeof el.selectionStart === 'number' ? el.selectionStart : null;
  ctx.refresh();
  const fresh = document.getElementById(inputId);
  if (!fresh) return;
  fresh.focus();
  const pos = caret == null ? fresh.value.length : Math.min(caret, fresh.value.length);
  try { fresh.setSelectionRange(pos, pos); } catch { /* type not selectable */ }
}

const actions = (id) => (S.canWrite() ? `<div class="row" style="gap:6px">
    <button class="btn btn-secondary btn-sm" type="button" data-edit="${U.esc(id)}">Modifica</button>
    <button class="btn btn-danger btn-sm" type="button" data-del="${U.esc(id)}">Elimina</button>
  </div>` : '');

/* --------------------------------------------------------- S-13 lotti */
export function viewLotti(root, ctx) {
  const q = state.lottiSearch.toLowerCase();
  const C = S.collator();
  const list = S.store.lotti
    .filter((l) => !state.produttore || l.produttore === state.produttore)
    .filter((l) => !q || [l.produttore, l.varieta, l.clone, l.portainnesto, l.tipologia, l.note]
      .some((x) => (x || '').toLowerCase().includes(q)))
    .slice()
    // varietà → clone → portainnesto → produttore (the office reads the list by clone)
    .sort((a, b) =>
      C.compare(a.varieta, b.varieta) ||
      C.compare(a.clone, b.clone) ||
      C.compare(a.portainnesto, b.portainnesto) ||
      C.compare(a.produttore || '', b.produttore || '') ||
      C.compare(String(b.anno), String(a.anno)));
  const shown = list.slice(0, state.lottiLimit);

  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Dati / Lotti magazzino</p>
      <h1>Lotti magazzino</h1>
      <p class="sub">${U.fmtQty(list.length)} lotti · inserimento, modifica ed eliminazione da PC</p>
    </div>
    <div class="spacer"></div>
    <div class="row">
      <button class="btn btn-secondary btn-sm" type="button" id="exportBtn">Esporta CSV</button>
      <button class="btn btn-secondary btn-sm" type="button" id="importBtn">Importa CSV</button>
      ${S.canWrite() ? '<button class="btn btn-primary" type="button" id="newBtn">+ Nuovo lotto</button>' : ''}
    </div></div>

    <div class="card card-pad mb">
      <div class="filters" style="margin:0">
        <label class="field" style="margin:0"><span>Cerca</span>
          <input type="search" id="q" value="${U.esc(state.lottiSearch)}" placeholder="produttore, varietà, clone…"></label>
        <label class="field" style="margin:0"><span>Produttore</span>
          <select id="prod">
            <option value="">Tutti</option>
            ${S.store.meta.produttori.map((p) => `<option value="${U.esc(p)}"${state.produttore === p ? ' selected' : ''}>${U.esc(p)}</option>`).join('')}
          </select></label>
      </div>
    </div>

    <div class="report">${U.buildTable({
      scroll: true, wrapperClass: 'no-max',
      caption: 'Anagrafica validata: varietà → clone → portainnesto. Quantità intere.',
      cols: [{ label: 'Anno' }, { label: 'Produttore' }, { label: 'Tipologia' }, { label: 'Produzione' },
             { label: 'Varietà' }, { label: 'Clone' }, { label: 'Portainnesto' }, { label: 'Quantità', align: 'r' },
             { label: 'Note' }, { label: 'Azioni' }],
      rows: shown.length ? shown.map((l) => ({
        type: 'row',
        cells: [
          { html: U.esc(l.anno), label: 'Anno' },
          { html: U.esc(l.produttore || '—'), label: 'Produttore' },
          { html: U.esc(l.tipologia || S.NON_INDICATA), label: 'Tipologia' },
          { html: U.esc(l.produzione || S.NON_INDICATA), label: 'Produzione' },
          { html: `<span class="ident">${U.esc(l.varieta)}</span>`, label: 'Varietà' },
          { html: `<span class="ident">${U.esc(l.clone)}</span>`, label: 'Clone', cls: 'cell-sub' },
          { html: `<span class="ident">${U.esc(l.portainnesto)}</span>`, label: 'Portainnesto' },
          U.metric('Quantità', U.fmtQty(l.quantita)),
          { html: l.note ? U.esc(l.note) : '<span style="color:var(--ink-300)">—</span>',
            label: 'Note', cls: 'note-cell' },
          { html: actions(l.id), label: 'Azioni', cls: 'no-print' },
        ],
      })) : [{ type: 'empty', cells: [{ html: 'Nessun lotto con questi criteri.' }] }],
    })}</div>
    ${list.length > shown.length ? `<div class="mt"><button class="btn btn-secondary btn-block" type="button" id="more">Mostra altri ${Math.min(PAGE, list.length - shown.length)} lotti</button></div>` : ''}`;

  root.querySelector('#q').addEventListener('input', U.debounce((e) => {
    state.lottiSearch = e.target.value; state.lottiLimit = PAGE; refreshKeepingCaret(ctx);
  }, 250));
  root.querySelector('#prod').addEventListener('change', (e) => {
    state.produttore = e.target.value; state.lottiLimit = PAGE; ctx.refresh();
  });
  const more = root.querySelector('#more');
  if (more) more.addEventListener('click', () => { state.lottiLimit += PAGE; ctx.refresh(); });
  root.querySelector('#exportBtn').addEventListener('click', () => {
    // the whole filtered list, not just the page on screen; the headers match the
    // import schema (plus `id`) so the file can be re-imported as it is
    U.exportCSV(`lotti_magazzino_${U.nowStamp()}.csv`,
      ['id', 'anno', 'produttore', 'tipologia', 'produzione', 'varieta', 'clone',
       'portainnesto', 'quantita', 'note'],
      list.map((l) => [l.id, l.anno, l.produttore || '', l.tipologia || '', l.produzione || '',
                       l.varieta, l.clone, l.portainnesto, l.quantita, l.note || '']));
  });
  root.querySelector('#importBtn').addEventListener('click', () => ctx.navigate('#/dati/import'));
  const newLot = root.querySelector('#newBtn');
  if (newLot) newLot.addEventListener('click', () => openLottoForm(ctx));

  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', () => {
      const lot = S.store.lotti.find((x) => x.id === b.dataset.edit);
      if (lot) openLottoForm(ctx, lot);
    });
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      const lot = S.store.lotti.find((x) => x.id === b.dataset.del);
      if (!lot) return;
      U.confirmSheet({
        title: 'Eliminare il lotto?',
        message: `${lot.anno} · ${lot.produttore || '—'} · ${lot.varieta} · ${lot.clone} · ${U.fmtQty(lot.quantita)}. L'operazione non è reversibile.`,
        confirmLabel: 'Elimina', danger: true,
        onConfirm: async () => {
          const res = await S.removeLotto(lot.id);
          if (!res.ok) { U.toast(res.error, { tone: 'error' }); return; }
          U.toast('Lotto eliminato');
          ctx.refresh();
        },
      });
    });
  });
}

function openLottoForm(ctx, existing) {
  const isEdit = !!existing;
  let submitFn = null;
  U.openSheet({
    title: isEdit ? 'Modifica lotto' : 'Nuovo lotto',
    body: `
      <form id="lotForm" novalidate>
        ${selectHTML('anno', 'Anno di conferimento', yearRange(existing && existing.anno), existing ? existing.anno : new Date().getFullYear())}
        ${selectHTML('produttore', 'Produttore', S.store.meta.produttori, existing && existing.produttore)}
        ${selectHTML('tipologia', 'Tipologia', S.store.meta.tipologie, existing && existing.tipologia)}
        ${selectHTML('produzione', 'Produzione', S.store.meta.produzioni, existing && existing.produzione)}
        <label class="field"><span>Codice varietà</span><div data-variety></div></label>
        <input type="hidden" name="varieta">
        ${selectHTML('clone', 'Codice clone', [], '', ' disabled')}
        <p class="field-error" data-clone-hint></p>
        ${selectHTML('portainnesto', 'Codice portainnesto', S.store.index.rootstocks, existing && existing.portainnesto)}
        <label class="field"><span>Quantità (interi, no decimali)</span>
          <input type="number" name="quantita" min="0" step="1" inputmode="numeric" required
                 value="${existing ? existing.quantita : ''}"></label>
        <label class="field"><span>Note</span><textarea name="note" maxlength="500">${existing && existing.note ? U.esc(existing.note) : ''}</textarea></label>
        <p class="field-error" id="formErr" hidden></p>
      </form>`,
    actions: [
      { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
      { label: isEdit ? 'Salva modifiche' : 'Salva', class: 'btn-primary', run: () => { if (submitFn) submitFn(); } },
    ],
    onMount: (sheet) => {
      wireVarietyClone(sheet, { varieta: existing && existing.varieta, clone: existing && existing.clone });
      async function submit() {
        const form = sheet.querySelector('#lotForm');
        if (!form || !form.isConnected) return;
        const data = Object.fromEntries(new FormData(form).entries());
        const errs = S.validateLotto(data);
        const keys = Object.keys(errs);
        const box = sheet.querySelector('#formErr');
        if (keys.length) {
          box.hidden = false;
          box.textContent = keys.map((k) => errs[k]).join(' ');
          const first = form.querySelector(`[name="${keys[0]}"]`);
          if (first) { first.setAttribute('aria-invalid', 'true'); first.focus(); }
          return;
        }
        const btn = sheet.querySelector('.sheet-actions [data-act="1"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Salvataggio…'; }
        let res;
        try { res = await S.saveLotto(data, isEdit ? existing.id : null); }
        catch (e) { res = { ok: false, error: 'Errore di rete: ' + (e.message || e) }; }
        if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Salva modifiche' : 'Salva'; }
        if (!res.ok) { box.hidden = false; box.textContent = res.error; return; }
        U.closeSheet();
        U.toast(isEdit ? 'Lotto aggiornato' : 'Lotto salvato');
        ctx.refresh();
      }
      submitFn = submit;
    },
  });
}

/* ------------------------------------------------------- S-14 ordini */
export function viewOrdini(root, ctx) {
  const C = S.collator();
  const lotOf = (o) => (o.id_magazzino ? S.store.index.lotById.get(o.id_magazzino) : null);
  const q = state.ordiniSearch.trim().toLowerCase();
  const list = [...S.store.ordini]
    .filter((o) => !q || [
      o.varieta, o.clone, o.portainnesto, o.tipologia, o.produzione, o.note,
      (lotOf(o) || {}).produttore, (lotOf(o) || {}).anno,
    ].some((x) => String(x == null ? '' : x).toLowerCase().includes(q)))
    .sort((a, b) =>
      C.compare(a.varieta, b.varieta) ||
      C.compare(a.clone, b.clone) ||
      C.compare(a.portainnesto, b.portainnesto) ||
      C.compare((lotOf(a) || {}).produttore || '', (lotOf(b) || {}).produttore || ''));
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Dati / Ordini e impegni</p>
      <h1>Ordini e impegni</h1>
      <p class="sub">${U.fmtQty(list.length)} impegni · ${U.fmtQty(list.filter((o) => !o.spedito).length)} non spediti ·
        inserimento, modifica ed eliminazione da PC</p>
    </div>
    <div class="spacer"></div>
    <div class="row">
      <button class="btn btn-secondary btn-sm" type="button" id="exportBtn">Esporta CSV</button>
      <button class="btn btn-secondary btn-sm" type="button" id="importBtn">Importa CSV</button>
      ${S.canWrite() ? '<button class="btn btn-primary" type="button" id="newBtn">+ Nuovo impegno</button>' : ''}
    </div></div>

    <div class="banner banner-info"><span aria-hidden="true">i</span>
      <span>Il lotto collegato (<code>id_magazzino</code>) è <b>facoltativo</b>: se lo scegli, la quantità entra
      nella colonna del produttore nel riepilogo per produttore; senza lotto l'impegno resta fuori da quelle colonne.</span></div>

    <div class="card card-pad mb">
      <div class="filters" style="margin:0">
        <label class="field" style="margin:0"><span>Cerca</span>
          <input type="search" id="q" value="${U.esc(state.ordiniSearch)}"
                 placeholder="produttore, varietà, clone, note…"></label>
      </div>
    </div>

    <div class="report">${U.buildTable({
      scroll: true, wrapperClass: 'no-max',
      caption: 'Il flag Spedito è un booleano: alimenta «Di cui spedito» nei riepiloghi. Le note sono quelle inserite con l\'impegno.',
      cols: [{ label: 'Lotto collegato' }, { label: 'Tipologia' }, { label: 'Produzione' }, { label: 'Varietà' },
             { label: 'Clone' }, { label: 'Portainnesto' }, { label: 'Quantità', align: 'r' },
             { label: 'Note' }, { label: 'Spedito' }, { label: 'Azioni' }],
      rows: list.length ? list.map((o) => {
        const lot = o.id_magazzino ? S.store.index.lotById.get(o.id_magazzino) : null;
        return {
          type: 'row',
          cells: [
            { html: lot ? `<span class="ident">${U.esc(lot.produttore || '—')}<small>${U.esc(lot.anno)} · ${U.esc(lot.varieta)}</small></span>` : '<span style="color:var(--ink-300)">—</span>', label: 'Lotto collegato', cls: 'ident' },
            { html: U.esc(o.tipologia), label: 'Tipologia' },
            { html: U.esc(o.produzione), label: 'Produzione' },
            { html: `<span class="ident">${U.esc(o.varieta)}</span>`, label: 'Varietà' },
            { html: `<span class="ident">${U.esc(o.clone)}</span>`, label: 'Clone' },
            { html: `<span class="ident">${U.esc(o.portainnesto)}</span>`, label: 'Portainnesto', cls: 'cell-sub' },
            U.metric('Quantità', U.fmtQty(o.quantita)),
            { html: o.note ? U.esc(o.note) : '<span style="color:var(--ink-300)">—</span>',
              label: 'Note', cls: 'note-cell' },
            { html: `<button class="btn btn-sm ${o.spedito ? 'btn-primary' : 'btn-secondary'}" type="button" data-toggle="${U.esc(o.id)}" aria-pressed="${o.spedito}">${o.spedito ? '✓ Spedito' : 'Segna spedito'}</button>`, label: 'Spedito' },
            { html: actions(o.id), label: 'Azioni', cls: 'no-print' },
          ],
        };
      }) : [{ type: 'empty', cells: [{ html: 'Nessun impegno registrato.' }] }],
    })}</div>`;

  root.querySelectorAll('[data-toggle]').forEach((b) => {
    b.addEventListener('click', async () => {
      const id = b.dataset.toggle;
      const ord = S.store.ordini.find((o) => o.id === id);
      if (!ord) return;
      const previous = !!ord.spedito;
      b.disabled = true;
      const res = await S.setSpedito(id, !previous);
      b.disabled = false;
      if (!res.ok) { U.toast(res.error, { tone: 'error' }); return; }
      ctx.refresh();
      U.toast(!previous ? 'Impegno segnato come spedito' : 'Spedizione annullata', {
        action: { label: 'Annulla', run: async () => { await S.setSpedito(id, previous); ctx.refresh(); } },
      });
    });
  });
  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', () => {
      const ord = S.store.ordini.find((x) => x.id === b.dataset.edit);
      if (ord) openOrdineForm(ctx, ord);
    });
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      const ord = S.store.ordini.find((x) => x.id === b.dataset.del);
      if (!ord) return;
      U.confirmSheet({
        title: 'Eliminare l\'impegno?',
        message: `${ord.varieta} · ${ord.clone} · ${ord.portainnesto} · ${U.fmtQty(ord.quantita)}. L'operazione non è reversibile.`,
        confirmLabel: 'Elimina', danger: true,
        onConfirm: async () => {
          const res = await S.removeOrdine(ord.id);
          if (!res.ok) { U.toast(res.error, { tone: 'error' }); return; }
          U.toast('Impegno eliminato');
          ctx.refresh();
        },
      });
    });
  });
  root.querySelector('#q').addEventListener('input', U.debounce((e) => {
    state.ordiniSearch = e.target.value;
    refreshKeepingCaret(ctx);
  }, 250));

  root.querySelector('#exportBtn').addEventListener('click', () => {
    // same headers as the import schema (plus `id`), notes included
    U.exportCSV(`ordini_impegni_${U.nowStamp()}.csv`,
      ['id', 'tipologia', 'produzione', 'varieta', 'clone', 'portainnesto', 'quantita',
       'spedito', 'note', 'id_magazzino'],
      list.map((o) => [o.id, o.tipologia || '', o.produzione || '', o.varieta, o.clone,
                       o.portainnesto, o.quantita, o.spedito ? 'Sì' : 'No',
                       o.note || '', o.id_magazzino || '']));
  });
  const newOrd = root.querySelector('#newBtn');
  if (newOrd) newOrd.addEventListener('click', () => openOrdineForm(ctx));
  root.querySelector('#importBtn').addEventListener('click', () => ctx.navigate('#/dati/import'));
}

function openOrdineForm(ctx, existing) {
  const isEdit = !!existing;
  const lotItems = [
    { value: '', label: '— Nessun lotto —', sub: 'salva l\'impegno senza collegarlo a un lotto', always: true },
    ...S.store.lotti.map((l) => ({
      value: l.id,
      label: `${l.produttore || 'Non attribuito'} · ${l.anno} · ${l.varieta} · ${l.clone}`,
      sub: `${l.portainnesto} · ${U.fmtQty(l.quantita)} piante`,
    })),
  ];
  const existingLot = existing && existing.id_magazzino
    ? S.store.index.lotById.get(existing.id_magazzino) : null;
  let submitFn = null;

  U.openSheet({
    title: isEdit ? 'Modifica impegno' : 'Nuovo impegno',
    body: `
      <form id="ordForm" novalidate>
        <label class="field"><span>Lotto collegato</span><div data-lot></div></label>
        <input type="hidden" name="id_magazzino" value="${existing && existing.id_magazzino ? existing.id_magazzino : ''}">
        <div class="row lot-actions" style="margin:-6px 0 12px">
          <button class="btn btn-ghost btn-sm" type="button" id="clearLot">Nessun lotto</button>
          <span class="hint" id="lotState"></span>
        </div>
        ${selectHTML('tipologia', 'Tipologia', S.store.meta.tipologie, existing && existing.tipologia)}
        ${selectHTML('produzione', 'Produzione', S.store.meta.produzioni, existing && existing.produzione)}
        <label class="field"><span>Codice varietà</span><div data-variety></div></label>
        <input type="hidden" name="varieta">
        ${selectHTML('clone', 'Codice clone', [], '', ' disabled')}
        <p class="field-error" data-clone-hint></p>
        ${selectHTML('portainnesto', 'Codice portainnesto', S.store.index.rootstocks, existing && existing.portainnesto)}
        <label class="field"><span>Quantità ordinata</span>
          <input type="number" name="quantita" min="1" step="1" inputmode="numeric" required
                 value="${existing ? existing.quantita : ''}"></label>
        <label class="field" style="display:flex;gap:10px;align-items:center">
          <input type="checkbox" name="spedito" style="width:20px;height:20px;min-height:0"${existing && existing.spedito ? ' checked' : ''}>
          <span style="margin:0">Già spedito</span></label>
        <label class="field"><span>Note</span><textarea name="note" maxlength="500">${existing && existing.note ? U.esc(existing.note) : ''}</textarea></label>
        <div id="impact"></div>
        <p class="field-error" id="formErr" hidden></p>
      </form>`,
    actions: [
      { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
      { label: isEdit ? 'Salva modifiche' : 'Salva', class: 'btn-primary', run: () => { if (submitFn) submitFn(); } },
    ],
    onMount: (sheet) => {
      const form = sheet.querySelector('#ordForm');
      const vc = wireVarietyClone(sheet, { varieta: existing && existing.varieta, clone: existing && existing.clone });
      const lotState = sheet.querySelector('#lotState');
      const paintLotState = () => {
        const id = form.elements.id_magazzino.value;
        const lot = id ? S.store.index.lotById.get(id) : null;
        if (lotState) {
          lotState.textContent = lot
            ? `Collegato: ${lot.produttore || '—'} · ${lot.anno} · ${lot.varieta} · ${lot.clone}`
            : 'Nessun lotto collegato';
        }
        const clear = sheet.querySelector('#clearLot');
        if (clear) clear.disabled = !lot;
      };
      const lotBox = U.combobox(sheet.querySelector('[data-lot]'), {
        items: lotItems,
        placeholder: 'Cerca lotto (produttore, varietà, clone)…',
        onPick: (id) => {
          if (!id) {                          // «— Nessun lotto —»: detach and keep the dimensions
            form.elements.id_magazzino.value = '';
            paintLotState();
            updateImpact();
            U.toast('Lotto scollegato: l\'impegno sarà salvato senza lotto');
            return;
          }
          const lot = S.store.index.lotById.get(id);
          if (!lot) return;
          form.elements.id_magazzino.value = lot.id;
          form.elements.tipologia.value = lot.tipologia || '';
          form.elements.produzione.value = lot.produzione || '';
          form.elements.portainnesto.value = lot.portainnesto || '';
          if (vc && vc.setVarieta) vc.setVarieta(lot.varieta, lot.clone);
          paintLotState();
          updateImpact();
          U.toast('Dimensioni compilate dal lotto');
        },
      });
      sheet.querySelector('#clearLot').addEventListener('click', () => {
        form.elements.id_magazzino.value = '';
        const box = sheet.querySelector('[data-lot] input');
        if (box) box.value = '';
        paintLotState();
        updateImpact();
        U.toast('Lotto scollegato: l\'impegno sarà salvato senza lotto');
      });
      if (existingLot) {
        lotBox.set(existingLot.id, `${existingLot.produttore || '—'} · ${existingLot.anno} · ${existingLot.varieta} · ${existingLot.clone}`);
      }
      paintLotState();

      form.addEventListener('change', updateImpact);
      form.addEventListener('input', U.debounce(updateImpact, 300));
      function updateImpact() {
        if (!form || !form.isConnected) return;
        const data = Object.fromEntries(new FormData(form).entries());
        data.previousQuantita = existing ? Number(existing.quantita) || 0 : 0;
        const box = form.querySelector('#impact');
        if (!data.varieta || !data.clone || !data.quantita) { box.innerHTML = ''; return; }
        const { before, after } = S.availabilityImpact(data);
        // the residual value is always shown, so the office knows what will be left
        box.innerHTML = `
          <div class="impact">
            <div class="impact-item">
              <span class="impact-label">Disponibilità attuale</span>
              <b class="impact-value${before < 0 ? ' neg' : ''}">${U.fmtSigned(before)}</b>
            </div>
            <div class="impact-item">
              <span class="impact-label">Residuo dopo il salvataggio</span>
              <b class="impact-value${after < 0 ? ' neg' : ''}">${U.fmtSigned(after)}</b>
            </div>
          </div>
          ${after < 0
            ? `<div class="banner banner-warn" style="margin-top:8px"><span aria-hidden="true">⚠</span><span>La disponibilità andrà sotto zero (${U.fmtSigned(before)} → <b>${U.fmtSigned(after)}</b>): l'impegno verrà segnalato in Mancanze.</span></div>`
            : ''}`;
      }
      async function submit() {
        if (!form || !form.isConnected) return;
        const data = Object.fromEntries(new FormData(form).entries());
        data.spedito = form.elements.spedito.checked;
        const errs = S.validateOrdine(data);   // the lot link is optional
        const keys = Object.keys(errs);
        const box = form.querySelector('#formErr');
        if (keys.length) {
          box.hidden = false;
          box.textContent = keys.map((k) => errs[k]).join(' ');
          return;
        }
        const btn = sheet.querySelector('.sheet-actions [data-act="1"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Salvataggio…'; }
        let res;
        try { res = await S.saveOrdine(data, isEdit ? existing.id : null); }
        catch (e) { res = { ok: false, error: 'Errore di rete: ' + (e.message || e) }; }
        if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Salva modifiche' : 'Salva'; }
        if (!res.ok) { box.hidden = false; box.textContent = res.error; return; }
        U.closeSheet();
        U.toast(isEdit ? 'Impegno aggiornato' : 'Impegno salvato');
        ctx.refresh();
      }
      submitFn = submit;
      updateImpact();
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
        Ordini: <code>tipologia;produzione;varieta;clone;portainnesto;quantita;id_magazzino;spedito;note</code>
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
          type: 'row', cls: 'trow negative',
          cells: [
            { html: String(e.riga), label: 'Riga' },
            { html: `<span class="ident">${U.esc(e.colonna)}</span>`, label: 'Colonna' },
            { html: `<span class="ident">${U.esc(e.valore)}</span>`, label: 'Valore' },
            { html: U.esc(e.motivo), label: 'Motivo' },
          ],
        })),
      })}</div>` : `<div class="banner banner-ok"><span aria-hidden="true">✓</span><span>Tutte le righe sono valide.</span></div>`}`;

    const apply = out.querySelector('#apply');
    if (apply) apply.addEventListener('click', async () => {
      apply.disabled = true;
      apply.textContent = 'Importazione…';
      let res;
      try { res = await S.importRows(kind, r.valid); }
      catch (e) { res = { ok: false, error: 'Errore di rete: ' + (e.message || e) }; }
      if (!res.ok) {
        apply.disabled = false;
        apply.textContent = `Importa ${U.fmtQty(r.valid.length)} righe`;
        U.toast(res.error, { tone: 'error', ms: 9000 });
        return;
      }
      U.toast(`Importate ${U.fmtQty(res.count)} righe`);
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
    return out.map((s2) => s2.trim());
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
    const rec = kind === 'lotti'
      ? {
          anno: pick(row, 'anno'), produttore: pick(row, 'produttore'),
          tipologia: pick(row, 'tipologia'), produzione: pick(row, 'produzione'),
          varieta: pick(row, 'varieta'), clone: pick(row, 'clone'),
          portainnesto: pick(row, 'portainnesto'), quantita: pick(row, 'quantita'),
          note: pick(row, 'note') || null,
        }
      : {
          tipologia: pick(row, 'tipologia'), produzione: pick(row, 'produzione'),
          varieta: pick(row, 'varieta'), clone: pick(row, 'clone'),
          portainnesto: pick(row, 'portainnesto'), quantita: pick(row, 'quantita'),
          note: pick(row, 'note') || null,
          spedito: /^(s[iì]|si|true|1|x|spedito)$/i.test(pick(row, 'spedito') || ''),
          id_magazzino: pick(row, 'id_magazzino') || null,
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
  const q = state.vitiSearch.trim().toLowerCase();
  const varieta = state.vitiVarieta || '';
  const C = S.collator();

  const filtered = S.store.viti
    .filter((v) => !varieta || v.varieta === varieta)
    .filter((v) => !q || v.clone.toLowerCase().includes(q) || v.varieta.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => C.compare(a.varieta, b.varieta) || C.compare(a.clone, b.clone));
  const shown = filtered.slice(0, state.vitiLimit);

  const rows = shown.map((v) => {
    const used = S.usageOfPair(v.varieta, v.clone);
    return {
      type: 'row',
      cells: [
        { html: `<span class="ident">${U.esc(v.varieta)}</span>`, cls: 'ident', label: 'Codice varietà' },
        { html: `<span class="ident">${U.esc(v.clone)}</span>`, label: 'Codice clone', cls: 'cell-sub' },
        U.metric('Utilizzi', U.fmtQty(used)),
        { html: used ? '<span class="badge badge-ok">in uso</span>' : '<span class="badge">libera</span>', label: 'Stato' },
        { html: `<div class="row" style="gap:6px">
            <button class="btn btn-secondary btn-sm" type="button" data-edit-pair="${U.esc(v.varieta)}|${U.esc(v.clone)}">Modifica</button>
            <button class="btn btn-danger btn-sm" type="button" data-del-pair="${U.esc(v.varieta)}|${U.esc(v.clone)}">Elimina</button>
          </div>`, label: 'Azioni', cls: 'no-print' },
      ],
    };
  });

  const subtitle = varieta
    ? `${U.fmtQty(filtered.length)} cloni di ${U.esc(varieta)}`
    : `${U.fmtQty(S.store.viti.length)} coppie varietà/clone · ${U.fmtQty(S.store.index.varieta.length)} varietà`;

  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Anagrafiche / Vite</p>
      <h1>Anagrafica vite</h1>
      <p class="sub">${subtitle} · inserimento, modifica ed eliminazione</p>
    </div>
    <div class="spacer"></div>
    <div class="row">${P.can(ctx.role, 'anag.viti') && S.canWrite() ? '<button class="btn btn-primary" type="button" id="newBtn">+ Varietà / clone</button>' : ''}</div></div>

    <div class="card card-pad mb">
      <div class="filters" style="margin:0">
        <div class="field" style="margin:0">
          <span>Varietà</span>
          <div id="varietyFilter"></div>
        </div>
        <label class="field" style="margin:0"><span>Cerca clone</span>
          <input type="search" id="q" value="${U.esc(state.vitiSearch)}" placeholder="es. CL-1"></label>
        <div class="filter-actions">
          <button class="btn btn-secondary" type="button" id="resetViti">Azzera</button>
        </div>
      </div>
    </div>

    <div class="report">${U.buildTable({
      caption: 'Una riga per coppia varietà/clone, ordinata per varietà e clone. Il clone appartiene sempre a una varietà (F-V2); una coppia usata da lotti o impegni non è modificabile né eliminabile.',
      cols: [{ label: 'Codice varietà' }, { label: 'Codice clone' }, { label: 'Utilizzi', align: 'r' },
             { label: 'Stato' }, { label: 'Azioni' }],
      rows: rows.length ? rows : [{ type: 'empty', cells: [{ html: 'Nessuna coppia con questi filtri.' }] }],
    })}</div>
    ${filtered.length > shown.length
      ? `<div class="mt"><button class="btn btn-secondary btn-block" type="button" id="more">Mostra altri ${Math.min(state.vitiLimit, filtered.length - shown.length)} cloni</button></div>`
      : ''}`;

  U.combobox(root.querySelector('#varietyFilter'), {
    items: S.store.index.varieta.map((v) => ({
      value: v, label: v, sub: S.clonesOf(v).length + ' cloni',
    })),
    placeholder: 'Cerca varietà…',
    value: varieta,
    onPick: (value) => {
      state.vitiVarieta = value;
      state.vitiLimit = 60;
      ctx.refresh();
    },
  });

  root.querySelector('#q').addEventListener('input', U.debounce((e) => {
    state.vitiSearch = e.target.value; state.vitiLimit = 60; refreshKeepingCaret(ctx);
  }, 250));
  root.querySelector('#resetViti').addEventListener('click', () => {
    if (!state.vitiSearch && !state.vitiVarieta) return;
    state.vitiSearch = '';
    state.vitiVarieta = '';
    state.vitiLimit = 60;
    ctx.refresh();
  });
  const more = root.querySelector('#more');
  if (more) more.addEventListener('click', () => { state.vitiLimit += 60; ctx.refresh(); });

  const newBtn = root.querySelector('#newBtn');
  if (newBtn) newBtn.addEventListener('click', () => openPairForm(ctx));

  root.querySelectorAll('[data-edit-pair]').forEach((b) => {
    b.addEventListener('click', () => {
      const parts = b.dataset.editPair.split('|');
      openPairForm(ctx, { varieta: parts[0], clone: parts[1] });
    });
  });
  root.querySelectorAll('[data-del-pair]').forEach((b) => {
    b.addEventListener('click', () => {
      const parts = b.dataset.delPair.split('|');
      const varietaSel = parts[0], clone = parts[1];
      U.confirmSheet({
        title: 'Eliminare la coppia?',
        message: `${varietaSel} · ${clone}. Se è usata da lotti o impegni l'operazione verrà rifiutata.`,
        confirmLabel: 'Elimina', danger: true,
        onConfirm: async () => {
          const res = await S.removeVitiPair(varietaSel, clone);
          if (!res.ok) { U.toast(res.error, { tone: 'error' }); return; }
          U.toast('Coppia eliminata');
          ctx.refresh();
        },
      });
    });
  });
}

function openPairForm(ctx, existing) {
  const isEdit = !!existing;
  let submitFn = null;
  U.openSheet({
    title: isEdit ? 'Modifica varietà / clone' : 'Nuova varietà / clone',
    body: `<form id="vitiForm">
        <label class="field"><span>Codice varietà</span><div data-variety></div></label>
        <label class="field"><span>Codice clone</span>
          <input type="text" name="clone" required value="${existing ? U.esc(existing.clone) : ''}"
                 placeholder="es. CL-1" autocapitalize="characters"></label>
        <p class="field-error" id="vitiErr" hidden></p>
      </form>`,
    actions: [
      { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
      { label: 'Salva', class: 'btn-primary', run: () => { if (submitFn) submitFn(); } },
    ],
    onMount: (sheet) => {
      let varieta = existing ? existing.varieta : '';
      U.combobox(sheet.querySelector('[data-variety]'), {
        items: S.store.index.varieta.map((v) => ({ value: v, label: v })),
        placeholder: 'Cerca o scrivi una nuova varietà…',
        value: varieta,
        onPick: (v) => { varieta = v; },
      });
      const input = sheet.querySelector('[data-variety] input');
      input.addEventListener('input', () => { varieta = input.value; });
      async function submit() {
        const clone = sheet.querySelector('[name="clone"]').value;
        const name = (varieta || input.value || '').trim();
        const btn = sheet.querySelector('.sheet-actions [data-act="1"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Salvataggio…'; }
        let res;
        try {
          res = await S.saveVitiPair(
            isEdit ? { varieta: existing.varieta, clone: existing.clone } : null,
            { varieta: name, clone },
          );
        } catch (e) { res = { ok: false, error: 'Errore di rete: ' + (e.message || e) }; }
        if (btn) { btn.disabled = false; btn.textContent = 'Salva'; }
        const err = sheet.querySelector('#vitiErr');
        if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
        U.closeSheet();
        U.toast(isEdit ? 'Coppia aggiornata' : 'Coppia salvata');
        ctx.refresh();
      }
      submitFn = submit;
    },
  });
}

/* ---------------------------------------------- S-17 anagrafica portainnesti */
export function viewPortainnesti(root, ctx) {
  const q = state.rootsSearch.toLowerCase();
  const list = S.store.index.rootstocks.filter((c) => !q || c.toLowerCase().includes(q));
  root.innerHTML = `
    <div class="page-head"><div>
      <p class="eyebrow">Anagrafiche / Portainnesti</p>
      <h1>Anagrafica portainnesto</h1>
      <p class="sub">${U.fmtQty(S.store.portainnesti.length)} codici · inserimento, modifica ed eliminazione</p>
    </div>
    <div class="spacer"></div>
    <div class="row">${P.can(ctx.role, 'anag.portainnesti') && S.canWrite() ? '<button class="btn btn-primary" type="button" id="newBtn">+ Portainnesto</button>' : ''}</div></div>

    <div class="card card-pad mb">
      <label class="field" style="margin:0"><span>Cerca codice</span>
        <input type="search" id="q" value="${U.esc(state.rootsSearch)}" placeholder="es. 1103"></label>
    </div>

    <div class="report">${U.buildTable({
      caption: 'Il codice portainnesto è la chiave di raggruppamento dei riepiloghi. Un codice usato da lotti o impegni non è modificabile né eliminabile.',
      cols: [{ label: 'Codice portainnesto' }, { label: 'Utilizzi', align: 'r' }, { label: 'Stato' }, { label: 'Azioni' }],
      rows: list.length ? list.map((c) => {
        const used = S.usageOfRootstock(c);
        return {
          type: 'row',
          cells: [
            { html: `<span class="ident">${U.esc(c)}</span>`, cls: 'ident' },
            U.metric('Utilizzi', U.fmtQty(used)),
            { html: used ? '<span class="badge badge-ok">in uso</span>' : '<span class="badge">libero</span>', label: 'Stato' },
            { html: S.canWrite() ? `<div class="row" style="gap:6px">
                <button class="btn btn-secondary btn-sm" type="button" data-rename="${U.esc(c)}">Modifica</button>
                <button class="btn btn-danger btn-sm" type="button" data-del-root="${U.esc(c)}">Elimina</button>
              </div>` : '—', label: 'Azioni', cls: 'no-print' },
          ],
        };
      }) : [{ type: 'empty', cells: [{ html: 'Nessun portainnesto trovato.' }] }],
    })}</div>`;

  root.querySelector('#q').addEventListener('input', U.debounce((e) => {
    state.rootsSearch = e.target.value; refreshKeepingCaret(ctx);
  }, 250));

  const newBtn = root.querySelector('#newBtn');
  if (newBtn) newBtn.addEventListener('click', () => openRootForm(ctx));

  root.querySelectorAll('[data-rename]').forEach((b) => {
    b.addEventListener('click', () => openRootForm(ctx, b.dataset.rename));
  });
  root.querySelectorAll('[data-del-root]').forEach((b) => {
    b.addEventListener('click', () => {
      const code = b.dataset.delRoot;
      U.confirmSheet({
        title: 'Eliminare il portainnesto?',
        message: `${code}. Se è usato da lotti o impegni l'operazione verrà rifiutata.`,
        confirmLabel: 'Elimina', danger: true,
        onConfirm: async () => {
          const res = await S.removePortainnesto(code);
          if (!res.ok) { U.toast(res.error, { tone: 'error' }); return; }
          U.toast('Portainnesto eliminato');
          ctx.refresh();
        },
      });
    });
  });
}

function openRootForm(ctx, existing) {
  let submitFn = null;
  U.openSheet({
    title: existing ? 'Modifica portainnesto' : 'Nuovo portainnesto',
    body: `<form id="rootForm">
        <label class="field"><span>Codice portainnesto</span>
          <input type="text" name="code" required value="${existing ? U.esc(existing) : ''}"
                 placeholder="es. 1103 PAULSEN"></label>
        <p class="field-error" id="rootErr" hidden></p>
      </form>`,
    actions: [
      { label: 'Annulla', class: 'btn-secondary', run: U.closeSheet },
      { label: 'Salva', class: 'btn-primary', run: () => { if (submitFn) submitFn(); } },
    ],
    onMount: (sheet) => {
      async function submit() {
        const code = sheet.querySelector('[name="code"]').value;
        const btn = sheet.querySelector('.sheet-actions [data-act="1"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Salvataggio…'; }
        let res;
        try { res = await S.savePortainnesto(existing || null, code); }
        catch (e) { res = { ok: false, error: 'Errore di rete: ' + (e.message || e) }; }
        if (btn) { btn.disabled = false; btn.textContent = 'Salva'; }
        const err = sheet.querySelector('#rootErr');
        if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
        U.closeSheet();
        U.toast(existing ? 'Portainnesto aggiornato' : 'Portainnesto salvato');
        ctx.refresh();
      }
      submitFn = submit;
      sheet.querySelector('[name="code"]').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
    },
  });
}
