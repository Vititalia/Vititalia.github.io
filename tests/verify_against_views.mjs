/* Compares the JS report engine with the database report views.
 * Uses the REAL snapshot, which is never committed: run locally only.
 *   node tests/verify_against_views.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadFromSnapshot, reportDisponibilita, reportIndisponibilita, reportPerProduttore } from '../js/store.js';

const REAL = path.resolve('../.local/snapshot.real.json');
const VIEWS = path.resolve('../.local/views.json');
if (!fs.existsSync(REAL) || !fs.existsSync(VIEWS)) {
  console.log('SKIP: real snapshot/fixtures not present (they are never committed).');
  process.exit(0);
}
const store = loadFromSnapshot(JSON.parse(fs.readFileSync(REAL, 'utf8')));
const fixtures = JSON.parse(fs.readFileSync(VIEWS, 'utf8'));

let failures = 0;
const fail = (msg) => { failures++; console.error('  FAIL ' + msg); };
const eq = (a, b, what) => { if (Number(a) !== Number(b)) fail(`${what}: engine=${a} view=${b}`); };

/* ---- Report 1 vs riepilogo_disponibilita ---- */
const r1 = reportDisponibilita({});
const mine = new Map();
for (const row of r1.rows) {
  mine.set([row.tipologia, row.produzione, row.varieta, row.clone, row.portainnesto].join('|'), row);
}
const viewRows = fixtures.riepilogo;
console.log(`Report 1: engine ${mine.size} keys, view ${viewRows.length} keys`);
eq(mine.size, viewRows.length, 'key count');
for (const v of viewRows) {
  const [tipo, prodn, varieta, clone, root, mag, ord, sped, dasped, disp] = v;
  const k = [tipo, prodn, varieta, clone, root].join('|');
  const m = mine.get(k);
  if (!m) { fail('missing key ' + k); continue; }
  eq(m.mag, mag, `magazzino ${clone}/${root}`);
  eq(m.ord, ord, `ordinato ${clone}/${root}`);
  eq(m.sped, sped, `di cui spedito ${clone}/${root}`);
  eq(m.daSpedire, dasped, `da spedire ${clone}/${root}`);
  eq(m.disponibilita, disp, `disponibilità ${clone}/${root}`);
}
const subCheck = r1.rows.reduce((s, r) => s + r.disponibilita, 0);
eq(r1.totals.disponibilita, subCheck, 'grand total == sum of rows');

/* ---- Report 3 vs vista_disponibilita_negative ---- */
const r3 = reportIndisponibilita({});
const negView = fixtures.negative;
console.log(`Report 3: engine ${r3.count} rows, view ${negView.length} rows`);
eq(r3.count, negView.length, 'negative row count');
for (const [varieta, clone, root, tipo, prodn, qmag, qimp, qeff] of negView) {
  const row = r3.rows.find((x) => x.varieta === varieta && x.clone === clone && x.portainnesto === root);
  if (!row) { fail(`missing negative ${varieta}/${clone}/${root}`); continue; }
  eq(row.mag, qmag, `negative magazzino ${clone}`);
  eq(row.ord, qimp, `negative impegnata ${clone}`);
  eq(row.disponibilita, qeff, `negative disponibilità ${clone}`);
  eq(row.deficit, Math.abs(qeff), `deficit ${clone}`);
}

/* ---- Report 2 internal consistency ---- */
const r2 = reportPerProduttore({});
let reconcile = 0;
for (const g of r2.groups) for (const row of g.rows) {
  const sumG = r2.growers.reduce((s, n) => s + row.per[n], 0) + row.nonAttr + row.extra;
  eq(sumG, row.totaleProduttori, `tot. produttori ${row.clone}`);
  eq(row.totaleProduttori, row.disponibilita, `tot. prod. == disponibilità ${row.clone}`);
  reconcile++;
}
/* every order in the source is unattributed, so growers only carry magazzino */
const unattributed = store.ordini.filter((o) => !o.id_magazzino).length;
console.log(`Report 2: ${reconcile} rows reconciled; ${unattributed}/${store.ordini.length} orders without lot`);
eq(r2.totals.nonAttr, -r2.totals.ord, 'non attribuito == -ordinato (no order points at a lot)');

console.log(failures ? `\n${failures} FAILURES` : '\nOK — engine matches the database views exactly');
process.exit(failures ? 1 : 0);
