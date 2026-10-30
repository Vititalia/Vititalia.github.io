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
    localStorage.setItem('vignero.backend', 'demo');
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
  ok(m.cols === 14, `matrix: 14 columns (got ${m.cols})`);
  ok(!m.headers.includes('Non attribuito') && !m.headers.includes('Tot. produttori'),
     `matrix: no unattributed/total-producers columns (${m.headers})`);
  ok(m.scrollW > m.clientW, `matrix: scrolls horizontally inside its panel`);
  ok(m.doc <= m.win + 1, `matrix: page itself does not scroll (${m.doc} > ${m.win})`);
  await ctx.close();
}

/* every table: each header must line up with its column's data */
for (const route of ['#/r/disponibilita', '#/r/produttore', '#/r/indisponibilita', '#/r/daspedire',
                     '#/dati/lotti', '#/dati/ordini', '#/anagrafiche/viti', '#/anagrafiche/portainnesti']) {
  const { page, ctx } = await open({ width: 1440, height: 900 }, route);
  const a = await page.evaluate(() => {
    const table = document.querySelector('.grid');
    if (!table) return { none: true };
    const ths = [...table.querySelectorAll('thead th')];
    const rows = [...table.querySelectorAll('tbody tr')];
    const rect = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    const bad = [];
    let rightAligned = 0;
    ths.forEach((th, i) => {
      const right = getComputedStyle(th).textAlign === 'right';
      if (right) rightAligned += 1;
      const hr = rect(th);
      let worst = 0, sample = null;
      for (const row of rows) {
        const td = row.children[i];
        if (!td || !td.firstChild) continue;
        const tr = rect(td);
        const d = Math.abs((right ? tr.right : tr.left) - (right ? hr.right : hr.left));
        if (d > worst) { worst = d; sample = td.textContent.trim().slice(0, 18); }
      }
      if (worst > 1.5) bad.push({ col: th.textContent.trim(), align: right ? 'right' : 'left', worst: +worst.toFixed(1), sample });
    });
    return { cols: ths.length, rightAligned, bad };
  });
  ok(!a.none, `${route}: table present for the alignment check`);
  if (a.none) { await ctx.close(); continue; }
  ok(a.bad.length === 0, `${route}: every header lines up with its data (${JSON.stringify(a.bad.slice(0, 3))})`);
  /* numeric reports must actually have right-aligned columns, so this test cannot pass vacuously */
  const numeric = /disponibilita|produttore|indisponibilita|daspedire|lotti|ordini|viti|portainnesti/.test(route);
  ok(!numeric || a.rightAligned >= 1, `${route}: numeric columns are right-aligned (${a.rightAligned})`);
  await ctx.close();
}

/* PC: the content column and every table must fill the page width */
for (const w of [1024, 1440, 1920]) {
  const pad = w >= 1440 ? 32 : 24;          // main padding per breakpoint
  for (const route of ['#/home', '#/r/disponibilita', '#/r/produttore', '#/dati/lotti']) {
    const { page, ctx } = await open({ width: w, height: 900 }, route);
    const m = await page.evaluate(() => {
      const main = document.getElementById('main');
      const cs = getComputedStyle(main);
      const rail = document.getElementById('rail');
      const box = document.querySelector('.report') || document.querySelector('.card');
      const grid = document.querySelector('.grid');
      const scroller = grid ? grid.closest('.table-scroll') : null;
      return {
        win: window.innerWidth,
        rail: Math.round(rail.getBoundingClientRect().width),
        mainW: Math.round(main.getBoundingClientRect().width),
        inner: Math.round(main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
        boxW: box ? Math.round(box.getBoundingClientRect().width) : null,
        rightGap: box ? Math.round(window.innerWidth - box.getBoundingClientRect().right) : null,
        gridW: grid ? Math.round(grid.getBoundingClientRect().width) : null,
        scrolls: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false,
      };
    });
    ok(Math.abs(m.mainW - (m.win - m.rail)) <= 1,
       `${w}px ${route}: content column fills the width (main ${m.mainW} vs ${m.win - m.rail})`);
    ok(m.boxW === null || Math.abs(m.boxW - m.inner) <= 2,
       `${w}px ${route}: the table card spans the content width (${m.boxW}/${m.inner})`);
    ok(m.rightGap === null || m.rightGap === pad,
       `${w}px ${route}: no empty band on the right (gap ${m.rightGap}, expected ${pad})`);
    ok(m.gridW === null || m.gridW <= m.inner + 1 || m.scrolls,
       `${w}px ${route}: the table fits or scrolls inside (grid ${m.gridW}, inner ${m.inner}, scrolls ${m.scrolls})`);
    await ctx.close();
  }
}

/* the two frozen columns must stay put while the matrix scrolls */
{
  const { page, ctx } = await open({ width: 1024, height: 900 }, '#/r/produttore');
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
    const sub = document.querySelector('.grid tbody tr.total td:nth-child(1)');
    return {
      before,
      after: {
        c1: Math.round(cell1.getBoundingClientRect().left),
        c2: Math.round(cell2.getBoundingClientRect().left),
        w1: Math.round(cell1.getBoundingClientRect().width),
        scrolled: Math.round(scroller.scrollLeft),
      },
      totalBg: sub ? getComputedStyle(sub).backgroundColor : null,
      totalWeight: sub ? getComputedStyle(sub).fontWeight : null,
    };
  });
  ok(pin.after.scrolled > 300, `matrix scrolled ${pin.after.scrolled}px`);
  ok(Math.abs(pin.after.c1 - pin.before.panel) <= 2,
     `first column stays pinned (${pin.after.c1} vs panel ${pin.before.panel})`);
  ok(Math.abs(pin.after.c2 - (pin.after.c1 + pin.after.w1)) <= 2,
     `second column stays pinned next to it (${pin.after.c2})`);
  ok(pin.totalBg === 'rgb(233, 245, 239)', `frozen total cell keeps the brand tint (${pin.totalBg})`);
  ok(String(pin.totalWeight) === '700', `frozen total cell stays bold (${pin.totalWeight})`);
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
  ok(r.cols === 6, `report 1: 6 columns, no «Da spedire» (${r.cols})`);
  ok(r.groups === 0 && r.subs > 0, `report 1: no grouping but a subtotal per rootstock (${r.groups}/${r.subs})`);
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
      totals: t.querySelectorAll('tbody tr.total').length,
    };
  });
  ok(m.groups === 0, `per-grower report has no group headers (${m.groups})`);
  ok(m.subs > 0, `per-grower report carries a subtotal per rootstock (${m.subs})`);
  ok(m.totals === 1, `per-grower report has one grand total (${m.totals})`);
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

/* anagrafica vite: a flat list with the variety filter, on PC and on a phone */
for (const w of [390, 1440]) {
  const { page, ctx } = await open({ width: w, height: 900 }, '#/anagrafiche/viti');
  const v = await page.evaluate(() => {
    const filterInput = document.querySelector('#varietyFilter input');
    const rows = document.querySelectorAll('.grid tbody tr.trow');
    const first = rows[0];
    return {
      groups: document.querySelectorAll('.grid tbody tr.group').length,
      rows: rows.length,
      filter: !!filterInput,
      filterLabel: filterInput ? getComputedStyle(filterInput.parentElement.parentElement.previousElementSibling || filterInput).display : null,
      rowDisplay: first ? getComputedStyle(first).display : null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  ok(v.groups === 0, `${w}px vite: no group rows (${v.groups})`);
  ok(v.rows > 0, `${w}px vite: rows rendered (${v.rows})`);
  ok(v.filter, `${w}px vite: variety filter present`);
  ok(v.rowDisplay === (w >= 760 ? 'table-row' : 'flex'),
     `${w}px vite: ${w >= 760 ? 'table rows' : 'cards'} (${v.rowDisplay})`);
  ok(v.overflow <= 1, `${w}px vite: no horizontal overflow`);
  await ctx.close();
}

/* the grower filter highlights that grower's column */
{
  const { page, ctx } = await open({ width: 1440, height: 900 }, '#/r/produttore?produttore=Mori%20Marco');
  const h = await page.evaluate(() => {
    const th = [...document.querySelectorAll('.grid thead th')];
    const hlCols = th.filter((t) => t.classList.contains('grower-hl'));
    const idx = hlCols.length ? th.indexOf(hlCols[0]) : -1;
    const firstRow = document.querySelector('.grid tbody tr.trow');
    const cells = firstRow ? [...firstRow.querySelectorAll('td')] : [];
    return {
      hlCount: hlCols.length,
      label: hlCols.length ? hlCols[0].textContent.trim() : null,
      thBg: hlCols.length ? getComputedStyle(hlCols[0]).backgroundColor : null,
      cellBg: idx >= 0 && cells[idx] ? getComputedStyle(cells[idx]).backgroundColor : null,
      rows: document.querySelectorAll('.grid tbody tr.trow').length,
    };
  });
  ok(h.hlCount === 1 && h.label === 'Mori Marco', `one highlighted column (${h.label})`);
  ok(h.thBg === 'rgb(233, 245, 239)' && h.cellBg === 'rgb(233, 245, 239)',
     `header and cells of the filtered column are tinted (${h.thBg}/${h.cellBg})`);
  ok(h.rows > 0, `filtered rows rendered (${h.rows})`);
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
for (const [w, route, expectCode] of [[1440, '#/dati/ordini', true], [390, '#/config/utenti', false]]) {
  const { page, ctx } = await open({ width: w, height: 900 }, route);
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
      const ccs = getComputedStyle(c);
      return {
        text: c.textContent,
        overflows: c.scrollWidth > c.clientWidth + 1,
        background: ccs.backgroundColor,
        mono: /mono|Courier/i.test(ccs.fontFamily),
      };
    });
    return {
      children: kids.length,
      flexWrap: cs.flexWrap,
      scrollW: banner.scrollWidth, clientW: banner.clientWidth,
      overflowing, codes,
      height: Math.round(b.height),
      text: banner.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  ok(!d.none, `${w}px ${route}: banner rendered`);
  if (d.none) { await ctx.close(); continue; }
  ok(d.children === 2, `${w}px ${route}: banner is icon + text (${d.children})`);
  ok(d.flexWrap === 'wrap', `${w}px ${route}: banner wraps`);
  ok(d.overflowing.length === 0, `${w}px ${route}: no banner child overflows`);
  ok(d.scrollW <= d.clientW + 1, `${w}px ${route}: banner text fits (${d.scrollW}/${d.clientW})`);
  if (expectCode) {
    ok(d.codes.length >= 1 && d.codes.every((c) => !c.overflows),
       `${w}px ${route}: code tokens fit (${d.codes.length})`);
    ok(d.codes.every((c) => c.background !== 'rgba(0, 0, 0, 0)' && c.mono),
       `${w}px ${route}: code tokens are distinct and monospace`);
    ok(/lotto/i.test(d.text), `${w}px ${route}: the note explains the lot link`);
  }
  ok(d.height < 260, `${w}px ${route}: the note stays compact (${d.height}px)`);
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
    const cards = [...document.querySelectorAll('.grid tbody tr.trow')];
    const card = cards[0];
    const next = cards[1];
    if (!card) return { none: true };
    const cs = getComputedStyle(card);
    const rect = (el) => el.getBoundingClientRect();
    const metrics = [...card.querySelectorAll('td.metric')];
    const normal = metrics.filter((m) => !m.classList.contains('grower') && !m.classList.contains('disp'));
    const growers = [...card.querySelectorAll('td.metric.grower')];
    const tops = (list) => list.map((el) => Math.round(rect(el).top));
    const nTops = tops(normal);
    const gTops = tops(growers);
    const labelOf = (el) => getComputedStyle(el, '::before').content.replace(/^"|"$/g, '');
    return {
      cards: cards.length,
      display: cs.display,
      radius: parseFloat(cs.borderTopLeftRadius),
      gap: next ? Math.round(rect(next).top - rect(card).bottom) : null,
      padTop: parseFloat(cs.paddingTop),
      titleSize: parseFloat(getComputedStyle(card.querySelector('td.ident')).fontSize),
      titleWeight: getComputedStyle(card.querySelector('td.ident')).fontWeight,
      hasChip: !!card.querySelector('td.cell-sub .ident'),
      chipRadius: card.querySelector('td.cell-sub .ident')
        ? parseFloat(getComputedStyle(card.querySelector('td.cell-sub .ident')).borderTopLeftRadius) : 0,
      metrics: metrics.length,
      metricLabel: normal.length ? labelOf(normal[0]) : null,
      metricValSize: normal.length ? parseFloat(getComputedStyle(normal[0]).fontSize) : null,
      metricLabelSize: normal.length ? parseFloat(getComputedStyle(normal[0], '::before').fontSize) : null,
      metricBoxBg: normal.length ? getComputedStyle(normal[0]).backgroundColor : null,
      normalPerRow: nTops.length ? nTops.filter((t) => t === nTops[0]).length : 0,
      growerPerRow: gTops.length ? gTops.filter((t) => t === gTops[0]).length : 0,
      dispFull: (() => {
        const disp = card.querySelector('td.metric.disp');
        return disp ? Math.round(rect(disp).width) : null;
      })(),
      cardW: Math.round(rect(card).width),
      thead: getComputedStyle(document.querySelector('.grid thead')).display,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      negCard: (() => {
        const n = document.querySelector('.grid tbody tr.negative');
        if (!n) return null;
        return { border: getComputedStyle(n).borderTopColor, bg: getComputedStyle(n).backgroundColor };
      })(),
      totalRow: (() => {
        const t = document.querySelector('.grid tbody tr.total');
        if (!t) return null;
        const cs2 = getComputedStyle(t);
        return { display: cs2.display, radius: parseFloat(cs2.borderTopLeftRadius), w: Math.round(rect(t).width) };
      })(),
    };
  });
  ok(!d.none, `${route} @390: cards rendered`);
  if (d.none) { await ctx.close(); continue; }
  ok(errs.length === 0, `${route} @390: no errors`);
  ok(d.thead === 'none', `${route} @390: table header hidden`);
  ok(d.display === 'flex', `${route} @390: each row is a card (${d.display})`);
  ok(d.radius >= 8 && d.padTop >= 8, `${route} @390: card has radius ${d.radius} and padding ${d.padTop}`);
  ok(d.gap !== null && d.gap >= 8, `${route} @390: cards are separated (${d.gap}px)`);
  ok(d.titleSize >= 14 && d.titleWeight === '700', `${route} @390: title is ${d.titleSize}px bold`);
  ok(d.hasChip && d.chipRadius >= 4, `${route} @390: rootstock shown as a chip`);
  ok(d.metricLabel && d.metricLabel.length > 2, `${route} @390: metrics are labelled ("${d.metricLabel}")`);
  ok(d.metricValSize > d.metricLabelSize,
     `${route} @390: value ${d.metricValSize}px reads larger than its ${d.metricLabelSize}px label`);
  ok(d.metricBoxBg !== 'rgba(0, 0, 0, 0)', `${route} @390: each metric is a tinted box`);
  ok(d.normalPerRow === 2, `${route} @390: two metrics per line (${d.normalPerRow})`);
  ok(d.dispFull !== null && Math.abs(d.dispFull - d.cardW) < 30,
     `${route} @390: the availability value spans the card (${d.dispFull}/${d.cardW})`);
  ok(d.overflow <= 1, `${route} @390: no horizontal overflow`);
  if (d.negCard) {
    ok(d.negCard.border === 'rgb(220, 38, 38)', `${route} @390: negative card is outlined red (${d.negCard.border})`);
  }
  if (d.totalRow) {
    ok(d.totalRow.display === 'flex' && d.totalRow.radius >= 8 && d.totalRow.w >= 300,
       `${route} @390: total row is a card too (${d.totalRow.w}px)`);
  }
  if (route === '#/r/produttore') {
    ok(d.growerPerRow === 4, `per-grower @390: grower values read four per line (${d.growerPerRow})`);
  }
  await ctx.close();
}

/* the shortage cards must read: one red value, neutral body, high contrast */
{
  const { page, ctx } = await open({ width: 390, height: 844 }, '#/r/indisponibilita');
  const d = await page.evaluate(() => {
    const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = ([r, g, bl]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
    };
    const contrast = (a, bb) => {
      const la = lum(parse(a)), lb = lum(parse(bb));
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const card = document.querySelector('.grid tbody tr.trow');
    if (!card) return { none: true };
    const cardCs = getComputedStyle(card);
    const cells = [...card.children].map((td) => {
      const s = getComputedStyle(td);
      const bg = s.backgroundColor === 'rgba(0, 0, 0, 0)' ? cardCs.backgroundColor : s.backgroundColor;
      const before = getComputedStyle(td, '::before');
      return {
        cls: td.className,
        label: (before.content || '').replace(/"/g, ''),
        labelFont: parseFloat(before.fontSize) || 0,
        font: parseFloat(s.fontSize),
        color: s.color, bg,
        contrast: contrast(s.color, bg),
        red: /185, 28, 28/.test(s.color),
        top: Math.round(td.getBoundingClientRect().top),
        h: Math.round(td.getBoundingClientRect().height),
      };
    });
    return {
      cardBg: cardCs.backgroundColor,
      cardBorder: cardCs.borderTopColor,
      cardH: Math.round(card.getBoundingClientRect().height),
      cells,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  ok(!d.none, 'shortage cards render');
  if (d.none) { await ctx.close(); }
  else {
    const reds = d.cells.filter((c) => c.red);
    ok(reds.length === 1, `only the deficit is red (${reds.length} red cells)`);
    ok(/Deficit/.test(reds[0].label), `and it is the deficit (${reds[0].label})`);
    ok(d.cardBg === 'rgb(255, 255, 255)', `the card body is neutral (${d.cardBg})`);
    ok(d.cardBorder === 'rgb(220, 38, 38)', `the card is outlined in red (${d.cardBorder})`);
    ok(d.cells.every((c) => c.contrast >= 4.5),
       `every value meets 4.5:1 (min ${Math.min(...d.cells.map((c) => c.contrast)).toFixed(2)})`);
    const ctxCells = d.cells.filter((c) => /ctx/.test(c.cls));
    ok(ctxCells.length === 2, `tipologia/produzione are context cells (${ctxCells.length})`);
    ok(ctxCells.every((c) => c.font <= 12 && c.labelFont <= 10),
       `context line is quiet (${ctxCells.map((c) => c.font + '/' + c.labelFont).join(', ')})`);
    ok(new Set(ctxCells.map((c) => c.top)).size === 1, 'the two context values share one line');
    const deficit = reds[0];
    ok(deficit.font >= 15, `the deficit is emphasised (${deficit.font}px)`);
    ok(d.cells.filter((c) => /metric/.test(c.cls) && !/disp/.test(c.cls))
        .every((c) => c.bg === 'rgb(246, 248, 250)'),
       'the other metrics sit on a neutral tint');
    ok(d.cardH <= 260, `the card stays compact (${d.cardH}px)`);
    ok(d.overflow <= 1, 'no horizontal overflow');
    await ctx.close();
  }
}

/* phone: reports can switch between cards and the full table */
{
  const { page, ctx } = await open({ width: 390, height: 844 }, '#/r/disponibilita');
  const first = await page.evaluate(() => {
    const t = document.querySelector('.view-toggle');
    const row = document.querySelector('.grid tbody tr.trow');
    return {
      toggle: !!t,
      segs: t ? [...t.querySelectorAll('.seg')].map((a) => a.textContent.trim()) : [],
      on: t ? t.querySelector('.seg.is-on').textContent.trim() : null,
      rowDisplay: row ? getComputedStyle(row).display : null,
      thead: getComputedStyle(document.querySelector('.grid thead')).display,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  ok(first.toggle, 'phone: the cards/table switch is offered');
  ok(first.segs.join('|') === 'Schede|Tabella', `phone: two options (${first.segs})`);
  ok(first.on === 'Schede', 'phone: cards are the default');
  ok(first.rowDisplay === 'flex' && first.thead === 'none', 'phone: cards by default');

  await page.click('.view-toggle .seg:nth-child(2)');
  await page.waitForTimeout(450);
  const table = await page.evaluate(() => {
    const row = document.querySelector('.grid tbody tr.trow');
    const scroller = document.querySelector('.report.table-mode .table-scroll');
    return {
      on: document.querySelector('.view-toggle .seg.is-on').textContent.trim(),
      rowDisplay: getComputedStyle(row).display,
      tdDisplay: getComputedStyle(row.querySelector('td')).display,
      thead: getComputedStyle(document.querySelector('.grid thead')).display,
      scrolls: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cols: document.querySelectorAll('.grid thead th').length,
    };
  });
  ok(table.on === 'Tabella', 'phone: table option selected');
  ok(table.rowDisplay === 'table-row' && table.tdDisplay === 'table-cell',
     `phone: the table really is a table (${table.rowDisplay}/${table.tdDisplay})`);
  ok(table.thead !== 'none', 'phone table mode: header row visible');
  ok(table.cols === 6, `phone table mode: same columns as the web (${table.cols})`);
  ok(table.scrolls, 'phone table mode: the table scrolls inside its panel');
  ok(table.overflow <= 1, 'phone table mode: the page itself does not scroll sideways');

  await page.click('.view-toggle .seg:nth-child(1)');
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => getComputedStyle(document.querySelector('.grid tbody tr.trow')).display);
  ok(back === 'flex', 'phone: switching back restores the cards');
  await ctx.close();
}

/* the «Da spedire» report is reachable from a phone too */
{
  const { page, ctx } = await open({ width: 390, height: 844 }, '#/r/daspedire');
  const d = await page.evaluate(() => ({
    locked: /solo da PC/i.test(document.getElementById('main').textContent),
    cards: document.querySelectorAll('.grid tbody tr.trow').length,
    toggle: !!document.querySelector('.view-toggle'),
  }));
  ok(!d.locked, '«Da spedire» is not gated to PC');
  ok(d.cards > 0, `«Da spedire» renders cards on a phone (${d.cards})`);
  ok(d.toggle, '«Da spedire» has the cards/table switch');
  await ctx.close();
}

/* ------------------- subtotal first, notes, producer report ---------------- */
{
  // report 1, per produttore: the subtotal opens the group (PD-7)
  for (const [route, label, cells] of [['#/r/disponibilita', 'disponibilità', 6],
                                       ['#/r/indisponibilita', 'indisponibilità', 7],
                                       ['#/r/produttore', 'per produttore', 14]]) {
    const { page, ctx } = await open({ width: 1440, height: 1000 }, route);
    const d = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.grid tbody tr')];
      const first = rows[0];
      const sub = rows.find((r) => r.classList.contains('subtotal'));
      const after = sub ? sub.nextElementSibling : null;
      const td = (tr) => [...tr.querySelectorAll('td')];
      const codeOf = (tr) => {
        const td2 = tr.querySelector('td[data-label="Portainnesto"]');
        return td2 ? td2.textContent.trim() : null;
      };
      return {
        firstIsSubtotal: first ? first.classList.contains('subtotal') : false,
        subCells: sub ? td(sub).length : 0,
        subCode: sub ? codeOf(sub) : null,
        nextCode: after ? codeOf(after) : null,
        subFirstCol: sub ? td(sub)[0].textContent.trim() : '',
        sticky: !!document.querySelector('.grid.matrix thead th'),
      };
    });
    ok(d.firstIsSubtotal, `${label}: subtotal row first in the group`);
    ok(d.subCells === cells, `${label}: subtotal carries ${cells} cells (${d.subCells})`);
    ok(d.subCode && d.subCode === d.nextCode,
       `${label}: the subtotal belongs to the cloni that follow (${d.subCode} / ${d.nextCode})`);
    ok(/Totale per portainnesto/.test(d.subFirstCol), `${label}: labelled «Totale per portainnesto»`);
    await ctx.close();
  }

  // ordini: the note column is readable and does not stretch the page
  const { page, ctx } = await open({ width: 1440, height: 1000 }, '#/dati/ordini');
  const ord = await page.evaluate(() => {
    const th = [...document.querySelectorAll('.grid thead th')].map((t) => t.textContent.trim());
    const cell = document.querySelector('.grid tbody tr.trow td.note-cell');
    const csv = [...document.querySelectorAll('.page-head .btn')].map((b) => b.textContent.trim());
    return {
      th, hasNoteCell: !!cell,
      wrap: cell ? getComputedStyle(cell).whiteSpace : null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      buttons: csv,
    };
  });
  ok(ord.th.includes('Note'), `ordini: Note column in the header (${ord.th.join(' · ')})`);
  ok(ord.hasNoteCell, 'ordini: every row has a note cell');
  ok(ord.wrap === 'pre-wrap', `ordini: notes keep their line breaks (${ord.wrap})`);
  ok(ord.buttons.includes('Esporta CSV'), `ordini: Esporta CSV button (${ord.buttons.join(' · ')})`);
  ok(ord.overflow <= 1, `ordini: the wider table still fits the page (${ord.overflow}px)`);
  await ctx.close();

  const lotti = await open({ width: 1440, height: 1000 }, '#/dati/lotti');
  const lotBtns = await lotti.page.evaluate(() =>
    [...document.querySelectorAll('.page-head .btn')].map((b) => b.textContent.trim()));
  ok(lotBtns.includes('Esporta CSV'), `lotti: Esporta CSV button (${lotBtns.join(' · ')})`);
  await lotti.ctx.close();
}

/* ---------------- typing in a search box keeps the caret (real typing) ---------------- */
{
  for (const [route, label] of [['#/dati/lotti', 'lotti'], ['#/dati/ordini', 'ordini'],
                                ['#/anagrafiche/portainnesti', 'portainnesti']]) {
    const { page, ctx } = await open({ width: 1440, height: 900 }, route);
    await page.click('#q');
    await page.type('#q', 'CH', { delay: 40 });
    await page.waitForTimeout(700);          // debounce (250) + re-render
    const d = await page.evaluate(() => {
      const el = document.getElementById('q');
      return {
        focused: document.activeElement === el,
        caret: el.selectionStart,
        value: el.value,
        typedMore: (() => {
          // the next keystroke must land in the same box, at the caret
          el.setRangeText('A', el.selectionStart, el.selectionEnd, 'end');
          return el.value;
        })(),
      };
    });
    ok(d.focused, `${label}: the search box keeps the focus after the automatic refresh`);
    ok(d.caret === 2 && d.value === 'CH', `${label}: caret and text preserved (${d.value} @ ${d.caret})`);
    ok(d.typedMore === 'CHA', `${label}: typing continues in the same box (${d.typedMore})`);
    await ctx.close();
  }
}

/* ------------------------- password sheets on a phone ---------------------- */
{
  const { page, ctx } = await open({ width: 390, height: 844 }, '#/profilo');
  const card = await page.evaluate(() => ({
    btn: !!document.getElementById('changePwBtn'),
    txt: document.getElementById('main').textContent.includes('Cambia la password'),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  ok(card.btn, 'profilo (phone): «Cambia password» button');
  ok(card.txt, 'profilo (phone): the section explains the rule');
  ok(card.overflow <= 1, `profilo (phone): no sideways scroll (${card.overflow}px)`);

  await page.click('#changePwBtn');
  await page.waitForSelector('#ownPwForm');
  const sheet = await page.evaluate(() => {
    const s = document.querySelector('#sheetRoot .sheet');
    const inputs = [...s.querySelectorAll('input')];
    return {
      inputs: inputs.length,
      types: inputs.map((i) => i.type),
      hidden: inputs.every((i) => getComputedStyle(i).visibility !== 'hidden'),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      actions: [...s.querySelectorAll('.sheet-actions .btn')].map((b) => b.textContent.trim()),
      box: Math.round(s.getBoundingClientRect().width),
    };
  });
  ok(sheet.inputs === 3 && sheet.types.every((t) => t === 'password'),
     `profilo sheet: three password fields (${sheet.types.join(',')})`);
  ok(sheet.actions.includes('Salva password'), `profilo sheet: actions (${sheet.actions.join(' · ')})`);
  ok(sheet.box <= 390, `profilo sheet fits the phone (${sheet.box}px)`);
  ok(sheet.overflow <= 1, `profilo sheet: no sideways scroll (${sheet.overflow}px)`);
  await ctx.close();
}

/* producer phone: cards, subtotal first, no «da spedire» */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('vignero.session.v1', JSON.stringify({
        userId: 'u-produttore', email: 'produttore@vignero.it', name: 'Marco Rossi',
        role: 'produttore', grower: 'Mori Marco', issuedAt: Date.now(), exp: Date.now() + 3600000,
      }));
      localStorage.setItem('vignero.demo.dismissed', '1');
      localStorage.setItem('vignero.backend', 'demo');
    } catch {}
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto(BASE + '#/home', { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  const home = await page.evaluate(() => ({
    txt: document.getElementById('main').textContent,
    shipTile: document.querySelectorAll('.apptile[href="#/r/daspedire"]').length,
    messoTile: document.querySelectorAll('.apptile[href="#/r/messodisposizione"]').length,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  ok(!/Da spedire/.test(home.txt), 'producer phone home: no «Da spedire»');
  ok(home.shipTile === 0 && home.messoTile === 1, 'producer phone home: the tiles are the new set');
  ok(home.overflow <= 1, `producer phone home: no sideways scroll (${home.overflow}px)`);

  await page.goto(BASE + '#/r/messodisposizione', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const rep = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.grid tbody tr')];
    const first = rows[0];
    return {
      cards: rows.filter((r) => r.classList.contains('trow')).length,
      firstIsSubtotal: first ? first.classList.contains('subtotal') : false,
      firstText: first ? first.textContent.replace(/\s+/g, ' ').trim() : '',
      display: first ? getComputedStyle(first).display : null,
      totals: document.querySelectorAll('.grid tbody tr.total').length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      grower: document.getElementById('main').textContent.includes('Mori Marco'),
      toggle: !!document.querySelector('.view-toggle'),
    };
  });
  ok(rep.cards > 0, `messo (phone): cards rendered (${rep.cards})`);
  ok(rep.display === 'flex', `messo (phone): the subtotal is a card (${rep.display})`);
  ok(rep.firstIsSubtotal && /Totale per portainnesto/.test(rep.firstText),
     `messo (phone): subtotal card first («${rep.firstText.slice(0, 60)}»)`);
  ok(rep.totals === 1, 'messo (phone): one grand total card');
  ok(rep.grower, 'messo (phone): the producer is named');
  ok(rep.toggle, 'messo (phone): cards/table switch available');
  ok(rep.overflow <= 1, `messo (phone): no sideways scroll (${rep.overflow}px)`);
  ok(errs.length === 0, `messo (phone): no page errors (${errs.join('; ')})`);
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
