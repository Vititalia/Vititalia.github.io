/* Vignero · filters.js — the shared report filter bar */
import * as S from './store.js';
import * as U from './ui.js';

export const EMPTY = { tipologia: '', produzione: '', varieta: '', portainnesto: '', produttore: '' };

/** Reports do not show tipologia/produzione, so these two are mandatory defaults. */
export function mandatoryDefaults() {
  return {
    tipologia: S.store.meta.defaultTipologia || 'Barbatelle innestate',
    produzione: S.store.meta.defaultProduzione || 'Nuova produzione',
  };
}

/**
 * Reads the filters from the URL. With `mandatory: true` the report's required
 * filters are always filled, so a table can never be opened without them.
 */
export function parseFilters(params, opts = {}) {
  const f = {
    tipologia: params.get('tipologia') || '',
    produzione: params.get('produzione') || '',
    varieta: params.get('varieta') || '',
    portainnesto: params.get('portainnesto') || '',
    produttore: params.get('produttore') || '',
  };
  const d = mandatoryDefaults();
  const required = opts.mandatory === true ? Object.keys(d)
    : Array.isArray(opts.mandatory) ? opts.mandatory : [];
  for (const k of required) if (!f[k]) f[k] = d[k];
  return f;
}

export function serializeFilters(f) {
  const p = new URLSearchParams();
  for (const k of ['tipologia', 'produzione', 'varieta', 'portainnesto', 'produttore']) {
    if (f[k]) p.set(k, f[k]);
  }
  const s = p.toString();
  return s ? '?' + s : '';
}

export function activeChips(f, opts = {}) {
  const skip = new Set(opts.skip || []);
  const out = [];
  if (f.tipologia && !skip.has('tipologia')) out.push({ key: 'tipologia', label: 'Tipologia: ' + f.tipologia });
  if (f.produzione && !skip.has('produzione')) out.push({ key: 'produzione', label: 'Produzione: ' + f.produzione });
  if (f.varieta) out.push({ key: 'varieta', label: 'Varietà: ' + f.varieta });
  if (f.portainnesto) out.push({ key: 'portainnesto', label: 'Portainnesto: ' + f.portainnesto });
  if (f.produttore) out.push({ key: 'produttore', label: 'Produttore: ' + f.produttore });
  return out;
}

/**
 * filterBar(host, filters, onChange, {
 *   showVarieta, showPortainnesto, showProduttore,
 *   mandatory: ['tipologia','produzione']   // required selects, no empty option
 * })
 */
export function filterBar(host, filters, onChange, opts = {}) {
  const showVarieta = opts.showVarieta !== false;
  const showPortainnesto = opts.showPortainnesto === true;
  const showProduttore = opts.showProduttore === true;
  const showProduzione = opts.showProduzione !== false;   // the availability report fixes it
  const skipChips = new Set([...(opts.skipChips || []), ...(showProduzione ? [] : ['produzione'])]);
  const mandatory = new Set(opts.mandatory || []);
  const defaults = mandatoryDefaults();
  const tid = 'f-' + Math.random().toString(36).slice(2, 7);

  const options = (name, list) => {
    if (mandatory.has(name)) {
      return list.map((t) => `<option value="${U.esc(t)}"${(filters[name] || defaults[name]) === t ? ' selected' : ''}>${U.esc(t)}</option>`).join('');
    }
    return `<option value="">Tutte</option>` +
      list.map((t) => `<option value="${U.esc(t)}"${filters[name] === t ? ' selected' : ''}>${U.esc(t)}</option>`).join('');
  };

  host.innerHTML = `
    <div class="filters" role="group" aria-label="Filtri">
      <label class="field" for="${tid}-tip" style="margin:0">
        <span>Tipologia${mandatory.has('tipologia') ? ' <em class="req">obbligatoria</em>' : ''}</span>
        <select id="${tid}-tip" data-filter="tipologia">${options('tipologia', S.store.meta.tipologie)}</select>
      </label>
      <label class="field" for="${tid}-prod" style="margin:0" ${showProduzione ? '' : 'hidden'}>
        <span>Produzione${mandatory.has('produzione') ? ' <em class="req">obbligatoria</em>' : ''}</span>
        <select id="${tid}-prod" data-filter="produzione">${options('produzione', S.store.meta.produzioni)}</select>
      </label>
      <div class="field" style="margin:0" ${showVarieta ? '' : 'hidden'}>
        <span>Codice varietà</span>
        <div id="${tid}-combo"></div>
      </div>
      <div class="field" style="margin:0" ${showPortainnesto ? '' : 'hidden'}>
        <span>Codice portainnesto</span>
        <div id="${tid}-root"></div>
      </div>
      <label class="field" style="margin:0" ${showProduttore ? '' : 'hidden'}>
        <span>Produttore</span>
        <select data-filter="produttore">
          <option value="">Tutti</option>
          ${S.store.meta.produttori.map((g) =>
            `<option value="${U.esc(g)}"${filters.produttore === g ? ' selected' : ''}>${U.esc(g)}</option>`).join('')}
        </select>
      </label>
      <div class="filter-actions">
        <button class="btn btn-secondary" type="button" data-reset>Azzera</button>
      </div>
    </div>
    <div class="chips" id="${tid}-chips"></div>`;

  const next = (patch) => onChange({ ...filters, ...patch });

  host.querySelectorAll('[data-filter]').forEach((sel) => {
    sel.addEventListener('change', () => {
      if (mandatory.has(sel.dataset.filter) && !sel.value) sel.value = defaults[sel.dataset.filter];
      next({ [sel.dataset.filter]: sel.value });
    });
  });

  if (showVarieta) {
    const combo = U.combobox(host.querySelector(`#${tid}-combo`), {
      items: S.store.index.varieta.map((v) => ({ value: v, label: v })),
      placeholder: 'Cerca varietà…',
      value: filters.varieta || '',
      onPick: (value) => next({ varieta: value }),
    });
    if (filters.varieta) combo.set(filters.varieta);
  }
  if (showPortainnesto) {
    const rootCombo = U.combobox(host.querySelector(`#${tid}-root`), {
      items: S.store.index.rootstocks.map((r) => ({ value: r, label: r })),
      placeholder: 'Cerca portainnesto…',
      value: filters.portainnesto || '',
      onPick: (value) => next({ portainnesto: value }),
    });
    if (filters.portainnesto) rootCombo.set(filters.portainnesto);
  }

  host.querySelector('[data-reset]').addEventListener('click', () => {
    const cleared = activeChips(filters, { skip: [...mandatory, ...skipChips] }).length;
    if (!cleared) return;
    onChange({ ...EMPTY, ...(mandatory.size ? defaults : {}) });
  });

  const chips = host.querySelector(`#${tid}-chips`);
  const list = activeChips(filters, { skip: [...mandatory, ...skipChips] });
  chips.innerHTML = list.map((c) =>
    `<button class="chip" type="button" data-chip="${c.key}">
        <b>${U.esc(c.label)}</b><span aria-hidden="true">✕</span>
        <span class="sr">rimuovi filtro</span>
      </button>`).join('');
  chips.querySelectorAll('[data-chip]').forEach((b) => {
    b.addEventListener('click', () => next({ [b.dataset.chip]: '' }));
  });
  if (!list.length) chips.innerHTML = '';
  return host;
}
