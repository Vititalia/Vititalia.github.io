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

/* the two frozen columns must stay put while the matrix scrolls */
{
  const { page, ctx } = await open({ width: 1440, height: 900 }, '#/r/produttore');
  const pin = await page.evaluate(async () => {
    const scroller = document.querySelector('.table-scroll');
    const before = {
      c1: Math.round(document.querySelector('.grid tbody tr.trow td:nth-child(1)').getBoundingClientRect().left),
      c2: Math.round(document.querySelector('.grid tbody tr.trow td:nth-child(2)').getBoundingClientRect().left),
      panel: Math.round(scroller.getBoundingClientRect().left),
    };
    scroller.scrollLeft = 420;
    await new Promise((r) => setTimeout(r, 120));
    const cell1 = document.querySelector('.grid tbody tr.trow td:nth-child(1)');
    const cell2 = document.querySelector('.grid tbody tr.trow td:nth-child(2)');
    const sub = document.querySelector('.grid tbody tr.subtotal td:nth-child(1)');
    return {
      before,
      after: {
        c1: Math.round(cell1.getBoundingClientRect().left),
        c2: Math.round(cell2.getBoundingClientRect().left),
        w1: Math.round(cell1.getBoundingClientRect().width),
        scrolled: Math.round(scroller.scrollLeft),
      },
      subBg: sub ? getComputedStyle(sub).backgroundColor : null,
      subWeight: sub ? getComputedStyle(sub).fontWeight : null,
    };
  });
  ok(pin.after.scrolled > 300, `matrix scrolled ${pin.after.scrolled}px`);
  ok(Math.abs(pin.after.c1 - pin.before.panel) <= 2,
     `first column stays pinned (${pin.after.c1} vs panel ${pin.before.panel})`);
  ok(Math.abs(pin.after.c2 - (pin.after.c1 + pin.after.w1)) <= 2,
     `second column stays pinned next to it (${pin.after.c2})`);
  ok(pin.subBg === 'rgb(233, 245, 239)', `frozen subtotal cell keeps the brand tint (${pin.subBg})`);
  ok(String(pin.subWeight) === '700', `frozen subtotal cell stays bold (${pin.subWeight})`);
  await ctx.close();
}

/* report 1 is a flat list (no rootstock subtotals); report 2 still groups */
{
  const { page, ctx } = await open({ width: 1440, height: 900 }, '#/r/disponibilita');
  const r = await page.evaluate(() => {
    const t = document.querySelector('.grid');
    const neg = t.querySelector('tbody tr.negative');
    const total = t.querySelector('tbody tr.total');
    const td = (row) => (row ? row.querySelector('td') : null);
    return {
      cols: t.querySelectorAll('thead th').length,
      groups: t.querySelectorAll('tbody tr.group').length,
      subs: t.querySelectorAll('tbody tr.subtotal').length,
      totals: t.querySelectorAll('tbody tr.total').length,
      totalWeight: td(total) ? getComputedStyle(td(total)).fontWeight : null,
      totalBg: td(total) ? getComputedStyle(td(total)).backgroundColor : null,
      negWeight: neg ? getComputedStyle(td(neg)).fontWeight : null,
      negColor: neg ? getComputedStyle(td(neg)).color : null,
      negCellBg: neg ? getComputedStyle(td(neg)).backgroundColor : null,
      rootstockCells: t.querySelectorAll('tbody tr.trow td[data-label="Portainnesto"]').length,
      rows: t.querySelectorAll('tbody tr.trow').length,
    };
  });
  ok(r.cols === 7, `report 1: 7 columns including the rootstock (${r.cols})`);
  ok(r.groups === 0 && r.subs === 0, `report 1: no grouping and no subtotals (${r.groups}/${r.subs})`);
  ok(r.totals === 1, `report 1: single grand-total row (${r.totals})`);
  ok(r.rootstockCells === r.rows, `report 1: every row carries its rootstock (${r.rootstockCells}/${r.rows})`);
  ok(String(r.totalWeight) === '700', `total row is bold (${r.totalWeight})`);
  ok(r.totalBg === 'rgb(233, 245, 239)', `total row tinted brand-50 (${r.totalBg})`);
  ok(r.negWeight === '700' && r.negColor === 'rgb(185, 28, 28)' && r.negCellBg === 'rgb(254, 242, 242)',
     `negative row keeps the red treatment (${r.negWeight}/${r.negColor}/${r.negCellBg})`);
  await ctx.close();
}
{
  const { page, ctx } = await open({ width: 1440, height: 900 }, '#/r/produttore');
  const m = await page.evaluate(() => {
    const t = document.querySelector('.grid');
    return {
      groups: t.querySelectorAll('tbody tr.group').length,
      subs: t.querySelectorAll('tbody tr.subtotal').length,
      subWeight: (() => {
        const sub = t.querySelector('tbody tr.subtotal td');
        return sub ? getComputedStyle(sub).fontWeight : null;
      })(),
      subBg: (() => {
        const sub = t.querySelector('tbody tr.subtotal td');
        return sub ? getComputedStyle(sub).backgroundColor : null;
      })(),
    };
  });
  ok(m.groups > 0 && m.subs > 0, `per-grower report still groups by rootstock (${m.groups} groups, ${m.subs} subtotals)`);
  ok(String(m.subWeight) === '700' && m.subBg === 'rgb(233, 245, 239)',
     `per-grower subtotals stay bold and tinted (${m.subWeight}/${m.subBg})`);
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

/* ---------------- table captions must be full-width blocks, not ribbons ---------------- */
for (const [w, wantWide] of [[390, false], [1024, true], [1440, true]]) {
  const { page, ctx } = await open({ width: w, height: 900 }, '#/r/produttore');
  const d = await page.evaluate(() => {
    const cap = document.querySelector('.table-cap');
    const table = document.querySelector('.grid');
    const report = cap.parentElement;
    const firstRow = table.querySelector('tbody tr');
    const cs = getComputedStyle(cap);
    const cr = cap.getBoundingClientRect();
    const rr = report.getBoundingClientRect();
    const visible = (sel) => {
      const el = cap.querySelector(sel);
      return el ? getComputedStyle(el).display !== 'none' : false;
    };
    return {
      display: cs.display,
      capW: Math.round(cr.width), boxW: Math.round(rr.width),
      capH: Math.round(cr.height),
      capBottom: Math.round(cr.bottom),
      firstTop: Math.round(firstRow.getBoundingClientRect().top),
      overflow: cap.scrollWidth - cap.clientWidth,
      wideShown: visible('.cap-wide'), narrowShown: visible('.cap-narrow'),
      wideText: (cap.querySelector('.cap-wide') || {}).textContent || '',
      narrowText: (cap.querySelector('.cap-narrow') || {}).textContent || '',
      described: table.getAttribute('aria-describedby') === cap.id,
      noCaptionEl: document.querySelectorAll('.grid caption').length,
    };
  });
  ok(d.display === 'block', `${w}px: caption is a block, not a table-caption (got ${d.display})`);
  ok(Math.abs(d.capW - d.boxW) <= 2, `${w}px: caption spans its container (${d.capW}/${d.boxW})`);
  ok(d.overflow <= 0, `${w}px: caption text does not overflow (${d.overflow})`);
  ok(d.capBottom <= d.firstTop + 1, `${w}px: caption does not overlap the first row (${d.capBottom} <= ${d.firstTop})`);
  ok(d.capH < 90, `${w}px: caption is compact (${d.capH}px)`);
  ok(d.noCaptionEl === 0, `${w}px: no <caption> element is used`);
  ok(d.described, `${w}px: the table is described by the caption`);
  ok(d.narrowShown === !wantWide && d.wideShown === wantWide,
     `${w}px: shows the ${wantWide ? 'wide' : 'narrow'} wording (wide=${d.wideShown} narrow=${d.narrowShown})`);
  ok(wantWide ? /scorrimento orizzontale/.test(d.wideText) : !/scorrimento orizzontale/.test(d.narrowText),
     `${w}px: the desktop-only sentence is ${wantWide ? 'present' : 'absent'}`);
  await ctx.close();
}

/* ------------- no banner anywhere may fragment into loose flex items ------------- */
for (const route of ['#/home', '#/r/disponibilita', '#/r/produttore', '#/r/indisponibilita',
                     '#/dati/ordini', '#/dati/import']) {
  const { page, ctx } = await open({ width: 390, height: 844 }, route);
  const bad = await page.evaluate(() => {
    return [...document.querySelectorAll('.banner')].map((bn) => {
      const kids = [...bn.children];
      const r = bn.getBoundingClientRect();
      const over = kids.some((k) => {
        const kr = k.getBoundingClientRect();
        return kr.right > r.right + 1;
      });
      return { kids: kids.length, over, wrap: getComputedStyle(bn).flexWrap };
    }).filter((x) => x.kids > 2 || x.over || x.wrap !== 'wrap');
  });
  ok(bad.length === 0, `${route} @390: every banner is well-formed (${JSON.stringify(bad)})`);
  await ctx.close();
}

/* ---------------- info banners must wrap, not fragment or overflow ---------------- */
for (const w of [390, 1440]) {
  const { page, ctx } = await open({ width: w, height: 900 }, '#/r/produttore');
  const d = await page.evaluate(() => {
    const banner = document.querySelector('.banner');
    if (!banner) return { none: true };
    const cs = getComputedStyle(banner);
    const b = banner.getBoundingClientRect();
    const kids = [...banner.children];
    const overflowing = kids.filter((k) => {
      const r = k.getBoundingClientRect();
      return r.right > b.right + 1 || r.left < b.left - 1;
    }).map((k) => k.tagName + '.' + k.className);
    const codes = [...banner.querySelectorAll('code')].map((c) => {
      const cs = getComputedStyle(c);
      return {
        text: c.textContent,
        overflows: c.scrollWidth > c.clientWidth + 1,
        background: cs.backgroundColor,
        mono: /mono|Courier/i.test(cs.fontFamily),
      };
    });
    return {
      children: kids.length,
      flexWrap: cs.flexWrap,
      scrollW: banner.scrollWidth, clientW: banner.clientWidth,
      overflowing,
      codes,
      height: Math.round(b.height),
      text: banner.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  ok(!d.none, `${w}px: per-grower note is rendered`);
  ok(d.children === 2, `${w}px: banner has exactly icon + text (got ${d.children} children)`);
  ok(d.flexWrap === 'wrap', `${w}px: banner wraps (got ${d.flexWrap})`);
  ok(d.overflowing.length === 0, `${w}px: no banner child overflows (${d.overflowing})`);
  ok(d.scrollW <= d.clientW + 1, `${w}px: banner text does not overflow its box (${d.scrollW}/${d.clientW})`);
  ok(d.codes.length === 2 && d.codes.every((c) => !c.overflows),
     `${w}px: the code tokens fit (${JSON.stringify(d.codes)})`);
  ok(d.codes.every((c) => c.background !== 'rgba(0, 0, 0, 0)'),
     `${w}px: code tokens are visually distinct (${d.codes.map((c) => c.background).join(' | ')})`);
  ok(d.codes.every((c) => c.mono), `${w}px: code tokens are set in a monospace face`);
  ok(/Non attribuito/.test(d.text), `${w}px: the note still explains Non attribuito`);
  ok(d.height < 220, `${w}px: the note is compact (${d.height}px)`);
  await ctx.close();
}

/* ---------------- scrolling must not be reset by the browser chrome ---------------- */
{
  const { page, ctx } = await open({ width: 390, height: 844 }, '#/r/disponibilita');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => Math.round(window.scrollY));
  ok(before > 300, `scrolled down to ${before}`);

  // mobile browsers resize the viewport when the address bar hides/shows while scrolling
  await page.setViewportSize({ width: 390, height: 724 });
  await page.waitForTimeout(500);
  const afterBar = await page.evaluate(() => Math.round(window.scrollY));
  ok(Math.abs(afterBar - before) < 40,
     `address-bar resize keeps the scroll position (${before} -> ${afterBar})`);

  // the on-screen keyboard does the same thing
  await page.setViewportSize({ width: 390, height: 480 });
  await page.waitForTimeout(500);
  const afterKb = await page.evaluate(() => Math.round(window.scrollY));
  ok(Math.abs(afterKb - before) < 40, `keyboard resize keeps the scroll position (${before} -> ${afterKb})`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);

  // a real navigation still opens at the top
  await page.evaluate(() => { location.hash = '#/r/indisponibilita'; });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => Math.round(window.scrollY)) < 20, 'a new page still opens at the top');

  await ctx.close();
}

/* an in-place refresh (ctx.refresh) must not move the reader either — on PC, where
   the orders list exists */
{
  const { page, ctx } = await open({ width: 1440, height: 900 }, '#/dati/ordini');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(150);
  const y1 = await page.evaluate(() => Math.round(window.scrollY));
  // click a row that is inside the viewport: page.click() would scroll the target
  // into view first, which would defeat the measurement
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-toggle]')];
    const filler = rows.find((b) => {
      const r = b.getBoundingClientRect();
      return r.top > 100 && r.bottom < window.innerHeight - 80;
    }) || rows[0];
    filler.click();
  });
  await page.waitForTimeout(450);
  const y2 = await page.evaluate(() => Math.round(window.scrollY));
  ok(y1 > 100, `scrolled the orders list to ${y1}`);
  ok(Math.abs(y2 - y1) < 60, `toggling Spedito keeps the position (${y1} -> ${y2})`);
  /* and a filter change, which IS a navigation, still goes back to the top */
  await page.evaluate(() => { location.hash = '#/r/disponibilita?tipologia=Barbatelle%20innestate'; });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => Math.round(window.scrollY)) < 20, 'changing a filter opens at the top of the results');
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
