/* Vignero · engine.test.mjs — invariants on the published snapshot.
 * Run: node tests/engine.test.mjs
 */
import fs from 'node:fs';
import {
  loadFromSnapshot, reportDisponibilita, reportIndisponibilita, reportPerProduttore,
  validateLotto, validateOrdine, clonesOf, summary, store,
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

/* ordering: rootstock code, then clone */
const C = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
ok(r1.rows.every((r, i) => i === 0 ||
   C.compare(r1.rows[i - 1].portainnesto, r.portainnesto) < 0 ||
   (r1.rows[i - 1].portainnesto === r.portainnesto &&
    C.compare(r1.rows[i - 1].clone, r.clone) <= 0)),
   'rows sorted by rootstock code, then clone');

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
ok(r2.rows.every((r, i) => i === 0 ||
   C.compare(r2.rows[i - 1].portainnesto, r.portainnesto) < 0 ||
   (r2.rows[i - 1].portainnesto === r.portainnesto &&
    C.compare(r2.rows[i - 1].clone, r.clone) <= 0)),
   'report 2 sorted by rootstock then clone');

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
ok(r3.rows.every((r, i) => i === 0 ||
   C.compare(r3.rows[i - 1].varieta, r.varieta) < 0 ||
   (r3.rows[i - 1].varieta === r.varieta &&
    (C.compare(r3.rows[i - 1].portainnesto, r.portainnesto) < 0 ||
     (r3.rows[i - 1].portainnesto === r.portainnesto &&
      C.compare(r3.rows[i - 1].clone, r.clone) <= 0)))),
   'sorted varietà → portainnesto → clone');

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

/* ---------- summary ---------- */
const s = summary();
near(s.negativeCount, negRows, 'summary negative count');
near(s.disponibilita, r1.totals.disponibilita, 'summary availability = report total');
ok(s.ultimiLotti.length <= 5, 'summary recent lots capped');
ok(s.topNegativi.length <= 5, 'summary top shortages capped');

console.log(`engine tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
