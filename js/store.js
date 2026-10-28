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

export const NON_INDICATA = '(non indicata)';
export const NON_ATTRIBUITO = 'Non attribuito';
export const NON_RICONOSCIUTO = 'Non riconosciuto';

const EDITS_KEY = 'vignero.edits.v1';

export const store = {
  meta: {
    tipologie: ['Barbatelle innestate', 'Barbatelle selvatiche', 'Vasetti', 'Barbatelloni'],
    produzioni: ['Nuova produzione', 'Ripiantato', 'Frigoconservato'],
    produttori: ['Mori Marco', 'Donati', 'Agriserv', 'Vivai riuniti', 'Bianchi',
                 'Golferenzo', 'Lorin', 'Esterno'],
  },
  viti: [],          // [{varieta, clone}]
  portainnesti: [],  // [code]
  lotti: [],         // [{id, anno, produttore, tipologia, produzione, varieta, clone, portainnesto, quantita, note, local}]
  ordini: [],        // [{id, id_magazzino, tipologia, produzione, varieta, clone, portainnesto, quantita, spedito, note, local}]
  index: { varieta: [], clonesByVariety: new Map(), rootstocks: [], lotById: new Map() },
  ready: false,
};

/* ---------------------------------------------------------------- edits */
function readEdits() {
  try { return JSON.parse(localStorage.getItem(EDITS_KEY)) || {}; }
  catch { return {}; }
}
function writeEdits(e) {
  try { localStorage.setItem(EDITS_KEY, JSON.stringify(e)); } catch { /* private mode */ }
}
export function hasLocalEdits() {
  const e = readEdits();
  return !!(e.lotti?.length || e.ordini?.length || e.viti?.length ||
            e.portainnesti?.length || Object.keys(e.spedito || {}).length);
}
export function resetLocalEdits() {
  try { localStorage.removeItem(EDITS_KEY); } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- load */
export async function init() {
  const res = await fetch('data/snapshot.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('snapshot non disponibile (' + res.status + ')');
  loadFromSnapshot(await res.json());
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
  if (e.spedito) {
    store.ordini.forEach((o) => {
      if (Object.prototype.hasOwnProperty.call(e.spedito, o.id)) o.spedito = !!e.spedito[o.id];
    });
  }
  (e.lotti || []).forEach((l) => store.lotti.push({ ...l, local: true }));
  (e.ordini || []).forEach((o) => store.ordini.push({ ...o, local: true }));
  (e.viti || []).forEach((v) => {
    if (!store.viti.some((x) => x.varieta === v.varieta && x.clone === v.clone)) store.viti.push(v);
  });
  (e.portainnesti || []).forEach((c) => {
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
  return true;
}

function growerBuckets() {
  const b = {};
  for (const g of store.meta.produttori) b[g] = 0;
  b[NON_ATTRIBUITO] = 0;
  b[NON_RICONOSCIUTO] = 0;
  return b;
}

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
        growerMag: growerBuckets(), growerOrd: growerBuckets(),
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
  }
  for (const e of acc.values()) {
    e.daSpedire = e.ord - e.sped;
    e.disponibilita = e.mag - e.ord;
  }
  return acc;
}

const zero = () => ({ mag: 0, ord: 0, sped: 0, daSpedire: 0, disponibilita: 0 });

/** Report 1 — grouped by rootstock, one row per clone, per-rootstock subtotals. */
export function reportDisponibilita(filters) {
  const m = metrics(filters);
  const C = collator();
  const groups = new Map();
  for (const e of m.values()) {
    if (!groups.has(e.portainnesto)) {
      groups.set(e.portainnesto, { portainnesto: e.portainnesto, rows: [], sub: zero(), negative: false });
    }
    groups.get(e.portainnesto).rows.push(e);
  }
  const out = [...groups.values()].sort((a, b) => C.compare(a.portainnesto, b.portainnesto));
  for (const g of out) {
    g.rows.sort((a, b) => C.compare(a.clone, b.clone) || C.compare(a.varieta, b.varieta));
    for (const r of g.rows) {
      for (const k of ['mag', 'ord', 'sped', 'daSpedire', 'disponibilita']) g.sub[k] += r[k];
    }
    g.negative = g.rows.some((r) => r.disponibilita < 0);
  }
  const totals = out.reduce((t, g) => {
    for (const k of ['mag', 'ord', 'sped', 'daSpedire', 'disponibilita']) t[k] += g.sub[k];
    return t;
  }, zero());
  const negativeCount = out.reduce((n, g) => n + g.rows.filter((r) => r.disponibilita < 0).length, 0);
  return { groups: out, totals, negativeCount, rowCount: out.reduce((n, g) => n + g.rows.length, 0) };
}

/** Report 2 — availability split across the 8 growers, plus unattributed. */
export function reportPerProduttore(filters, growerList) {
  const m = metrics(filters);
  const C = collator();
  const growers = growerList || store.meta.produttori;
  const groups = new Map();
  for (const e of m.values()) {
    if (!groups.has(e.portainnesto)) {
      groups.set(e.portainnesto, { portainnesto: e.portainnesto, rows: [], sub: null });
    }
    const per = {};
    for (const g of growers) per[g] = (e.growerMag[g] || 0) - (e.growerOrd[g] || 0);
    const extra = (e.growerMag[NON_RICONOSCIUTO] || 0) - (e.growerOrd[NON_RICONOSCIUTO] || 0);
    const nonAttr = (e.growerMag[NON_ATTRIBUITO] || 0) - (e.growerOrd[NON_ATTRIBUITO] || 0);
    const totaleProduttori = growers.reduce((s, g) => s + per[g], 0) + extra + nonAttr;
    groups.get(e.portainnesto).rows.push({
      ...e, per, extra, nonAttr, totaleProduttori,
    });
  }
  const out = [...groups.values()].sort((a, b) => C.compare(a.portainnesto, b.portainnesto));
  const blankSub = () => {
    const s = { mag: 0, ord: 0, sped: 0, daSpedire: 0, disponibilita: 0, per: {},
                extra: 0, nonAttr: 0, totaleProduttori: 0 };
    for (const g of growers) s.per[g] = 0;
    return s;
  };
  for (const g of out) {
    g.rows.sort((a, b) => C.compare(a.clone, b.clone) || C.compare(a.varieta, b.varieta));
    g.sub = blankSub();
    for (const r of g.rows) {
      g.sub.mag += r.mag; g.sub.ord += r.ord; g.sub.sped += r.sped;
      g.sub.daSpedire += r.daSpedire; g.sub.disponibilita += r.disponibilita;
      g.sub.extra += r.extra; g.sub.nonAttr += r.nonAttr;
      g.sub.totaleProduttori += r.totaleProduttori;
      for (const gr of growers) g.sub.per[gr] += r.per[gr];
    }
  }
  const totals = blankSub();
  for (const g of out) {
    totals.mag += g.sub.mag; totals.ord += g.sub.ord; totals.sped += g.sub.sped;
    totals.daSpedire += g.sub.daSpedire; totals.disponibilita += g.sub.disponibilita;
    totals.extra += g.sub.extra; totals.nonAttr += g.sub.nonAttr;
    totals.totaleProduttori += g.sub.totaleProduttori;
    for (const gr of growers) totals.per[gr] += g.sub.per[gr];
  }
  const negativeCount = out.reduce((n, g) =>
    n + g.rows.filter((r) => r.disponibilita < 0 || growers.some((x) => r.per[x] < 0)).length, 0);
  return { groups: out, totals, growers, negativeCount };
}

/** Report 3 — shortages only, sorted varietà → portainnesto → clone. */
export function reportIndisponibilita(filters) {
  const m = metrics(filters);
  const C = collator();
  const rows = [...m.values()]
    .filter((e) => e.disponibilita < 0)
    .map((e) => ({ ...e, deficit: e.ord - e.mag }))
    .sort((a, b) => C.compare(a.varieta, b.varieta) ||
                    C.compare(a.portainnesto, b.portainnesto) ||
                    C.compare(a.clone, b.clone));
  const deficitTot = rows.reduce((s, r) => s + r.deficit, 0);
  return { rows, count: rows.length, deficitTot };
}

/** KPI summary + recent activity for the home screen. */
export function summary() {
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
export function addLotto(v) {
  const e = readEdits();
  const lot = {
    id: 'lot-local-' + Date.now(),
    anno: Number(v.anno), produttore: v.produttore, tipologia: v.tipologia,
    produzione: v.produzione, varieta: v.varieta, clone: v.clone,
    portainnesto: v.portainnesto, quantita: Number(v.quantita),
    note: v.note || null, local: true,
  };
  (e.lotti = e.lotti || []).push(lot);
  writeEdits(e);
  store.lotti.push(lot);
  rebuild();
  return lot;
}

export function addOrdine(v) {
  const e = readEdits();
  const ord = {
    id: 'ord-local-' + Date.now(),
    id_magazzino: v.id_magazzino || null,
    tipologia: v.tipologia, produzione: v.produzione, varieta: v.varieta,
    clone: v.clone, portainnesto: v.portainnesto,
    quantita: Number(v.quantita), spedito: !!v.spedito, note: v.note || null,
    local: true,
  };
  (e.ordini = e.ordini || []).push(ord);
  writeEdits(e);
  store.ordini.push(ord);
  rebuild();
  return ord;
}

export function toggleSpedito(id, value) {
  const o = store.ordini.find((x) => x.id === id);
  if (!o) return null;
  const prev = o.spedito;
  o.spedito = typeof value === 'boolean' ? value : !o.spedito;
  const e = readEdits();
  e.spedito = e.spedito || {};
  e.spedito[id] = o.spedito;
  writeEdits(e);
  return { ordine: o, prev };
}

export function addVitiPair(varieta, clone) {
  const v = varieta.trim(), c = clone.trim();
  if (!v || !c) return { ok: false, error: 'Varietà e clone sono obbligatori.' };
  if (store.viti.some((x) => x.varieta.toLowerCase() === v.toLowerCase() &&
                             x.clone.toLowerCase() === c.toLowerCase())) {
    return { ok: false, error: 'La coppia varietà/clone esiste già.' };
  }
  const e = readEdits();
  (e.viti = e.viti || []).push({ varieta: v, clone: c });
  writeEdits(e);
  store.viti.push({ varieta: v, clone: c });
  rebuild();
  return { ok: true };
}

export function addPortainnesto(code) {
  const c = code.trim();
  if (!c) return { ok: false, error: 'Il codice è obbligatorio.' };
  if (store.portainnesti.some((x) => x.toLowerCase() === c.toLowerCase())) {
    return { ok: false, error: 'Il portainnesto esiste già.' };
  }
  const e = readEdits();
  (e.portainnesti = e.portainnesti || []).push(c);
  writeEdits(e);
  store.portainnesti.push(c);
  rebuild();
  return { ok: true };
}

/** Usage count for a variety/clone pair or a rootstock (referential check). */
export function usageOfPair(varieta, clone) {
  return store.lotti.filter((l) => l.varieta === varieta && l.clone === clone).length +
         store.ordini.filter((o) => o.varieta === varieta && o.clone === clone).length;
}
export function usageOfRootstock(code) {
  return store.lotti.filter((l) => l.portainnesto === code).length +
         store.ordini.filter((o) => o.portainnesto === code).length;
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
