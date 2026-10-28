/* Vignero · filters.js — the single filter control used by every report (spec S-10) */
import * as S from './store.js';
import * as U from './ui.js';

export const EMPTY = { tipologia: '', produzione: '', varieta: '' };

export function parseFilters(params) {
  return {
    tipologia: params.get('tipologia') || '',
    produzione: params.get('produzione') || '',
    varieta: params.get('varieta') || '',
  };
}

export function serializeFilters(f) {
  const p = new URLSearchParams();
  for (const k of ['tipologia', 'produzione', 'varieta']) if (f[k]) p.set(k, f[k]);
  const s = p.toString();
  return s ? '?' + s : '';
}

export function activeChips(f) {
  const out = [];
  if (f.tipologia) out.push({ key: 'tipologia', label: 'Tipologia: ' + f.tipologia });
  if (f.produzione) out.push({ key: 'produzione', label: 'Produzione: ' + f.produzione });
  if (f.varieta) out.push({ key: 'varieta', label: 'Varietà: ' + f.varieta });
  return out;
}

/**
 * Renders the filter bar into `host`. onChange(nextFilters) is called on every
 * change (the caller owns navigation / re-render).
 */
export function filterBar(host, filters, onChange, opts = {}) {
  const showVarieta = opts.showVarieta !== false;
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

  host.querySelector('[data-reset]').addEventListener('click', () => {
    if (!filters.tipologia && !filters.produzione && !filters.varieta) return;
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
