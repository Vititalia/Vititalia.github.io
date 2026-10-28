/* Vignero · filters.js — the single filter control used by every report (spec S-10) */
import * as S from './store.js';
import * as U from './ui.js';

export const EMPTY = { tipologia: '', produzione: '', varieta: '', portainnesto: '', produttore: '' };

export function parseFilters(params) {
  return {
    tipologia: params.get('tipologia') || '',
    produzione: params.get('produzione') || '',
    varieta: params.get('varieta') || '',
    portainnesto: params.get('portainnesto') || '',
    produttore: params.get('produttore') || '',
  };
}

export function serializeFilters(f) {
  const p = new URLSearchParams();
  for (const k of ['tipologia', 'produzione', 'varieta', 'portainnesto', 'produttore']) if (f[k]) p.set(k, f[k]);
  const s = p.toString();
  return s ? '?' + s : '';
}

export function activeChips(f) {
  const out = [];
  if (f.tipologia) out.push({ key: 'tipologia', label: 'Tipologia: ' + f.tipologia });
  if (f.produzione) out.push({ key: 'produzione', label: 'Produzione: ' + f.produzione });
  if (f.varieta) out.push({ key: 'varieta', label: 'Varietà: ' + f.varieta });
  if (f.portainnesto) out.push({ key: 'portainnesto', label: 'Portainnesto: ' + f.portainnesto });
  if (f.produttore) out.push({ key: 'produttore', label: 'Produttore: ' + f.produttore });
  return out;
}

/**
 * Renders the filter bar into `host`. onChange(nextFilters) is called on every
 * change (the caller owns navigation / re-render).
 */
export function filterBar(host, filters, onChange, opts = {}) {
  const showVarieta = opts.showVarieta !== false;
  const showPortainnesto = opts.showPortainnesto === true;
  const showProduttore = opts.showProduttore === true;
  const tid = 'f-tip-' + Math.random().toString(36).slice(2, 7);
  const pid = 'f-prod-' + Math.random().toString(36).slice(2, 7);

  host.innerHTML = `
    <div class="filters" role="group" aria-label="Filtri">
      <label class="field" for="${tid}" style="margin:0">
        <span>Tipologia</span>
        <select id="${tid}" data-filter="tipologia">
          <option value="">Tutte</option>
          ${S.store.meta.tipologie.map((t) =>
            `<option value="${U.esc(t)}"${filters.tipologia === t ? ' selected' : ''}>${U.esc(t)}</option>`).join('')}
        </select>
      </label>
      <label class="field" for="${pid}" style="margin:0">
        <span>Produzione</span>
        <select id="${pid}" data-filter="produzione">
          <option value="">Tutte</option>
          ${S.store.meta.produzioni.map((t) =>
            `<option value="${U.esc(t)}"${filters.produzione === t ? ' selected' : ''}>${U.esc(t)}</option>`).join('')}
        </select>
      </label>
      <div class="field" style="margin:0" ${showVarieta ? '' : 'hidden'}>
        <span id="${tid}-v">Codice varietà</span>
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

  const next = (patch) => {
    const f = { ...filters, ...patch };
    onChange(f);
  };

  host.querySelectorAll('[data-filter]').forEach((sel) => {
    sel.addEventListener('change', () => next({ [sel.dataset.filter]: sel.value }));
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
    if (!filters.tipologia && !filters.produzione && !filters.varieta &&
        !filters.portainnesto && !filters.produttore) return;
    onChange({ ...EMPTY });
  });

  const chips = host.querySelector(`#${tid}-chips`);
  const list = activeChips(filters);
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
