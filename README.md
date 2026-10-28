# Vignero · Fede Magazzino

Warehouse availability console for a grapevine nursery: it records deliveries into the warehouse
(`lotti_magazzino`), the commitments against them (`ordini_impegni`), and turns both into the three
reports the business runs on — **disponibilità**, **disponibilità per produttore**, **indisponibilità**.

A single responsive web app: **grouped cards on a phone, real data grids on a PC**, with data entry
deliberately restricted to PC.

**Live app:** <https://gabriele-scivoletto-1992.github.io/Vignero/>

---

## What it does

| Role | Can do | Devices |
|---|---|---|
| **Amministratore** | Everything: entry, imports, master data, roles matrix | PC + phone (read) |
| **Amministrazione** | Data entry (form or CSV import), all three reports | PC + phone (read) |
| **Produttore** | Read the availability and shortage reports | phone first |
| **Vendite** | Read the availability report only — the most restricted module | phone first |

### Accounts

Sign in at the login screen with one of the four demo users — the session determines the role, and
navigation, routes and data are all gated by the same permission matrix (`js/permissions.js`), also
shown in-app under *Ruoli e permessi*.

| Profile | Email | Password | Notes |
|---|---|---|---|
| Amministratore | `admin@vignero.it` | `Admin#2026` | everything, including *Ruoli e permessi* |
| Amministrazione | `ufficio@vignero.it` | `Ufficio#2026` | data entry + all reports |
| Produttore | `produttore@vignero.it` | `Produttore#2026` | linked to the grower *Mori Marco*, read-only |
| Vendite | `vendite@vignero.it` | `Vendite#2026` | availability report only |

The same list is available in the collapsible *Account dimostrativi* block on the login screen (each
row has a **Usa** button that fills and submits the form) and under *Profilo*.

> **The authentication is a client-side demo.** Credentials are checked in the browser against a
> static list (`js/auth.js`), the session is a `localStorage` record with an 8-hour expiry, and it
> protects nothing — anyone can set the session themselves. It exists to demonstrate the login flow,
> the guarded routes and the role-derived navigation. A real deployment must authenticate on a server
> and return a signed token.

### Screens

| Route | Screen | Notes |
|---|---|---|
| `#/login` | Accedi | email + password, one account per profile, session of 8 h; **signing in always opens Home** |
| `#/home` | Panoramica | launcher: one tile per page the role can open | 4 KPIs, recent lots, top shortages, report shortcuts |
| `#/r/disponibilita` | Riepilogo disponibilità | **flat list** — rootstock is a column and a filter; single grand total; negative rows bold red |
| `#/r/produttore` | Riepilogo per produttore | **flat list**, 16 columns (8 growers + *Non attribuito* + total); filters include **Portainnesto** and **Produttore** (highlights that column); clone and rootstock columns frozen |
| `#/r/indisponibilita` | Indisponibilità | deficit only, sorted varietà → portainnesto → clone |
| `#/dati/lotti` | Lotti magazzino | entry form with dependent variety → clone select |
| `#/dati/ordini` | Ordini e impegni | inline *Spedito* toggle with undo, lot picker prefills dimensions |
| `#/dati/import` | Import CSV | validate-then-write, per-row errors, exportable error report |
| `#/anagrafiche/viti` | Anagrafica vite | one row per variety+clone pair, grouped by variety |
| `#/anagrafiche/portainnesti` | Anagrafica portainnesto | code + usage count |
| `#/config/permessi` | Ruoli e permessi | the matrix the app enforces |
| `#/profilo` | Profilo | session + logout, reset local edits, demo accounts |

Filters are single-select and live **in the URL**, so a filtered report can be shared or refreshed:
Tipologia, Produzione and searchable Codice varietà everywhere; **Codice portainnesto** on both report
(the rootstock is a filter, not a grouping level); and **Produttore** on the per-grower report, which
keeps only the combinations involving that grower and highlights their column.

### Home as a launcher

Home is built as an app-style launcher rather than a dashboard dump: the pages you can open are
grouped (*Riepiloghi · Dati · Anagrafiche · Sistema*) and each is a large tile with an icon, a one-line
description and, where useful, a badge (shortage count on *Indisponibilità*, open orders on
*Ordini*). Tiles are filtered by the signed-in role, so the screen shows exactly the pages that exist
for you — 10 for Amministratore, 9 for Amministrazione, 3 for Produttore, 2 for Vendite. On a phone the
data-entry tiles stay visible but are marked **Solo da PC** (dashed border, lock icon) and open the
explanatory gate, so the map of the app is never a lie. Two compact KPIs sit above the launcher on a
phone (four from 640 px), and the recent-lots and shortage panels follow below it.

### Responsive behaviour

- **≤759 px** — every table becomes a list of cards, one per row: a title line (clone code in mono, the
  variety beneath), the rootstock as a chip, then labelled field boxes — two per line, values 14 px over
  10 px labels, the availability value full width and emphasised, and the grower values four per line
  on the per-grower report. Negative rows are outlined and tinted red, and the grand total is a card
  too. No horizontal page scrolling.
- **≥1024 px** — sidebar navigation and true data grids: real `table-row`/`table-cell` layout, a
  sticky header row, and frozen clone/rootstock columns. The content column and its tables span the
  **full width** between the sidebar and the page edge (no centred max-width, no empty band), and a
  table that still cannot fit scrolls inside its own panel instead of being clipped. The per-grower matrix (16 columns) scrolls inside its
  own panel, never the page.
- **No scroll hijacking**: the browser chrome resizing the viewport while you scroll (address bar
  hiding/showing, on-screen keyboard) never re-renders the page, and an in-place refresh (saving a
  lot, toggling *Spedito*, typing in a search field) keeps your scroll position. Only a real
  navigation — new page, filter change, back/forward — opens at the top.
- **Data entry** requires ≥1024 px; on a phone `#/dati/*` renders an explicit "solo da PC" card
  instead of a half-working form.

## Data

The published demo ships **real structure with synthetic quantities** — variety/clone/rootstock codes
and the eight member-grower names are real, but commercial figures are perturbed and are not the
company's real numbers. The app also keeps any local edit in `localStorage` (nothing is sent anywhere):

- **Specifica GUI:** [`docs/01-gui-specification.md`](docs/01-gui-specification.md)
- **Mockup draw.io (10 pages):** [`docs/mockups/fede-magazzino-mockup.drawio`](docs/mockups/fede-magazzino-mockup.drawio)
- **Schema dump:** [`docs/db-schema.sql`](docs/db-schema.sql)

The metric definitions match the database views `riepilogo_disponibilita` and
`vista_disponibilita_negative` exactly — verified by `node tests/verify_against_views.mjs` against the
live database (that check uses a real-data snapshot which is never committed).

## Run locally

Any static file server works; ES modules need HTTP, not `file://`:

```bash
python3 -m http.server 8099     # then open http://localhost:8099
# or: npm run serve
```

## Tests

```bash
npm install                                  # jsdom + playwright
npx playwright install chromium              # once, for the layout test
npm test                                     # engine invariants (650) + DOM smoke test (74)
npm run test:layout                          # real-browser layout test (111 assertions)
```

- `tests/engine.test.mjs` — every metric identity (`disponibilità = magazzino − ordinato`,
  subtotals = sum of rows, totals = sum of subtotals), sort orders, filter behaviour and the
  validation rules (F-V1…F-V8).
- `tests/smoke.mjs` — boots the real app in jsdom, exercises the **login form** (wrong password,
  unknown e-mail, each of the four accounts, logout, and the redirect back to the route requested
  before signing in), walks all routes for all four roles, checks the permission gates, and drives the
  lot form, the order form, the *Spedito* toggle and master-data creation end to end.
- `tests/layout.mjs` — opens the app in Chromium and asserts **how it renders**: rows are
  `table-row`/`table-cell` on PC (not cards), headers are sticky, numeric columns right-aligned, the
  16-column matrix scrolls inside its panel without widening the page, subtotal rows are bold on
  brand-50, negative rows bold on danger-50, and the card layout only appears at ≤759 px. Runs against
  a local server, or against the live site with `LIVE_BASE=https://… npm run test:layout`.
- `tests/verify_against_views.mjs` — compares the JS engine with the database views (local only).

## Architecture

```
index.html              app shell (app bar, rail, tab bar, sheet root)
assets/styles.css       design tokens + the table→cards transform
js/store.js             data loading, aggregation engine, validation, mutations, CSV
js/permissions.js       roles, capability matrix, navigation definition
js/filters.js           the shared filter bar
js/ui.js                formatting, responsive table builder, sheets, combobox
js/views-reports.js     login, home, the three reports, matrix, profile
js/views-data.js        lots, orders, CSV import, master data
js/auth.js              demo users (one per profile), authenticate(), session store
js/app.js               router, session state, guards, chrome
data/snapshot.json      the demo dataset
tests/                  engine, DOM smoke, DB-view verification
scripts/                optional tooling that built the snapshot (see scripts/README.md)
```

No build step, no framework, no backend: static files + `fetch` of one JSON snapshot.

## Deploy

GitHub Pages serves the **`gh-pages`** branch (root). `main` is the development branch, so publishing
is two commands:

```bash
git push origin main            # development branch
git push origin main:gh-pages   # publish to the live site (~1 min build)
```

The site is a plain static bundle, so no build step or CI is required (and the repository token used
here cannot create workflow files). `.nojekyll` keeps Jekyll out of the way.

## Known limitations / next steps

- Writes are local (`localStorage`), because Pages is static. A real deployment needs the API
  behind `/dati/*`; the store layer is already the only place that would change.
- The *Non attribuito* column exists because no order in the source data points at a lot; connecting
  orders to lots (and grower attribution) is the highest-value next data change.
- Master-data screens support create + duplicate detection; edit/deactivate needs the `attiva` column
  that the current schema does not have.
