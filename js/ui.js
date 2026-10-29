/* Vignero · ui.js — formatting, responsive table builder, sheets, combobox */

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  table: '<path d="M3 5h18v14H3z"/><path d="M3 10h18M9 10v9"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9v5M12 17h.01"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.3 2.9-5.2 6.5-5.2s6.5 1.9 6.5 5.2"/><path d="M16 5.4a3 3 0 0 1 0 5.6M18 14.6c2.1.6 3.5 2.2 3.5 5.4"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  truck: '<path d="M2 7h11v9H2z"/><path d="M13 10h4l4 3.5V16h-8z"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
  upload: '<path d="M12 16V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4 16v3.5h16V16"/>',
  leaf: '<path d="M20 4c-8 0-14 3.4-14 9.5A6.5 6.5 0 0 0 12.5 20C18 20 20 13 20 4z"/><path d="M10 20c1.2-4.4 3.6-7.6 7-9.6"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.2"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
};
export function icon(name, cls) {
  return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const nf = new Intl.NumberFormat('it-IT');
const df = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return nf.format(Number(n));
}
export function fmtQty(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return df.format(Number(n));
}
/** Negative values carry a leading minus (U+2212), positives are plain. */
export function fmtSigned(n) {
  const v = Number(n || 0);
  return v < 0 ? '\u2212' + df.format(Math.abs(v)) : df.format(v);
}
export function pct(part, total) {
  if (!total) return '—';
  return Math.round((part / total) * 100) + '%';
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function debounce(fn, ms) {
  let id;
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
}

/* --------------------------------------------------------------- toast */
let toastTimer;
export function toast(message, opts = {}) {
  const root = document.getElementById('toasts');
  root.innerHTML = '';
  const node = el(`<div class="toast${opts.tone === 'error' ? ' toast-error' : ''}" role="status">
      <span>${esc(message)}</span>
      ${opts.action && opts.action.label ? `<button class="link" type="button">${esc(opts.action.label)}</button>` : ''}
    </div>`);
  if (opts.action && opts.action.label) {
    node.querySelector('button').addEventListener('click', () => {
      root.innerHTML = '';
      opts.action.run();
    });
  }
  root.appendChild(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, opts.ms || 4200);
}

/* --------------------------------------------------------------- sheet */
export function closeSheet() {
  const root = document.getElementById('sheetRoot');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '';
  document.body.style.overflow = '';
}

export function openSheet({ title, body, actions, onMount, wide }) {
  const root = document.getElementById('sheetRoot');
  root.innerHTML = `
    <button class="sheet-scrim" type="button" aria-label="Chiudi"></button>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"${wide ? ' style="max-width:760px"' : ''}>
      <div class="sheet-handle" aria-hidden="true"></div>
      <div class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="btn btn-ghost btn-sm" type="button" data-close>Chiudi</button>
      </div>
      <div class="sheet-body">${body || ''}</div>
      ${actions && actions.length ? `<div class="sheet-actions">${actions.map((a, i) =>
        `<button class="btn ${a.class || 'btn-secondary'}" type="button" data-act="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
  root.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  root.querySelector('.sheet-scrim').addEventListener('click', closeSheet);
  root.querySelector('[data-close]').addEventListener('click', closeSheet);
  (actions || []).forEach((a, i) => {
    root.querySelector(`[data-act="${i}"]`).addEventListener('click', () => a.run && a.run());
  });
  const focusable = root.querySelector('.sheet-body input, .sheet-body select, .sheet-actions .btn');
  if (focusable) setTimeout(() => focusable.focus(), 40);
  if (onMount) onMount(root.querySelector('.sheet'));
  return root.querySelector('.sheet');
}

export function confirmSheet({ title, message, confirmLabel = 'Conferma', danger = false, onConfirm }) {
  openSheet({
    title,
    body: `<p style="font-size:14px">${esc(message)}</p>`,
    actions: [
      { label: 'Annulla', class: 'btn-secondary', run: closeSheet },
      { label: confirmLabel, class: danger ? 'btn-danger' : 'btn-primary',
        run: () => { closeSheet(); onConfirm && onConfirm(); } },
    ],
  });
}

/* ------------------------------------------------------------ combobox */
/** Searchable single-select. items: array of {value, label, sub} */
export function combobox(host, { items, placeholder = 'Cerca…', onPick, value = '', max = 40 }) {
  host.classList.add('combo');
  host.innerHTML = `<input type="text" role="combobox" aria-expanded="false"
      aria-autocomplete="list" placeholder="${esc(placeholder)}"
      value="${esc(value)}" autocomplete="off" spellcheck="false">`;
  const input = host.querySelector('input');
  let list = null, filtered = [], selected = value;

  const close = () => {
    if (list) { list.remove(); list = null; input.setAttribute('aria-expanded', 'false'); }
  };
  const open = (q) => {
    close();
    const needle = (q || '').trim().toLowerCase();
    filtered = items.filter((it) => !needle ||
      it.label.toLowerCase().includes(needle) ||
      (it.sub || '').toLowerCase().includes(needle)).slice(0, max);
    list = el(`<div class="combo-list" role="listbox">
        ${filtered.length ? filtered.map((it, i) => `
          <button type="button" role="option" aria-selected="${it.value === selected}" data-i="${i}">
            <span class="mono">${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}
          </button>`).join('')
          : `<div class="combo-empty">Nessun risultato</div>`}
      </div>`);
    host.appendChild(list);
    input.setAttribute('aria-expanded', 'true');
    list.querySelectorAll('button[data-i]').forEach((b) => {
      // keep focus in the input while pressing, but act on click so that
      // keyboard (Enter/Space) and assistive activation work too
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        const it = filtered[Number(b.dataset.i)];
        if (!it) return;
        selected = it.value;
        input.value = it.label;
        close();
        onPick && onPick(it.value, it);
      });
    });
  };
  input.addEventListener('focus', () => open(''));
  input.addEventListener('input', () => open(input.value));
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); input.blur(); }
    if (e.key === 'Enter' && list && filtered.length === 1) {
      e.preventDefault();
      selected = filtered[0].value;
      input.value = filtered[0].label;
      close();
      onPick && onPick(selected, filtered[0]);
    }
  });
  return {
    set(v, label) { selected = v; input.value = label || v || ''; },
    get value() { return selected; },
    clear() { selected = ''; input.value = ''; },
  };
}

/* ------------------------------------------------------------- table API */
/**
 * cols: [{label, align?:'r', cls?}]
 * rows: [{type:'group'|'row'|'subtotal'|'total'|'empty', cls?, cells:[{html, label?, cls?, span?}]}]
 * Builds a <table class="grid"> whose CSS turns rows into cards under 760px.
 */
export function buildTable({ cols, rows, caption, scroll = false, capId, tableClass = '' }) {
  const head = `<thead><tr>${cols.map((c) =>
    `<th scope="col" class="${c.align === 'r' ? 'r' : ''} ${c.cls || ''}">${esc(c.label)}</th>`).join('')}</tr></thead>`;
  const body = rows.map((r) => {
    if (r.type === 'group') {
      return `<tr class="group"><th scope="rowgroup" colspan="${cols.length}">
          <span>${r.cells[0].html}</span><span class="g-sub">${r.cells[0].sub || ''}</span></th></tr>`;
    }
    if (r.type === 'empty') {
      return `<tr class="empty-row"><td colspan="${cols.length}">${r.cells[0].html}</td></tr>`;
    }
    const rowCls = r.type === 'row' ? (r.cls || 'trow') : r.type;
    return `<tr class="${rowCls}">${r.cells.map((c, i) => {
      const span = c.span ? ` colspan="${c.span}"` : '';
      const label = c.label ? ` data-label="${esc(c.label)}"` : '';
      // the cell inherits the column alignment, so a numeric column can never
      // drift away from its header (cells are built by several helpers)
      const col = cols[i];
      const cellCls = [c.cls || '', col && col.align === 'r' && !/\br\b/.test(c.cls || '') ? 'r' : '']
        .filter(Boolean).join(' ');
      return `<td class="${cellCls}"${span}${label}>${c.html}</td>`;
    }).join('')}</tr>`;
  }).join('');
  // The caption is a block *before* the table, never a <caption> element: inside a
  // display:block table (the mobile card layout, and the max-content matrix) a
  // table-caption falls back to an anonymous shrink-to-fit table and collapses
  // into a narrow ribbon. `caption` may be a string or {wide, narrow}.
  const cap = typeof caption === 'string' ? { wide: caption, narrow: caption } : (caption || null);
  const id = capId || ('cap-' + Math.random().toString(36).slice(2, 8));
  const capHTML = cap && (cap.wide || cap.narrow)
    ? `<div class="table-cap" id="${id}">
         <span class="cap-wide">${esc(cap.wide || cap.narrow)}</span>
         <span class="cap-narrow">${esc(cap.narrow || cap.wide)}</span>
       </div>`
    : '';
  const described = capHTML ? ` aria-describedby="${id}"` : '';
  const table = `<table class="grid${tableClass ? ' ' + tableClass : ''}"${described}>${head}<tbody>${body}</tbody></table>`;
  return capHTML + (scroll ? `<div class="table-scroll">${table}</div>` : table);
}

/** Convenience: a metric cell (mobile shows the label above the value). */
export function metric(label, value, { negative = false, cls = '' } = {}) {
  return { html: negative ? `<span class="neg">${value}</span>` : value, label, cls: `metric ${cls}` };
}

export function emptyState({ icon = '◇', title, text, action }) {
  return `<div class="empty">
      <div class="e-icon" aria-hidden="true">${icon}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text || '')}</p>
      ${action ? `<button class="btn btn-primary" type="button" data-empty-action>${esc(action)}</button>` : ''}
    </div>`;
}

/* ------------------------------------------------------------ csv export */
import { toCSV, download } from './store.js';
export function exportCSV(filename, headers, rows) {
  download(filename, toCSV(headers, rows));
  toast('File esportato: ' + filename);
}

export function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
