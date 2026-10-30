/* Vignero · engine.test.mjs — invariants on the published snapshot.
 * Run: node tests/engine.test.mjs
 */
import fs from 'node:fs';
import {
  loadFromSnapshot, reportDisponibilita, reportIndisponibilita, reportPerProduttore,
  reportDaSpedire, reportMessoADisposizione, validateLotto, validateOrdine, clonesOf,
  summary, store, subtotalKey,
  addLotto, updateLotto, deleteLotto, addOrdine, updateOrdine, deleteOrdine,
  addVitiPair, updateVitiPair, deleteVitiPair, addPortainnesto, renamePortainnesto,
  deletePortainnesto, usageOfPair, usageOfRootstock,
} from '../js/store.js';

const snap = JSON.parse(fs.readFileSync(new URL('../data/snapshot.json', import.meta.url), 'utf8'));
loadFromSnapshot(snap);

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) { pass++; } else { fail++; console.error('  FAIL ' + what); } };
const near = (a, b, what) => ok(Number(a) === Number(b), `${what} (${a} !== ${b})`);

/* ---------- shape ---------- */
ok(store.lotti.length > 0, 'lots loaded');
ok(store.ordini.length > 0, 'orders loaded');
ok(store.index.varieta.length > 100, 'variety index built');
ok(store.index.rootstocks.length > 0, 'rootstock index built');
ok(store.meta.produttori.length === 8, 'eight growers configured');

/* ---------- report 1 ---------- */
const r1 = reportDisponibilita({});
ok(Array.isArray(r1.rows) && r1.rows.length > 0, 'report 1 returns a flat list of rows');
ok(r1.groups === undefined, 'report 1 is no longer grouped by rootstock');
let rows = 0, negRows = 0;
let sumDisp = 0, sumMag = 0, sumOrd = 0, sumSped = 0, sumDaSped = 0;
for (const r of r1.rows) {
  rows++;
  near(r.daSpedire, r.ord - r.sped, 'daSpedire = ordinato - spedito');
  near(r.disponibilita, r.mag - r.ord, 'disponibilita = magazzino - ordinato');
  if (r.disponibilita < 0) negRows++;
  sumMag += r.mag; sumOrd += r.ord; sumSped += r.sped;
  sumDaSped += r.daSpedire; sumDisp += r.disponibilita;
}
near(r1.totals.mag, sumMag, 'grand total magazzino = sum of rows');
near(r1.totals.ord, sumOrd, 'grand total ordinato = sum of rows');
near(r1.totals.sped, sumSped, 'grand total spedito = sum of rows');
near(r1.totals.daSpedire, sumDaSped, 'grand total da spedire = sum of rows');
near(r1.totals.disponibilita, sumDisp, 'grand total disponibilità = sum of rows');
near(r1.negativeCount, negRows, 'negativeCount = rows with disponibilità < 0');
near(r1.rowCount, rows, 'rowCount matches the rendered rows');

/* ordering: rootstock code, then variety, then clone (keeps the groups together) */
const C = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
const ordered = (rows) => rows.every((r, i) => i === 0 ||
  C.compare(rows[i - 1].portainnesto, r.portainnesto) < 0 ||
  (rows[i - 1].portainnesto === r.portainnesto &&
   (C.compare(rows[i - 1].varieta, r.varieta) < 0 ||
    (rows[i - 1].varieta === r.varieta && C.compare(rows[i - 1].clone, r.clone) <= 0))));
ok(ordered(r1.rows), 'rows sorted by rootstock, variety, then clone');

/* ---------- report 1: per-rootstock subtotals ---------- */
{
  const groups = new Set(r1.rows.map((r) => subtotalKey(r)));
  near(r1.subtotals.size, groups.size, 'one subtotal per (rootstock, variety) group');
  let sumSubs = 0;
  for (const [key, t] of r1.subtotals) {
    const rowsOfGroup = r1.rows.filter((r) => subtotalKey(r) === key);
    near(t.count, rowsOfGroup.length, `subtotal count for ${t.portainnesto}`);
    near(t.mag, rowsOfGroup.reduce((a, b) => a + b.mag, 0), `subtotal magazzino ${t.portainnesto}`);
    near(t.ord, rowsOfGroup.reduce((a, b) => a + b.ord, 0), `subtotal ordinato ${t.portainnesto}`);
    near(t.sped, rowsOfGroup.reduce((a, b) => a + b.sped, 0), `subtotal spedito ${t.portainnesto}`);
    near(t.disponibilita, rowsOfGroup.reduce((a, b) => a + b.disponibilita, 0),
      `subtotal disponibilità ${t.portainnesto}`);
    ok(rowsOfGroup.every((r) => r.varieta === t.varieta && r.portainnesto === t.portainnesto),
       'a subtotal never mixes varieties: ' + t.varieta);
    sumSubs += t.disponibilita;
  }
  near(sumSubs, r1.totals.disponibilita, 'the subtotals add up to the grand total');
}

/* ---------- report 4: da spedire ---------- */
{
  const rd = reportDaSpedire({
    tipologia: store.meta.tipologiaDefault || 'Barbatelle innestate',
    produzione: store.meta.produzioneDefault || 'Nuova produzione',
  });
  ok(rd.rows.length > 0, 'da spedire returns the open commitments');
  ok(rd.rows.every((r) => store.ordini.find((o) => o.id === r.id)?.spedito === false),
     'only commitments not yet shipped');
  near(rd.totals.quantita, rd.rows.reduce((a, r) => a + r.quantita, 0), 'da spedire total = sum of rows');
  near(rd.rowCount, rd.rows.length, 'da spedire rowCount');
  ok(rd.rows.every((r) => r.tipologia === 'Barbatelle innestate' && r.produzione === 'Nuova produzione'),
     'da spedire honours the filters');
  const all = reportDaSpedire({});
  ok(all.rows.length >= rd.rows.length, 'unfiltered da spedire is at least as large');
}

/* ---------- report 2 ---------- */
const r2 = reportPerProduttore({});
ok(Array.isArray(r2.rows) && r2.rows.length > 0, 'report 2 returns a flat list');
ok(r2.groups === undefined, 'report 2 is no longer grouped by rootstock');
let r2rows = 0;
for (const r of r2.rows) {
  r2rows++;
  const sumG = r2.growers.reduce((s2, n) => s2 + r.per[n], 0) + r.nonAttr + r.extra;
  near(sumG, r.totaleProduttori, 'grower columns sum to Tot. produttori');
  near(r.totaleProduttori, r.disponibilita, 'Tot. produttori = disponibilità');
  near(r.daSpedire, r.ord - r.sped, 'report 2: daSpedire = ordinato - spedito');
}
near(r2rows, r1.rows.length, 'report 2 covers the same keys as report 1');
near(r2.totals.totaleProduttori, r1.totals.disponibilita, 'report 2 grand total = report 1 total');
near(r2.rowCount, r2rows, 'report 2 rowCount matches the rows');
{
  // report 2 carries the same subtotals as report 1 (one per rootstock+variety), grower columns included
  const groups = new Set(r2.rows.map((r) => subtotalKey(r)));
  near(r2.subtotals.size, groups.size, 'report 2: one subtotal per (rootstock, variety) group');
  let sumSubs = 0;
  for (const [key, t] of r2.subtotals) {
    const rowsOfGroup = r2.rows.filter((r) => subtotalKey(r) === key);
    near(t.mag, rowsOfGroup.reduce((a, b) => a + b.mag, 0), `report 2 subtotal magazzino ${t.portainnesto}`);
    near(t.disponibilita, rowsOfGroup.reduce((a, b) => a + b.disponibilita, 0),
      `report 2 subtotal disponibilità ${t.portainnesto}`);
    for (const g of r2.growers) {
      near(t.per[g], rowsOfGroup.reduce((a, b) => a + b.per[g], 0),
        `report 2 subtotal ${g} on ${t.portainnesto} (${t.varieta})`);
    }
    sumSubs += t.disponibilita;
  }
  near(sumSubs, r2.totals.disponibilita, 'report 2: the subtotals add up to the grand total');
}
ok(ordered(r2.rows), 'report 2 sorted by rootstock, variety, then clone');

/* grower filter: keeps only the combinations that involve that grower, and must
   not change that grower's own column total */
const grower = store.meta.produttori.find((g) => store.lotti.some((l) => l.produttore === g));
const rf = reportPerProduttore({ produttore: grower });
ok(rf.rows.length > 0, `grower filter returns rows (${grower})`);
ok(rf.rowCount <= r2.rowCount, 'grower filter cannot add rows');
near(rf.totals.per[grower], r2.totals.per[grower], "the grower's column total is unchanged by filtering");
ok(rf.totals.mag <= r2.totals.mag, 'filtering narrows the warehouse total');
const root2 = store.index.rootstocks.find((c) => store.lotti.some((l) => l.portainnesto === c));
const rf2 = reportPerProduttore({ produttore: grower, portainnesto: root2 });
ok(rf2.rows.every((r) => r.portainnesto === root2), 'grower + rootstock filters combine');

/* ---------- report 3 ---------- */
const r3 = reportIndisponibilita({});
ok(r3.count === negRows, 'shortage rows = negative rows of report 1');
ok(r3.rows.every((r) => r.disponibilita < 0), 'every shortage row is negative');
ok(r3.rows.every((r) => r.deficit === r.ord - r.mag && r.deficit > 0), 'deficit = ordinato - magazzino');
ok(ordered(r3.rows), 'sorted rootstock → variety → clone (the subtotals need contiguous groups)');
{
  const groups = new Set(r3.rows.map((r) => subtotalKey(r)));
  near(r3.subtotals.size, groups.size, 'report 3: one subtotal per (rootstock, variety) group');
  let sumMag = 0, sumOrd = 0, sumDef = 0;
  for (const [key, t] of r3.subtotals) {
    const rowsOfGroup = r3.rows.filter((r) => subtotalKey(r) === key);
    near(t.mag, rowsOfGroup.reduce((a, b) => a + b.mag, 0), `report 3 subtotal magazzino ${t.portainnesto}`);
    near(t.ord, rowsOfGroup.reduce((a, b) => a + b.ord, 0), `report 3 subtotal ordinato ${t.portainnesto}`);
    near(t.deficit, rowsOfGroup.reduce((a, b) => a + b.deficit, 0), `report 3 subtotal deficit ${t.portainnesto}`);
    ok(t.deficit === t.ord - t.mag, 'report 3 subtotal deficit = ordinato - magazzino');
    sumMag += t.mag; sumOrd += t.ord; sumDef += t.deficit;
  }
  near(sumDef, r3.deficitTot, 'report 3: the subtotals add up to the total deficit');
  near(sumDef, sumOrd - sumMag, 'report 3: total deficit = ordinato - magazzino');
  ok(r3.totals && r3.totals.mag === sumMag && r3.totals.ord === sumOrd && r3.totals.deficit === sumDef,
     'report 3 carries the grand totals for the foot of the sheet');
  near(r3.totals.mag + r3.totals.deficit, r3.totals.ord, 'report 3: ordinato = magazzino + deficit');
}

/* ---------- report 5: messo a disposizione (one producer) ---------- */
{
  const g = store.meta.produttori.find((x) => store.lotti.some((l) => l.produttore === x));
  const rm = reportMessoADisposizione({}, g);
  ok(rm.rows.length > 0, `messo a disposizione returns rows (${g})`);
  ok(rm.grower === g, 'the report carries the producer it belongs to');
  ok(rm.rows.every((r) => r.mag > 0 || r.ord > 0 || r.sped > 0), 'only combinations with records');
  ok(rm.rows.every((r) => r.disponibilita === r.mag - r.sped),
     'messo: «A magazzino» = messo a disposizione - spedito');
  ok(rm.rows.every((r) => r.daSpedire === r.ord - r.sped), 'messo: da spedire = ordinato - spedito');
  near(rm.totals.mag, store.lotti.filter((l) => l.produttore === g)
    .reduce((a, l) => a + l.quantita, 0), 'messo: magazzino is that producer’s own stock');
  near(rm.totals.disponibilita, rm.totals.mag - rm.totals.sped, 'messo: grand total «A magazzino»');
  const groups = new Set(rm.rows.map((r) => subtotalKey(r)));
  near(rm.subtotals.size, groups.size, 'messo: one subtotal per (rootstock, variety) group');
  let sumSubs = 0;
  for (const [key, t] of rm.subtotals) {
    near(t.mag, rm.rows.filter((r) => subtotalKey(r) === key).reduce((a, b) => a + b.mag, 0),
      `messo subtotal magazzino ${t.portainnesto}`);
    sumSubs += t.mag;
  }
  near(sumSubs, rm.totals.mag, 'messo: the subtotals add up to the grand total');
  // the producer's column in report 2 must agree with report 5
  /* report 2's grower column is mag − ord; «A magazzino» is mag − sped, so the
     two only coincide when that grower has nothing unshipped */
  near(rm.totals.sped, store.ordini.filter((o) => o.spedito &&
      store.index.lotById.get(o.id_magazzino)?.produttore === g)
    .reduce((a, o) => a + o.quantita, 0), 'messo: «Spedito» is that producer’s shipped quantity');
  ok(reportMessoADisposizione({}, null).rows.length === 0, 'no producer → no rows (nothing to show)');
  const other = store.meta.produttori.find((x) => x !== g &&
    store.lotti.some((l) => l.produttore === x));
  const rm2 = reportMessoADisposizione({}, other);
  ok(rm2.totals.mag > 0 && rm2.totals.mag !== rm.totals.mag, 'a different producer gets different rows');
  const rootF = rm.rows[0].portainnesto;
  ok(reportMessoADisposizione({ portainnesto: rootF }, g).rows.every((r) => r.portainnesto === rootF),
    'messo: the rootstock filter applies');
}

/* ---------- report 1: «Ripiantato» e «Frigoconservato» ---------- */
{
  const f = { tipologia: 'Barbatelle innestate', produzione: 'Nuova produzione' };
  const r = reportDisponibilita(f);
  ok(r.rows.every((x) => 'ripiantato' in x && 'frigoconservato' in x),
     'report 1 always carries the two extra series');

  // the join follows the «Nuova produzione» lot reference:
  // tipologia, varietà, clone, portainnesto, produttore, anno di conferimento
  const keyOf = (row, produttore, anno) =>
    `${row.varieta}|${row.clone}|${row.portainnesto}|${produttore || ''}|${anno}`;
  const expected = (row) => {
    const references = new Set(
      store.lotti
        .filter((l) => l.produzione === 'Nuova produzione' && l.tipologia === row.tipologia
          && l.varieta === row.varieta && l.clone === row.clone && l.portainnesto === row.portainnesto)
        .map((l) => keyOf(row, l.produttore, l.anno)),
    );
    let ripiantato = 0;
    let frigoconservato = 0;
    for (const ref of references) {
      const [varieta, clone, root, produttore, anno] = ref.split('|');
      for (const l of store.lotti) {
        if (l.produzione !== 'Ripiantato' && l.produzione !== 'Frigoconservato') continue;
        if (l.varieta !== varieta || l.clone !== clone || l.portainnesto !== root) continue;
        if ((l.produttore || '') !== produttore || String(l.anno) !== anno) continue;
        if (l.produzione === 'Ripiantato') ripiantato += l.quantita;
        else frigoconservato += l.quantita;
      }
      for (const o of store.ordini) {
        if (o.produzione !== 'Ripiantato' && o.produzione !== 'Frigoconservato') continue;
        const lot = o.id_magazzino ? store.index.lotById.get(o.id_magazzino) : null;
        if (!lot) continue;
        if (o.varieta !== varieta || o.clone !== clone || o.portainnesto !== root) continue;
        if ((lot.produttore || '') !== produttore || String(lot.anno) !== anno) continue;
        if (o.produzione === 'Ripiantato') ripiantato -= o.quantita;
        else frigoconservato -= o.quantita;
      }
    }
    return { ripiantato, frigoconservato };
  };

  const withStock = r.rows.filter((x) => x.ripiantato || x.frigoconservato);
  for (const row of withStock) {
    const want = expected(row);
    near(row.ripiantato, want.ripiantato, `ripiantato for ${row.clone} (${row.portainnesto})`);
    near(row.frigoconservato, want.frigoconservato, `frigoconservato for ${row.clone} (${row.portainnesto})`);
  }
  ok(r.totals.ripiantato === r.rows.reduce((a, x) => a + x.ripiantato, 0),
     'the grand total is the sum of the row values');
  ok(r.totals.frigoconservato === r.rows.reduce((a, x) => a + x.frigoconservato, 0),
     'same for Frigoconservato');
  const sub = [...r.subtotals.values()].reduce((a, t) => a + (t.ripiantato || 0), 0);
  near(sub, r.totals.ripiantato, 'the subtotals sum the extra series too');

  // a combination whose «Ripiantato» lot has no matching «Nuova produzione»
  // reference (different produttore/anno/rootstock) stays at zero
  const lonely = store.lotti.find((l) => l.produzione === 'Ripiantato'
    && !store.lotti.some((n) => n.produzione === 'Nuova produzione'
      && n.varieta === l.varieta && n.clone === l.clone && n.portainnesto === l.portainnesto
      && (n.produttore || '') === (l.produttore || '') && String(n.anno) === String(l.anno)));
  if (lonely) {
    const row = r.rows.find((x) => x.varieta === lonely.varieta && x.clone === lonely.clone
      && x.portainnesto === lonely.portainnesto);
    if (row) ok(row.ripiantato === 0, 'a reference without a «Nuova produzione» lot does not add up');
  }
}

/* ---------- report 1: the alternative-only rows (v1.0.3) ---------- */
{
  const f = { tipologia: 'Barbatelle innestate', produzione: 'Nuova produzione' };
  const plain = reportDisponibilita(f);
  const withAlt = reportDisponibilita(f, { includeAlternativeRows: true });
  ok(!plain.rows.some((r) => r.alternativeOnly), 'the extra rows stay out by default');
  const alt = withAlt.rows.filter((r) => r.alternativeOnly);
  ok(alt.length > 0, `the extra rows appear on request (${alt.length})`);
  ok(alt.every((r) => r.mag === 0 && r.ord === 0 && r.sped === 0 && r.disponibilita === 0),
     'the four «Nuova produzione» columns are zero on those rows');
  ok(alt.every((r) => r.ripiantato || r.frigoconservato),
     'at least one of the two new columns carries a value');
  ok(alt.every((r) => !plain.rows.some((p) => p.varieta === r.varieta && p.clone === r.clone
    && p.portainnesto === r.portainnesto && p.alternativeOnly)),
     'they never duplicate an existing alternative row');

  // the two columns account for the whole alternative stock of the filters
  const allRip = store.lotti.filter((l) => l.produzione === 'Ripiantato' && l.tipologia === f.tipologia)
    .reduce((a, l) => a + l.quantita, 0);
  const allFrigo = store.lotti.filter((l) => l.produzione === 'Frigoconservato' && l.tipologia === f.tipologia)
    .reduce((a, l) => a + l.quantita, 0);
  near(withAlt.totals.ripiantato, allRip, 'the total now equals the whole Ripiantato stock');
  near(withAlt.totals.frigoconservato, allFrigo, 'same for Frigoconservato');
  ok(plain.totals.ripiantato < withAlt.totals.ripiantato,
     'without the extra rows the total only covers the matched references');
  near(withAlt.subtotals.size, new Set(withAlt.rows.map((r) => subtotalKey(r))).size,
    'the subtotals still follow the groups');

  // the combination's own row comes before its alternative-only row
  const indexes = withAlt.rows.map((r, i) => (r.alternativeOnly ? i : -1)).filter((i) => i >= 0);
  ok(indexes.every((i) => i === 0 || !withAlt.rows[i - 1].alternativeOnly
     || subtotalKey(withAlt.rows[i - 1]) !== subtotalKey(withAlt.rows[i])),
     'a group never holds two alternative-only rows in a row');
}

/* ---------- filters ---------- */
const varieta = store.index.varieta.find((v) => store.lotti.some((l) => l.varieta === v));
const f1 = reportDisponibilita({ varieta });
ok(f1.rows.every((r) => r.varieta === varieta), 'variety filter applies');
ok(f1.rowCount < r1.rowCount, 'variety filter narrows the result');
const tipo = store.meta.tipologie.find((t) => store.lotti.some((l) => l.tipologia === t));
const f2 = reportDisponibilita({ tipologia: tipo });
ok(f2.rows.every((r) => r.tipologia === tipo), 'tipologia filter applies');
const root = store.index.rootstocks.find((c) => store.lotti.some((l) => l.portainnesto === c));
const f3 = reportDisponibilita({ portainnesto: root });
ok(f3.rows.length > 0, 'rootstock filter returns rows');
ok(f3.rows.every((r) => r.portainnesto === root), 'rootstock filter applies');
ok(f3.rowCount < r1.rowCount, 'rootstock filter narrows the result');
const f4 = reportDisponibilita({ portainnesto: root, tipologia: tipo });
ok(f4.rows.every((r) => r.portainnesto === root && r.tipologia === tipo), 'filters combine');
near(sumOf(f4.rows, 'disponibilita'), f4.totals.disponibilita, 'totals follow the filters');
function sumOf(list, k) { return list.reduce((s, r) => s + r[k], 0); }

/* ---------- validation ---------- */
const anyVariety = store.index.varieta.find((v) => clonesOf(v).length > 0);
const anyClone = clonesOf(anyVariety)[0];
const otherVariety = store.index.varieta.find((v) => v !== anyVariety && !clonesOf(v).includes(anyClone));
const baseLot = { anno: '2026', produttore: store.meta.produttori[0], tipologia: store.meta.tipologie[0],
               produzione: store.meta.produzioni[0], varieta: anyVariety, clone: anyClone,
               portainnesto: store.index.rootstocks[0], quantita: '100' };
const base = { anno: '2026', produttore: store.meta.produttori[0], tipologia: store.meta.tipologie[0],
               produzione: store.meta.produzioni[0], varieta: anyVariety, clone: anyClone,
               portainnesto: store.index.rootstocks[0], quantita: '100' };
ok(Object.keys(validateLotto(base)).length === 0, 'valid lot passes');
ok(!!validateLotto({ ...base, quantita: '-5' }).quantita, 'negative quantity rejected');
ok(!!validateLotto({ ...base, quantita: '1.5' }).quantita, 'decimal quantity rejected');
ok(!!validateLotto({ ...base, produttore: 'Sconosciuto' }).produttore, 'unknown grower rejected');
ok(!!validateLotto({ ...base, portainnesto: 'XXX' }).portainnesto, 'unknown rootstock rejected');
if (otherVariety) {
  ok(!!validateLotto({ ...base, varieta: otherVariety }).clone, 'clone/variety mismatch rejected');
}
ok(!!validateOrdine({ ...base, quantita: '0' }).quantita, 'order quantity 0 rejected');

/* ---------- CRUD round trip ---------- */
{
  const base = { ...baseLot };
  const lot = addLotto({ ...base, quantita: '111' });
  ok(store.lotti.some((l) => l.id === lot.id), 'addLotto appends');
  updateLotto(lot.id, { ...base, quantita: '222' });
  near(store.lotti.find((l) => l.id === lot.id).quantita, 222, 'updateLotto modifies');
  ok(deleteLotto(lot.id).ok, 'deleteLotto removes an unreferenced lot');
  ok(!store.lotti.some((l) => l.id === lot.id), 'the lot is gone');

  const pair = { varieta: 'ZZ TEST', clone: 'CL ONE' };
  ok(addVitiPair(pair.varieta, pair.clone).ok, 'addVitiPair inserts');
  ok(!addVitiPair(pair.varieta, pair.clone).ok, 'duplicate pair refused');
  ok(updateVitiPair(pair, { varieta: 'ZZ TEST', clone: 'CL TWO' }).ok, 'updateVitiPair renames');
  ok(store.viti.some((v) => v.varieta === 'ZZ TEST' && v.clone === 'CL TWO'), 'renamed pair present');
  ok(deleteVitiPair('ZZ TEST', 'CL TWO').ok, 'deleteVitiPair removes it');
  const usedPair = store.viti.find((v) => usageOfPair(v.varieta, v.clone) > 0);
  ok(!deleteVitiPair(usedPair.varieta, usedPair.clone).ok, 'a pair in use is protected');

  ok(addPortainnesto('ROOT TEST').ok, 'addPortainnesto inserts');
  ok(renamePortainnesto('ROOT TEST', 'ROOT TEST 2').ok, 'renamePortainnesto renames');
  ok(deletePortainnesto('ROOT TEST 2').ok, 'deletePortainnesto removes it');
  const usedRoot = store.portainnesti.find((c) => usageOfRootstock(c) > 0);
  ok(!deletePortainnesto(usedRoot).ok, 'a rootstock in use is protected');
}

/* ---------- summary ---------- */
const s = summary();
near(s.negativeCount, negRows, 'summary negative count');
near(s.disponibilita, r1.totals.disponibilita, 'summary availability = report total');
ok(s.ultimiLotti.length <= 5, 'summary recent lots capped');
ok(s.topNegativi.length <= 5, 'summary top shortages capped');

console.log(`engine tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
