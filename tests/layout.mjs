/* Vignero · layout.mjs — verifies how the tables actually render in a browser.
 * Requires: npm i -D playwright && npx playwright install chromium
 * Run: node tests/layout.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const LIVE = process.env.LIVE_BASE || '';
const PORT = 8098;
const server = LIVE ? null : spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
if (!LIVE) await new Promise((r) => setTimeout(r, 1200));
const BASE = LIVE || `http://127.0.0.1:${PORT}/`;

const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) pass++; else { fail++; console.error('  FAIL ' + w); } };

const ROUTES = ['#/home', '#/r/disponibilita', '#/r/produttore', '#/r/indisponibilita',
                '#/dati/lotti', '#/dati/ordini', '#/anagrafiche/viti', '#/anagrafiche/portainnesti'];

async function open(viewport, route) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('vignero.session.v1', JSON.stringify({
        userId: 'u-admin', email: 'admin@vignero.it', name: 'Paola Neri',
        role: 'admin', grower: null, issuedAt: Date.now(), exp: Date.now() + 3600000,
      }));
      localStorage.setItem('vignero.demo.dismissed', '1');
    } catch {}
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  return { page, ctx, errs };
}

/* ------------------------------- PC (1440) ------------------------------- */
for (const route of ROUTES) {
  const { page, ctx, errs } = await open({ width: 1440, height: 900 }, route);
  const d = await page.evaluate(() => {
    const t = document.querySelector('.grid');
    if (!t) return { noTable: true };
    const rows = [...t.querySelectorAll('tbody tr')];
    const trows = rows.filter((r) => r.classList.contains('trow'));
    const first = trows[0];
    const tds = first ? [...first.querySelectorAll('td')] : [];
    const ths = [...t.querySelectorAll('thead th')];
    const style = (el) => getComputedStyle(el);
    return {
      docScroll: document.documentElement.scrollWidth,
      win: window.innerWidth,
      tableW: Math.round(t.getBoundingClientRect().width),
      boxW: Math.round(t.getBoundingClientRect().width),
      rowDisplays: [...new Set(trows.map((r) => style(r).display))],
      tdDisplays: [...new Set(tds.map((x) => style(x).display))],
      thDisplay: ths[0] ? style(ths[0]).display : null,
      thSticky: ths[0] ? style(ths[0]).position : null,
      theadVisible: ths[0] ? style(t.querySelector('thead')).display !== 'none' : null,
      cols: ths.length,
      cells: tds.length,
      numericRight: tds.filter((x) => x.classList.contains('r')).map((x) => style(x).textAlign),
      groupRows: t.querySelectorAll('tbody tr.group').length,
      subtotalRows: t.querySelectorAll('tbody tr.subtotal').length,
      negativeRows: t.querySelectorAll('tbody tr.negative').length,
      negativeStyle: (() => {
        const n = t.querySelector('tbody tr.negative td');
        return n ? { color: getComputedStyle(n).color, weight: getComputedStyle(n).fontWeight } : null;
      })(),
      scroller: (() => {
        const s = t.closest('.table-scroll');
        return s ? { scrollW: s.scrollWidth, clientW: s.clientWidth } : null;
      })(),
    };
  });
  ok(!d.noTable, `${route}: has a table`);
  if (d.noTable) { await ctx.close(); continue; }
  ok(errs.length === 0, `${route}: no console/page errors (${errs[0] || ''})`);
  ok(d.rowDisplays.length === 1 && d.rowDisplays[0] === 'table-row',
     `${route}: rows are table-row, not card/flex (got ${d.rowDisplays})`);
  ok(d.tdDisplays.length === 1 && d.tdDisplays[0] === 'table-cell',
     `${route}: cells are table-cell (got ${d.tdDisplays})`);
  ok(d.theadVisible === true, `${route}: header row visible on PC`);
  ok(d.thSticky === 'sticky', `${route}: header sticks while scrolling (got ${d.thSticky})`);
  ok(d.cells === d.cols, `${route}: every row has one cell per column (${d.cells}/${d.cols})`);
  ok(d.numericRight.every((a) => a === 'right'),
     `${route}: numeric columns right-aligned (got ${[...new Set(d.numericRight)]})`);
  ok(d.docScroll <= d.win + 1, `${route}: page has no horizontal scroll (${d.docScroll} > ${d.win})`);
  await ctx.close();
}

/* per-grower matrix must scroll inside its panel, not widen the page */
{
  const { page, ctx } = await open({ width: 1440, height: 900 }, '#/r/produttore');
  const m = await page.evaluate(() => {
    const t = document.querySelector('.grid');
    const s = t.closest('.table-scroll');
    return {
      cols: t.querySelectorAll('thead th').length,
      rows: t.querySelectorAll('tbody tr.group').length,
      scrollW: s.scrollWidth, clientW: s.clientWidth,
      doc: document.documentElement.scrollWidth, win: window.innerWidth,
      headers: [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim()).slice(-3),
    };
  });
  ok(m.cols === 16, `matrix: 16 columns (got ${m.cols})`);
  ok(m.headers.includes('Non attribuito') && m.headers.includes('Tot. produttori'),
     `matrix: unattributed + total columns present (${m.headers})`);
  ok(m.scrollW > m.clientW, `matrix: scrolls horizontally inside its panel`);
  ok(m.doc <= m.win + 1, `matrix: page itself does not scroll (${m.doc} > ${m.win})`);
  await ctx.close();
}

/* reports must show subtotal rows and red negative rows on PC */
{
  const { page, ctx } = await open({ width: 1440, height: 900 }, '#/r/disponibilita');
  const r = await page.evaluate(() => {
    const t = document.querySelector('.grid');
    const sub = t.querySelector('tbody tr.subtotal');
    const neg = t.querySelector('tbody tr.negative');
    const subTd = sub && sub.querySelector('td');
    return {
      subs: t.querySelectorAll('tbody tr.subtotal').length,
      totals: t.querySelectorAll('tbody tr.total').length,
      subWeight: subTd ? getComputedStyle(subTd).fontWeight : null,
      subBg: subTd ? getComputedStyle(subTd).backgroundColor : null,
      negWeight: neg ? getComputedStyle(neg.querySelector('td')).fontWeight : null,
      negColor: neg ? getComputedStyle(neg.querySelector('td')).color : null,
      negCellBg: neg ? getComputedStyle(neg.querySelector('td')).backgroundColor : null,
    };
  });
  ok(r.subs > 0, 'report: rootstock subtotal rows present');
  ok(r.totals === 1, 'report: single grand-total row');
  ok(String(r.subWeight) === '700', `subtotal rows are bold (got ${r.subWeight})`);
  ok(r.subBg === 'rgb(233, 245, 239)', `subtotal tinted with brand-50 (got ${r.subBg})`);
  ok(r.negWeight === '700', `negative row is bold (got ${r.negWeight})`);
  ok(r.negColor === 'rgb(185, 28, 28)', `negative row is danger-700 (got ${r.negColor})`);
  ok(r.negCellBg === 'rgb(254, 242, 242)', `negative cells tinted danger-50 (got ${r.negCellBg})`);
  await ctx.close();
}

/* ------------------------------- launcher -------------------------------- */
for (const [w, cols] of [[390, 2], [900, 3], [1440, 4]]) {
  const { page, ctx } = await open({ width: w, height: 900 }, '#/home');
  const d = await page.evaluate(() => {
    const grid = document.querySelector('.launcher-grid');
    const tiles = [...document.querySelectorAll('.apptile')];
    const g = getComputedStyle(grid);
    const rects = tiles.map((t) => t.getBoundingClientRect());
    return {
      columns: g.gridTemplateColumns.split(' ').length,
      tiles: tiles.length,
      minH: Math.min(...rects.map((r) => Math.round(r.height))),
      minW: Math.min(...rects.map((r) => Math.round(r.width))),
      docScroll: document.documentElement.scrollWidth, win: window.innerWidth,
    };
  });
  ok(d.columns === cols, `${w}px: launcher has ${cols} columns (got ${d.columns})`);
  ok(d.tiles >= 8, `${w}px: launcher shows ${d.tiles} tiles`);
  ok(d.minH >= 44, `${w}px: every tile is at least 44px tall (min ${d.minH})`);
  ok(d.minW >= 44, `${w}px: every tile is at least 44px wide (min ${d.minW})`);
  ok(d.docScroll <= d.win + 1, `${w}px: launcher does not overflow horizontally`);
  await ctx.close();
}

/* ---------------------------- breakpoint edges ---------------------------- */
for (const [w, expect] of [[1024, 'table-row'], [760, 'table-row'], [759, 'block']]) {
  const { page, ctx } = await open({ width: w, height: 900 }, '#/r/disponibilita');
  const d = await page.evaluate(() => {
    const t = document.querySelector('.grid');
    const row = t.querySelector('tbody tr.trow');
    return {
      row: getComputedStyle(row).display,
      rail: getComputedStyle(document.getElementById('rail')).display,
      tabs: getComputedStyle(document.getElementById('tabbar')).display,
      docScroll: document.documentElement.scrollWidth, win: window.innerWidth,
    };
  });
  const isTable = d.row === 'table-row';
  ok(expect === 'table-row' ? isTable : d.row !== 'table-row',
     `${w}px: table mode is ${expect} (got ${d.row})`);
  ok(d.rail === (w >= 1024 ? 'block' : 'none'), `${w}px: sidebar ${w >= 1024 ? 'shown' : 'hidden'} (got ${d.rail})`);
  ok(d.tabs === (w >= 1024 ? 'none' : 'flex'), `${w}px: tab bar ${w >= 1024 ? 'hidden' : 'shown'} (got ${d.tabs})`);
  ok(d.docScroll <= d.win + 1, `${w}px: no horizontal page scroll`);
  await ctx.close();
}

/* ------------------------------- phone (390) ------------------------------ */
for (const route of ['#/r/disponibilita', '#/r/produttore', '#/r/indisponibilita']) {
  const { page, ctx, errs } = await open({ width: 390, height: 844 }, route);
  const d = await page.evaluate(() => {
    const t = document.querySelector('.grid');
    const trow = t.querySelector('tbody tr.trow');
    const td = trow.querySelector('td.metric');
    return {
      thead: getComputedStyle(t.querySelector('thead')).display,
      rowDisplay: getComputedStyle(trow).display,
      hasLabel: td ? getComputedStyle(td, '::before').content : null,
      docScroll: document.documentElement.scrollWidth,
      win: window.innerWidth,
      tabbar: !!document.querySelector('#tabbar a'),
    };
  });
  ok(errs.length === 0, `${route} mobile: no errors`);
  ok(d.thead === 'none', `${route} mobile: table header hidden (got ${d.thead})`);
  ok(d.rowDisplay !== 'table-row', `${route} mobile: rows become cards (got ${d.rowDisplay})`);
  ok(d.docScroll <= d.win + 1, `${route} mobile: no horizontal page scroll`);
  ok(d.tabbar, `${route} mobile: tab bar present`);
  await ctx.close();
}

/* data entry gate on a phone */
{
  const { page, ctx } = await open({ width: 390, height: 844 }, '#/dati/lotti');
  const t = await page.textContent('#main');
  ok(/solo da PC/.test(t), 'mobile: entry screens show the PC-only gate');
  await ctx.close();
}

await browser.close();
if (server) server.kill();
console.log(`${LIVE ? 'layout tests (live ' + LIVE + ')' : 'layout tests'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
