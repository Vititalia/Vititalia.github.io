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
ok(r1.groups.length > 0, 'report 1 has groups');
let rows = 0, negRows = 0, sumSub = 0;
for (const g of r1.groups) {
  let sm = 0, so = 0, ss = 0, sd = 0, sdis = 0;
  for (const r of g.rows) {
    rows++;
    near(r.daSpedire, r.ord - r.sped, 'daSpedire = ordinato - spedito');
    near(r.disponibilita, r.mag - r.ord, 'disponibilita = magazzino - ordinato');
    if (r.disponibilita < 0) negRows++;
    sm += r.mag; so += r.ord; ss += r.sped; sd += r.daSpedire; sdis += r.disponibilita;
  }
  near(g.sub.mag, sm, 'subtotal magazzino ' + g.portainnesto);
  near(g.sub.ord, so, 'subtotal ordinato ' + g.portainnesto);
  near(g.sub.sped, ss, 'subtotal spedito ' + g.portainnesto);
  near(g.sub.daSpedire, sd, 'subtotal da spedire ' + g.portainnesto);
  near(g.sub.disponibilita, sdis, 'subtotal disponibilita ' + g.portainnesto);
  sumSub += sdis;
}
near(r1.totals.disponibilita, sumSub, 'total = sum of subtotals');
near(r1.negativeCount, negRows, 'negativeCount = rows with disponibilità < 0');
near(r1.rowCount, rows, 'rowCount matches rendered rows');

/* ordering: rootstocks ascending, clones ascending inside a group */
const C = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
const roots = r1.groups.map((g) => g.portainnesto);
ok(roots.every((v, i) => i === 0 || C.compare(roots[i - 1], v) <= 0), 'groups sorted by rootstock');
ok(r1.groups.every((g) => g.rows.every((r, i) => i === 0 || C.compare(g.rows[i - 1].clone, r.clone) <= 0)),
   'rows sorted by clone');

/* ---------- report 2 ---------- */
const r2 = reportPerProduttore({});
let r2rows = 0;
for (const g of r2.groups) {
  for (const r of g.rows) {
    r2rows++;
    const sumG = r2.growers.reduce((s, n) => s + r.per[n], 0) + r.nonAttr + r.extra;
    near(sumG, r.totaleProduttori, 'grower columns sum to Tot. produttori');
    near(r.totaleProduttori, r.disponibilita, 'Tot. produttori = disponibilità');
  }
}
near(r2rows, rows, 'report 2 covers the same keys as report 1');
near(r2.totals.totaleProduttori, r1.totals.disponibilita, 'report 2 grand total = report 1 total');

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
ok(f1.groups.every((g) => g.rows.every((r) => r.varieta === varieta)), 'variety filter applies');
ok(f1.rowCount < r1.rowCount, 'variety filter narrows the result');
const tipo = store.meta.tipologie.find((t) => store.lotti.some((l) => l.tipologia === t));
const f2 = reportDisponibilita({ tipologia: tipo });
ok(f2.groups.every((g) => g.rows.every((r) => r.tipologia === tipo)), 'tipologia filter applies');

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
