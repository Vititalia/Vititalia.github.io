/* Vignero · store.js
 * Data loading, aggregation engine and local mutations.
 *
 * Every metric is defined exactly once here, matching the database views
 * (spec §3.5–3.6):
 *   giacenza_magazzino      = SUM(lotti.quantita)
 *   totale_ordinato         = SUM(ordini.quantita)
 *   di_cui_spedite          = SUM(ordini.quantita WHERE spedito)
 *   quantita_da_spedire     = totale_ordinato - di_cui_spedite
 *   disponibilita_residua   = giacenza_magazzino - totale_ordinato
 */

import { isSupabase } from './config.js';
import { supabaseClient } from './auth.js';

export const NON_INDICATA = '(non indicata)';
export const NON_ATTRIBUITO = 'Non attribuito';
export const NON_RICONOSCIUTO = 'Non riconosciuto';

const EDITS_KEY = 'vignero.edits.v2';

export const store = {
  meta: {
    tipologie: ['Barbatelle innestate', 'Barbatelle selvatiche', 'Vasetti', 'Barbatelloni'],
    produzioni: ['Nuova produzione', 'Ripiantato', 'Frigoconservato'],
    produttori: ['Mori Marco', 'Donati', 'Agriserv', 'Vivai riuniti', 'Bianchi',
                 'Golferenzo', 'Lorin', 'Esterno'],
    defaultTipologia: 'Barbatelle innestate',
    defaultProduzione: 'Nuova produzione',
  },
  viti: [],          // [{varieta, clone}]
  portainnesti: [],  // [code]
  lotti: [],         // [{id, anno, produttore, tipologia, produzione, varieta, clone, portainnesto, quantita, note, local}]
  ordini: [],        // [{id, id_magazzino, tipologia, produzione, varieta, clone, portainnesto, quantita, spedito, note, local}]
  index: { varieta: [], clonesByVariety: new Map(), rootstocks: [], lotById: new Map() },
  ready: false,
  mode: 'demo',      // 'demo' (local snapshot) | 'supabase' (live database)
  remote: null,      // aggregated rows for roles that may not read the tables
};

/* ---------------------------------------------------------------- edits */
/* Overlay persisted in the browser:
 *   { lotti:{added,updated,removed}, ordini:{added,updated,removed},
 *     viti:{added,removed}, portainnesti:{added,removed}, spedito:{} }        */
const bucket = () => ({ added: [], updated: {}, removed: [] });
function readEdits() {
  let e = {};
  try { e = JSON.parse(localStorage.getItem(EDITS_KEY)) || {}; } catch { e = {}; }
  e.lotti = { ...bucket(), ...(e.lotti || {}) };
  e.ordini = { ...bucket(), ...(e.ordini || {}) };
  e.viti = { added: [], removed: [], ...(e.viti || {}) };
  e.portainnesti = { added: [], removed: [], ...(e.portainnesti || {}) };
  e.spedito = e.spedito || {};
  return e;
}
function writeEdits(e) {
  try { localStorage.setItem(EDITS_KEY, JSON.stringify(e)); } catch { /* private mode */ }
}
export function hasLocalEdits() {
  const e = readEdits();
  return !!(e.lotti.added.length || Object.keys(e.lotti.updated).length || e.lotti.removed.length ||
            e.ordini.added.length || Object.keys(e.ordini.updated).length || e.ordini.removed.length ||
            e.viti.added.length || e.viti.removed.length ||
            e.portainnesti.added.length || e.portainnesti.removed.length ||
            Object.keys(e.spedito).length);
}
export function resetLocalEdits() {
  try { localStorage.removeItem(EDITS_KEY); } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- load */
export async function init(role) {
  if (isSupabase()) return initSupabase(role);
  store.mode = 'demo';
  const res = await fetch('data/snapshot.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('snapshot non disponibile (' + res.status + ')');
  loadFromSnapshot(await res.json());
}

/** True when entry/editing is wired for the active backend. */
export const canWrite = () => store.mode !== 'supabase';
export const isStaffRole = (role) => role === 'admin' || role === 'ufficio';

async function fetchAll(c, table, select, size = 1000) {
  const out = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await c.from(table).select(select).range(from, from + size - 1);
    if (error) throw new Error(table + ': ' + error.message);
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

/**
 * Live backend. Staff can read the tables, so the engine keeps computing the
 * reports client-side exactly as in demo mode. Produttore/Vendite may not read
 * them (RLS), so they get the aggregated report views instead.
 */
async function initSupabase(role) {
  const c = await supabaseClient();
  store.mode = 'supabase';
  if (isStaffRole(role)) {
    const [viti, roots, lotti, ordini] = await Promise.all([
      fetchAll(c, 'anagrafica_vite', 'codice_varieta,codice_clone'),
      fetchAll(c, 'anagrafica_portainnesto', 'codice_portainnesto'),
      fetchAll(c, 'lotti_magazzino', '*'),
      fetchAll(c, 'ordini_impegni', '*'),
    ]);
    store.viti = viti.map((r) => ({ varieta: r.codice_varieta, clone: r.codice_clone }));
    store.portainnesti = roots.map((r) => r.codice_portainnesto);
    store.lotti = lotti.map((r) => ({
      id: r.id, anno: r.anno_conferimento, produttore: r.produttore,
      tipologia: r.tipologia, produzione: r.produzione, varieta: r.codice_varieta,
      clone: r.codice_clone, portainnesto: r.codice_portainnesto,
      quantita: r.quantita, note: r.note, local: false,
    }));
    store.ordini = ordini.map((r) => ({
      id: r.id, id_magazzino: r.id_magazzino, tipologia: r.tipologia,
      produzione: r.produzione, varieta: r.codice_varieta, clone: r.codice_clone,
      portainnesto: r.codice_portainnesto, quantita: r.quantita,
      spedito: !!r.spedito, note: r.note, local: false,
    }));
    store.remote = null;
  } else {
    const rows = await fetchAll(c, 'riepilogo_disponibilita', '*');
    const negative = role === 'produttore'
      ? await fetchAll(c, 'vista_disponibilita_negative', '*') : [];
    const lots = await fetchAll(c, 'vista_lotti_senza_produttore', '*');
    // «Messo a disposizione»: the view already returns only the caller's records
    const messo = role === 'produttore'
      ? await fetchAll(c, 'vista_messo_a_disposizione', '*') : [];
    store.remote = { rows, negative, lots, messo };
  }
  rebuild();
  store.ready = true;
  return store;
}

/** Pure loader: same path used by the browser and by the node tests. */
export function loadFromSnapshot(snap) {
  Object.assign(store.meta, snap.meta || {});
  store.viti = (snap.viti || []).map(([varieta, clone]) => ({ varieta, clone }));
  store.portainnesti = (snap.portainnesti || []).slice();
  store.lotti = (snap.lotti || []).map((r, i) => ({
    id: 'lot-' + String(i + 1).padStart(4, '0'),
    anno: r[0], produttore: r[1], tipologia: r[2], produzione: r[3],
    varieta: r[4], clone: r[5], portainnesto: r[6], quantita: r[7], note: r[8],
    local: false,
  }));
  store.ordini = (snap.ordini || []).map((r) => ({
    id: r[0], id_magazzino: r[1], tipologia: r[2], produzione: r[3],
    varieta: r[4], clone: r[5], portainnesto: r[6], quantita: r[7],
    spedito: !!r[8], note: r[9], local: false,
  }));
  applyEdits();
  rebuild();
  store.ready = true;
  return store;
}

function applyEdits() {
  const e = readEdits();

  const merge = (base, b) => {
    let out = base
      .filter((r) => !b.removed.includes(r.id))
      .map((r) => (b.updated[r.id] ? { ...r, ...b.updated[r.id] } : r));
    if (e.spedito) {
      out = out.map((r) => (r.spedito !== undefined && Object.prototype.hasOwnProperty.call(e.spedito, r.id)
        ? { ...r, spedito: !!e.spedito[r.id] } : r));
    }
    return out.concat(b.added.map((r) => ({ ...r, local: true })));
  };

  store.lotti = merge(store.lotti, e.lotti);
  store.ordini = merge(store.ordini, e.ordini);

  const removedPairs = e.viti.removed.map((v) => v.varieta + '\u0001' + v.clone);
  store.viti = store.viti.filter((v) => !removedPairs.includes(v.varieta + '\u0001' + v.clone));
  e.viti.added.forEach((v) => {
    if (!store.viti.some((x) => x.varieta === v.varieta && x.clone === v.clone)) {
      store.viti.push({ ...v, local: true });
    }
  });

  store.portainnesti = store.portainnesti.filter((c) => !e.portainnesti.removed.includes(c));
  e.portainnesti.added.forEach((c) => {
    if (!store.portainnesti.includes(c)) store.portainnesti.push(c);
  });
}

export function rebuild() {
  const clonesByVariety = new Map();
  const varietaSet = new Set();
  for (const v of store.viti) {
    varietaSet.add(v.varieta);
    if (!clonesByVariety.has(v.varieta)) clonesByVariety.set(v.varieta, new Set());
    clonesByVariety.get(v.varieta).add(v.clone);
  }
  const coll = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
  store.index = {
    varieta: [...varietaSet].sort(coll.compare),
    clonesByVariety,
    rootstocks: [...new Set(store.portainnesti)].sort(coll.compare),
    lotById: new Map(store.lotti.map((l) => [l.id, l])),
  };
  store._coll = coll;
}

export const collator = () => store._coll || new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

export function clonesOf(varieta) {
  const set = store.index.clonesByVariety.get(varieta);
  return set ? [...set].sort(collator().compare) : [];
}

/* ------------------------------------------------------ metrics engine */
const keyOf = (r) => [r.tipologia || NON_INDICATA, r.produzione || NON_INDICATA,
                      r.varieta, r.clone, r.portainnesto].join('\u0001');

function passes(row, f) {
  if (!f) return true;
  if (f.tipologia && (row.tipologia || NON_INDICATA) !== f.tipologia) return false;
  if (f.produzione && (row.produzione || NON_INDICATA) !== f.produzione) return false;
  if (f.varieta && row.varieta !== f.varieta) return false;
  if (f.portainnesto && row.portainnesto !== f.portainnesto) return false;
  return true;
}

function growerBuckets() {
  const b = {};
  for (const g of store.meta.produttori) b[g] = 0;
  b[NON_ATTRIBUITO] = 0;
  b[NON_RICONOSCIUTO] = 0;
  return b;
}
/** The three per-grower series the reports need (available, committed, shipped). */
const growerSeries = () => ({ growerMag: growerBuckets(), growerOrd: growerBuckets(),
                             growerSped: growerBuckets() });

/** Aggregated metrics per dimension key. growerMag/growerOrd are per-grower sums. */
export function metrics(filters) {
  const acc = new Map();
  const touch = (r) => {
    const k = keyOf(r);
    let e = acc.get(k);
    if (!e) {
      e = {
        tipologia: r.tipologia || NON_INDICATA,
        produzione: r.produzione || NON_INDICATA,
        varieta: r.varieta, clone: r.clone, portainnesto: r.portainnesto,
        mag: 0, ord: 0, sped: 0,
        ...growerSeries(),
      };
      acc.set(k, e);
    }
    return e;
  };
  for (const l of store.lotti) {
    if (!passes(l, filters)) continue;
    const e = touch(l);
    e.mag += l.quantita;
    const g = l.produttore && store.meta.produttori.includes(l.produttore)
      ? l.produttore
      : (l.produttore ? NON_RICONOSCIUTO : NON_ATTRIBUITO);
    e.growerMag[g] += l.quantita;
  }
  for (const o of store.ordini) {
    if (!passes(o, filters)) continue;
    const e = touch(o);
    e.ord += o.quantita;
    if (o.spedito) e.sped += o.quantita;
    const lot = o.id_magazzino ? store.index.lotById.get(o.id_magazzino) : null;
    const g = lot && lot.produttore
      ? (store.meta.produttori.includes(lot.produttore) ? lot.produttore : NON_RICONOSCIUTO)
      : NON_ATTRIBUITO;
    e.growerOrd[g] += o.quantita;
    if (o.spedito) e.growerSped[g] += o.quantita;
  }
  for (const e of acc.values()) {
    e.daSpedire = e.ord - e.sped;
    e.disponibilita = e.mag - e.ord;
  }
  return acc;
}

const zero = () => ({ mag: 0, ord: 0, sped: 0, daSpedire: 0, disponibilita: 0 });
const METRIC_KEYS = ['mag', 'ord', 'sped', 'daSpedire', 'disponibilita'];

/** Rootstock → clone → variety is the order every availability report uses. */
const byRootstock = (C) => (a, b) =>
  C.compare(a.portainnesto, b.portainnesto) ||
  C.compare(a.clone, b.clone) ||
  C.compare(a.varieta, b.varieta);

/** One subtotal per rootstock, keyed by the rootstock code. */
function rootstockSubtotals(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.portainnesto)) {
      out.set(r.portainnesto, { portainnesto: r.portainnesto, count: 0, ...zero() });
    }
    const t = out.get(r.portainnesto);
    t.count += 1;
    for (const k of METRIC_KEYS) t[k] += r[k];
  }
  return out;
}

function grandTotals(rows) {
  const t = zero();
  for (const r of rows) for (const k of METRIC_KEYS) t[k] += r[k];
  return t;
}

/**
 * Report 1 — flat list of combinations, sorted by rootstock code then clone.
 * The rootstock is a *filter* and a column, not a grouping level: there are no
 * per-rootstock subtotals, only one grand total.
 */
export function reportDisponibilita(filters) {
  // live backend: roles without table access get the aggregate view; staff (who can
  // read the tables) fall through to the shared engine below
  if (store.mode === 'supabase' && store.remote) return reportFromView(filters);
  const C = collator();
  const rows = [...metrics(filters).values()].sort(byRootstock(C));
  return {
    rows,
    subtotals: rootstockSubtotals(rows),
    totals: grandTotals(rows),
    negativeCount: rows.filter((r) => r.disponibilita < 0).length,
    rowCount: rows.length,
  };
}

/**
 * Report 2 — availability split across the 8 growers.
 * `filters.produttore` keeps only the combinations that involve that grower
 * (a warehouse quantity or a commitment attributed to them).
 */
export function reportPerProduttore(filters, growerList) {
  if (store.mode === 'supabase' && store.remote) {
    return { rows: [], subtotals: new Map(), growers: store.meta.produttori,
             totals: { mag: 0, ord: 0, sped: 0, daSpedire: 0, disponibilita: 0,
             per: {}, extra: 0, nonAttr: 0, totaleProduttori: 0 },
             negativeCount: 0, rowCount: 0 };
  }
  const f = filters || {};
  const C = collator();
  const growers = growerList || store.meta.produttori;

  const rows = [];
  for (const e of metrics(f).values()) {
    if (f.produttore) {
      const mag = e.growerMag[f.produttore] || 0;
      const ord = e.growerOrd[f.produttore] || 0;
      if (!mag && !ord) continue;          // this grower has nothing in this combination
    }
    const per = {};
    for (const g of growers) per[g] = (e.growerMag[g] || 0) - (e.growerOrd[g] || 0);
    const extra = (e.growerMag[NON_RICONOSCIUTO] || 0) - (e.growerOrd[NON_RICONOSCIUTO] || 0);
    const nonAttr = (e.growerMag[NON_ATTRIBUITO] || 0) - (e.growerOrd[NON_ATTRIBUITO] || 0);
    const totaleProduttori = growers.reduce((s2, g) => s2 + per[g], 0) + extra + nonAttr;
    rows.push({ ...e, per, extra, nonAttr, totaleProduttori });
  }

  rows.sort(byRootstock(C));

  const totals = { ...zero(), per: {}, extra: 0, nonAttr: 0, totaleProduttori: 0 };
  for (const g of growers) totals.per[g] = 0;

  // the same per-rootstock subtotals as Report 1, grower columns included
  const subtotals = new Map();
  for (const r of rows) {
    if (!subtotals.has(r.portainnesto)) {
      const per = {};
      for (const g of growers) per[g] = 0;
      subtotals.set(r.portainnesto, { portainnesto: r.portainnesto, count: 0,
        ...zero(), per, extra: 0, nonAttr: 0, totaleProduttori: 0 });
    }
    const t = subtotals.get(r.portainnesto);
    t.count += 1;
    for (const k of METRIC_KEYS) t[k] += r[k];
    t.extra += r.extra; t.nonAttr += r.nonAttr; t.totaleProduttori += r.totaleProduttori;
    for (const g of growers) t.per[g] += r.per[g];

    for (const k of METRIC_KEYS) totals[k] += r[k];
    totals.extra += r.extra; totals.nonAttr += r.nonAttr;
    totals.totaleProduttori += r.totaleProduttori;
    for (const g of growers) totals.per[g] += r.per[g];
  }

  const negativeCount = rows.filter((r) =>
    r.disponibilita < 0 || r.nonAttr < 0 || growers.some((x) => r.per[x] < 0)).length;
  return { rows, subtotals, totals, growers, negativeCount, rowCount: rows.length };
}

/* ---- supabase: report 1 from the aggregate view (roles without table access) ---- */
function reportFromView(filters) {
  const f = filters || {};
  const C = collator();
  const rows = (store.remote ? store.remote.rows : [])
    .map((r) => ({
      tipologia: r.tipologia || NON_INDICATA,
      produzione: r.produzione || NON_INDICATA,
      varieta: r.codice_varieta, clone: r.codice_clone, portainnesto: r.codice_portainnesto,
      mag: Number(r.giacenza_magazzino || 0),
      ord: Number(r.totale_ordinato || 0),
      sped: Number(r.di_cui_spedite || 0),
      daSpedire: Number(r.quantita_da_spedire || 0),
      disponibilita: Number(r.disponibilita_residua || 0),
    }))
    .filter((r) => !f.tipologia || r.tipologia === f.tipologia)
    .filter((r) => !f.produzione || r.produzione === f.produzione)
    .filter((r) => !f.varieta || r.varieta === f.varieta)
    .filter((r) => !f.portainnesto || r.portainnesto === f.portainnesto)
    .sort(byRootstock(C));

  return {
    rows,
    subtotals: rootstockSubtotals(rows),
    totals: grandTotals(rows),
    negativeCount: rows.filter((r) => r.disponibilita < 0).length,
    rowCount: rows.length,
  };
}

/**
 * Report 5 — what *one* producer put into the warehouse, with the commitments
 * placed against those lots. Same columns and same per-rootstock subtotals as
 * Report 1; `grower` comes from the session (live: filtered by the view itself).
 */
export function reportMessoADisposizione(filters, grower) {
  const f = filters || {};
  const C = collator();
  let rows;

  if (store.mode === 'supabase' && store.remote) {
    rows = (store.remote.messo || [])
      .map((r) => ({
        tipologia: r.tipologia || NON_INDICATA,
        produzione: r.produzione || NON_INDICATA,
        varieta: r.codice_varieta, clone: r.codice_clone, portainnesto: r.codice_portainnesto,
        mag: Number(r.quantita_magazzino || 0),
        ord: Number(r.quantita_ordinata || 0),
        sped: Number(r.quantita_spedita || 0),
        daSpedire: Number(r.quantita_ordinata || 0) - Number(r.quantita_spedita || 0),
        disponibilita: Number(r.quantita_magazzino || 0) - Number(r.quantita_ordinata || 0),
      }));
  } else {
    rows = [];
    if (grower) {
      for (const e of metrics(f).values()) {
        const mag = e.growerMag[grower] || 0;
        const ord = e.growerOrd[grower] || 0;
        const sped = e.growerSped[grower] || 0;
        if (!mag && !ord && !sped) continue;   // nothing made available here
        rows.push({
          tipologia: e.tipologia, produzione: e.produzione, varieta: e.varieta,
          clone: e.clone, portainnesto: e.portainnesto,
          mag, ord, sped, daSpedire: ord - sped, disponibilita: mag - ord,
        });
      }
    }
  }

  rows = rows
    .filter((r) => !f.tipologia || r.tipologia === f.tipologia)
    .filter((r) => !f.produzione || r.produzione === f.produzione)
    .filter((r) => !f.varieta || r.varieta === f.varieta)
    .filter((r) => !f.portainnesto || r.portainnesto === f.portainnesto)
    .sort(byRootstock(C));

  return {
    rows,
    grower: grower || null,
    subtotals: rootstockSubtotals(rows),
    totals: grandTotals(rows),
    negativeCount: rows.filter((r) => r.disponibilita < 0).length,
    rowCount: rows.length,
  };
}

/** Report 3 — shortages only, grouped by rootstock (like Report 1). */
export function reportIndisponibilita(filters) {
  const f = filters || {};
  const C = collator();
  let rows;

  if (store.mode === 'supabase' && store.remote) {
    rows = store.remote.negative
      .map((r) => ({
        tipologia: r.tipologia || NON_INDICATA, produzione: r.produzione || NON_INDICATA,
        varieta: r.codice_varieta, clone: r.codice_clone, portainnesto: r.codice_portainnesto,
        mag: Number(r.quantita_magazzino || 0), ord: Number(r.quantita_impegnata || 0),
        disponibilita: Number(r.disponibilita_effettiva || 0),
        deficit: Math.abs(Number(r.disponibilita_effettiva || 0)),
      }));
  } else {
    rows = [...metrics(filters).values()]
      .filter((e) => e.disponibilita < 0)
      .map((e) => ({ ...e, deficit: e.ord - e.mag }));
  }

  rows = rows
    .filter((r) => !f.tipologia || r.tipologia === f.tipologia)
    .filter((r) => !f.produzione || r.produzione === f.produzione)
    .filter((r) => !f.varieta || r.varieta === f.varieta)
    .filter((r) => !f.portainnesto || r.portainnesto === f.portainnesto)
    .sort(byRootstock(C));

  const subtotals = new Map();
  for (const r of rows) {
    if (!subtotals.has(r.portainnesto)) {
      subtotals.set(r.portainnesto, { portainnesto: r.portainnesto, count: 0,
        mag: 0, ord: 0, deficit: 0 });
    }
    const t = subtotals.get(r.portainnesto);
    t.count += 1; t.mag += r.mag; t.ord += r.ord; t.deficit += r.deficit;
  }
  const deficitTot = rows.reduce((s2, r) => s2 + r.deficit, 0);
  return { rows, subtotals, count: rows.length, deficitTot };
}

/** Report 4 — commitments still to be shipped (spedito = false). */
export function reportDaSpedire(filters) {
  if (store.mode === 'supabase' && store.remote) return { rows: [], totals: { quantita: 0 }, rowCount: 0 };
  const f = filters || {};
  const C = collator();
  const rows = store.ordini
    .filter((o) => !o.spedito && passes(o, f))
    .map((o) => {
      const lot = o.id_magazzino ? store.index.lotById.get(o.id_magazzino) : null;
      return {
        id: o.id,
        id_magazzino: o.id_magazzino,
        lotLabel: lot ? `${lot.produttore || '—'} · ${lot.anno}` : null,
        produttore: lot ? (lot.produttore || null) : null,
        tipologia: o.tipologia || NON_INDICATA,
        produzione: o.produzione || NON_INDICATA,
        varieta: o.varieta, clone: o.clone, portainnesto: o.portainnesto,
        quantita: o.quantita, note: o.note,
      };
    })
    .sort((a, b) => C.compare(a.portainnesto, b.portainnesto) ||
                    C.compare(a.clone, b.clone) ||
                    C.compare(a.varieta, b.varieta));
  const totals = { quantita: rows.reduce((s2, r) => s2 + r.quantita, 0) };
  return { rows, totals, rowCount: rows.length };
}

/** KPI summary + recent activity for the home screen. */
export function summary() {
  if (store.mode === 'supabase' && store.remote) {
    const r1 = reportDisponibilita({});
    const lots = store.remote.lots || [];
    const ultimi = lots.slice(0, 5).map((l) => ({
      anno: l.anno_conferimento, produttore: null, varieta: l.codice_varieta,
      clone: l.codice_clone, portainnesto: l.codice_portainnesto, quantita: l.quantita,
    }));
    const neg = reportIndisponibilita({});
    return {
      disponibilita: r1.totals.disponibilita, giacenza: r1.totals.mag, ordinato: r1.totals.ord,
      daSpedire: 0, negativeCount: neg.count, lotti: lots.length, ordiniNonSpediti: 0,
      ultimiLotti: ultimi, topNegativi: neg.rows.slice(0, 5),
    };
  }
  const { totals, negativeCount } = reportDisponibilita({});
  const ultimi = [...store.lotti].slice().reverse().slice(0, 5);
  const top = reportIndisponibilita({}).rows.slice(0, 5);
  return {
    disponibilita: totals.disponibilita,
    giacenza: totals.mag,
    ordinato: totals.ord,
    daSpedire: totals.daSpedire,
    negativeCount,
    lotti: store.lotti.length,
    ordiniNonSpediti: store.ordini.filter((o) => !o.spedito).length,
    ultimiLotti: ultimi,
    topNegativi: top,
  };
}

/* ---------------------------------------------------------- validation */
export function validateLotto(v) {
  const errs = {};
  if (!v.anno || !/^\d{4}$/.test(String(v.anno))) errs.anno = 'Indica un anno a 4 cifre.';
  if (!v.produttore) errs.produttore = 'Seleziona il produttore.';
  else if (!store.meta.produttori.includes(v.produttore)) errs.produttore = 'Produttore non riconosciuto.';
  if (!v.tipologia) errs.tipologia = 'Seleziona la tipologia.';
  if (!v.produzione) errs.produzione = 'Seleziona la produzione.';
  if (!v.varieta) errs.varieta = 'Seleziona la varietà.';
  else if (!store.index.clonesByVariety.has(v.varieta)) {
    errs.varieta = 'Varietà non presente in anagrafica_vite.';
  }
  if (!v.clone) errs.clone = 'Seleziona il clone.';
  else if (v.varieta && !clonesOf(v.varieta).includes(v.clone)) {
    errs.clone = 'Il clone non appartiene alla varietà selezionata.';
  }
  if (!v.portainnesto) errs.portainnesto = 'Seleziona il portainnesto.';
  else if (!store.index.rootstocks.includes(v.portainnesto)) {
    errs.portainnesto = 'Portainnesto non presente in anagrafica_portainnesto.';
  }
  if (v.quantita === '' || v.quantita == null) errs.quantita = 'Indica la quantità.';
  else if (!Number.isInteger(Number(v.quantita)) || Number(v.quantita) < 0) {
    errs.quantita = 'La quantità deve essere un intero ≥ 0.';
  }
  return errs;
}

export function validateOrdine(v) {
  const errs = {};
  if (!v.tipologia) errs.tipologia = 'Seleziona la tipologia.';
  if (!v.produzione) errs.produzione = 'Seleziona la produzione.';
  if (!v.varieta) errs.varieta = 'Seleziona la varietà.';
  else if (!store.index.clonesByVariety.has(v.varieta)) {
    errs.varieta = 'Varietà non presente in anagrafica_vite.';
  }
  if (!v.clone) errs.clone = 'Seleziona il clone.';
  else if (v.varieta && !clonesOf(v.varieta).includes(v.clone)) {
    errs.clone = 'Il clone non appartiene alla varietà selezionata.';
  }
  if (!v.portainnesto) errs.portainnesto = 'Seleziona il portainnesto.';
  else if (!store.index.rootstocks.includes(v.portainnesto)) {
    errs.portainnesto = 'Portainnesto non presente in anagrafica_portainnesto.';
  }
  if (v.quantita === '' || v.quantita == null) errs.quantita = 'Indica la quantità.';
  else if (!Number.isInteger(Number(v.quantita)) || Number(v.quantita) < 1) {
    errs.quantita = 'La quantità deve essere un intero ≥ 1.';
  }
  return errs;
}

/** F-V10: warn (never block) when an order pushes a key below zero. */
export function availabilityImpact(o) {
  const m = metrics({ tipologia: o.tipologia, produzione: o.produzione, varieta: o.varieta });
  const key = [o.tipologia, o.produzione, o.varieta, o.clone, o.portainnesto].join('\u0001');
  const e = m.get(key);
  const before = e ? e.disponibilita : 0;
  const after = before - Number(o.quantita || 0);
  return { before, after };
}

/* ------------------------------------------------------------ mutations */
const key = (v, c) => v + '\u0001' + c;

/** Usage counts (referential checks before delete/rename). */
export function usageOfPair(varieta, clone) {
  return store.lotti.filter((l) => l.varieta === varieta && l.clone === clone).length +
         store.ordini.filter((o) => o.varieta === varieta && o.clone === clone).length;
}
export function usageOfRootstock(code) {
  return store.lotti.filter((l) => l.portainnesto === code).length +
         store.ordini.filter((o) => o.portainnesto === code).length;
}
export function ordersOfLotto(id) {
  return store.ordini.filter((o) => o.id_magazzino === id);
}

/* ---- lotti ---- */
const lotFromForm = (v) => ({
  anno: Number(v.anno), produttore: v.produttore, tipologia: v.tipologia,
  produzione: v.produzione, varieta: v.varieta, clone: v.clone,
  portainnesto: v.portainnesto, quantita: Number(v.quantita),
  note: v.note || null,
});

export function addLotto(v) {
  const e = readEdits();
  const lot = { id: 'lot-local-' + Date.now(), ...lotFromForm(v), local: true };
  e.lotti.added.push(lot);
  writeEdits(e);
  store.lotti.push(lot);
  rebuild();
  return lot;
}

export function updateLotto(id, v) {
  const e = readEdits();
  const patch = lotFromForm(v);
  const added = e.lotti.added.find((r) => r.id === id);
  if (added) Object.assign(added, patch);
  else e.lotti.updated[id] = { ...(e.lotti.updated[id] || {}), ...patch };
  writeEdits(e);
  const row = store.lotti.find((r) => r.id === id);
  if (row) Object.assign(row, patch);
  rebuild();
  return row;
}

/** Deleting a lot that an order points at would orphan that order. */
export function deleteLotto(id) {
  const refs = ordersOfLotto(id);
  if (refs.length) {
    return { ok: false, error: `Impossibile eliminare: ${refs.length} impegno/i puntano a questo lotto.` };
  }
  const e = readEdits();
  const i = e.lotti.added.findIndex((r) => r.id === id);
  if (i >= 0) e.lotti.added.splice(i, 1);
  else { delete e.lotti.updated[id]; e.lotti.removed.push(id); }
  writeEdits(e);
  store.lotti = store.lotti.filter((r) => r.id !== id);
  rebuild();
  return { ok: true };
}

/* ---- ordini ---- */
const ordineFromForm = (v) => ({
  id_magazzino: v.id_magazzino || null,
  tipologia: v.tipologia, produzione: v.produzione, varieta: v.varieta,
  clone: v.clone, portainnesto: v.portainnesto,
  quantita: Number(v.quantita), note: v.note || null,
});

export function addOrdine(v) {
  const e = readEdits();
  const ord = {
    id: 'ord-local-' + Date.now(), ...ordineFromForm(v),
    spedito: !!v.spedito, local: true,
  };
  e.ordini.added.push(ord);
  writeEdits(e);
  store.ordini.push(ord);
  rebuild();
  return ord;
}

export function updateOrdine(id, v) {
  const e = readEdits();
  const patch = { ...ordineFromForm(v) };
  if (v.spedito !== undefined) patch.spedito = !!v.spedito;
  const added = e.ordini.added.find((r) => r.id === id);
  if (added) Object.assign(added, patch);
  else e.ordini.updated[id] = { ...(e.ordini.updated[id] || {}), ...patch };
  delete e.spedito[id];
  writeEdits(e);
  const row = store.ordini.find((r) => r.id === id);
  if (row) Object.assign(row, patch);
  rebuild();
  return row;
}

export function deleteOrdine(id) {
  const e = readEdits();
  const i = e.ordini.added.findIndex((r) => r.id === id);
  if (i >= 0) e.ordini.added.splice(i, 1);
  else { delete e.ordini.updated[id]; e.ordini.removed.push(id); }
  delete e.spedito[id];
  writeEdits(e);
  store.ordini = store.ordini.filter((r) => r.id !== id);
  rebuild();
  return { ok: true };
}

export function toggleSpedito(id, value) {
  const o = store.ordini.find((x) => x.id === id);
  if (!o) return null;
  const prev = o.spedito;
  o.spedito = typeof value === 'boolean' ? value : !o.spedito;
  const e = readEdits();
  const added = e.ordini.added.find((r) => r.id === id);
  if (added) added.spedito = o.spedito;
  else e.spedito[id] = o.spedito;
  writeEdits(e);
  return { ordine: o, prev };
}

/* ---- anagrafica vite (una riga = coppia varietà+clone) ---- */
export function addVitiPair(varieta, clone) {
  const v = String(varieta || '').trim(), c = String(clone || '').trim();
  if (!v || !c) return { ok: false, error: 'Varietà e clone sono obbligatori.' };
  if (store.viti.some((x) => key(x.varieta.toLowerCase(), x.clone.toLowerCase()) === key(v.toLowerCase(), c.toLowerCase()))) {
    return { ok: false, error: 'La coppia varietà/clone esiste già.' };
  }
  const e = readEdits();
  e.viti.added.push({ varieta: v, clone: c });
  writeEdits(e);
  store.viti.push({ varieta: v, clone: c });
  rebuild();
  return { ok: true, pair: { varieta: v, clone: c } };
}

export function updateVitiPair(from, to) {
  const v = String(to.varieta || '').trim(), c = String(to.clone || '').trim();
  if (!v || !c) return { ok: false, error: 'Varietà e clone sono obbligatori.' };
  const used = usageOfPair(from.varieta, from.clone);
  if (used) {
    return { ok: false, error: `Non modificabile: ${used} record usano questa coppia.` };
  }
  const dup = store.viti.find((x) =>
    key(x.varieta.toLowerCase(), x.clone.toLowerCase()) === key(v.toLowerCase(), c.toLowerCase()) &&
    !(x.varieta === from.varieta && x.clone === from.clone));
  if (dup) return { ok: false, error: 'Esiste già una coppia con questi codici.' };
  const e = readEdits();
  const i = e.viti.added.findIndex((x) => x.varieta === from.varieta && x.clone === from.clone);
  if (i >= 0) e.viti.added[i] = { varieta: v, clone: c };
  else {
    e.viti.removed.push({ varieta: from.varieta, clone: from.clone });
    e.viti.added.push({ varieta: v, clone: c });
  }
  writeEdits(e);
  const row = store.viti.find((x) => x.varieta === from.varieta && x.clone === from.clone);
  if (row) { row.varieta = v; row.clone = c; }
  rebuild();
  return { ok: true, pair: { varieta: v, clone: c } };
}

export function deleteVitiPair(varieta, clone) {
  const used = usageOfPair(varieta, clone);
  if (used) return { ok: false, error: `Impossibile eliminare: ${used} record usano questa coppia.` };
  const e = readEdits();
  const i = e.viti.added.findIndex((x) => x.varieta === varieta && x.clone === clone);
  if (i >= 0) e.viti.added.splice(i, 1);
  else e.viti.removed.push({ varieta, clone });
  writeEdits(e);
  store.viti = store.viti.filter((x) => !(x.varieta === varieta && x.clone === clone));
  rebuild();
  return { ok: true };
}

/* ---- anagrafica portainnesto ---- */
export function addPortainnesto(code) {
  const c = String(code || '').trim();
  if (!c) return { ok: false, error: 'Il codice è obbligatorio.' };
  if (store.portainnesti.some((x) => x.toLowerCase() === c.toLowerCase())) {
    return { ok: false, error: 'Il portainnesto esiste già.' };
  }
  const e = readEdits();
  e.portainnesti.added.push(c);
  writeEdits(e);
  store.portainnesti.push(c);
  rebuild();
  return { ok: true, code: c };
}

export function renamePortainnesto(from, to) {
  const c = String(to || '').trim();
  if (!c) return { ok: false, error: 'Il codice è obbligatorio.' };
  const used = usageOfRootstock(from);
  if (used) return { ok: false, error: `Non modificabile: ${used} record usano questo portainnesto.` };
  if (store.portainnesti.some((x) => x.toLowerCase() === c.toLowerCase() && x !== from)) {
    return { ok: false, error: 'Esiste già un portainnesto con questo codice.' };
  }
  const e = readEdits();
  const i = e.portainnesti.added.indexOf(from);
  if (i >= 0) e.portainnesti.added[i] = c;
  else {
    e.portainnesti.removed.push(from);
    e.portainnesti.added.push(c);
  }
  writeEdits(e);
  const j = store.portainnesti.indexOf(from);
  if (j >= 0) store.portainnesti[j] = c; else store.portainnesti.push(c);
  rebuild();
  return { ok: true, code: c };
}

export function deletePortainnesto(code) {
  const used = usageOfRootstock(code);
  if (used) return { ok: false, error: `Impossibile eliminare: ${used} record usano questo portainnesto.` };
  const e = readEdits();
  const i = e.portainnesti.added.indexOf(code);
  if (i >= 0) e.portainnesti.added.splice(i, 1);
  else e.portainnesti.removed.push(code);
  writeEdits(e);
  store.portainnesti = store.portainnesti.filter((x) => x !== code);
  rebuild();
  return { ok: true };
}

/* ------------------------------------------------------------- CSV out */
export function toCSV(headers, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(';')].concat(rows.map((r) => r.map(esc).join(';'))).join('\r\n');
}

export function download(filename, text, mime) {
  const blob = new Blob(['\ufeff' + text], { type: (mime || 'text/csv') + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
