# GUI Specification — Fede Magazzino

**Vineyard-nursery warehouse and availability management console**

| Field | Value |
|---|---|
| Document | `docs/01-gui-specification.md` |
| Requirements source | `docs/requirements.md` (verbatim copy of `specs`) |
| Companion mockup | `docs/mockups/fede-magazzino-mockup.drawio` (+ generator `build_mockup.py`) |
| Status | Draft v1.0 — for review |
| UI language | Italian (domain terms are Italian) · Spec prose: English |
| Primary devices | Smartphone (portrait) for consultation · PC for data entry |

---

## 0. Document control

### 0.1 Conventions

- **UI copy, database identifiers and report titles are written in Italian**, exactly as an Italian-speaking operator will see or read them (`Riepilogo disponibilità`, `Codice varietà`, `lotti_magazzino`).
- Screen IDs `S-nn` and overlay IDs `M-nn` match the page and frame labels of the mockup file.
- A field marked **⟨TBD-schema⟩** is not derivable from the requirements document and must be confirmed against the live PostgreSQL schema before implementation.
- Quantities are written `1 250` in this document for readability; the UI renders them in Italian locale as `1.250`.

### 0.2 Requirement → specification traceability

| Req. §  | Requirement | Spec sections |
|---|---|---|
| R1 | Warehouse `lotti_magazzino`, 8 growers | §2, §3, S-13 |
| R2 | Orders/commitments `ordini_impegni` | §3, S-14 |
| R3 | Tipologia / Produzione / varietà / clone / portainnesto dimensions | §3 |
| R4 | Master data `anagrafica_vite`, `anagrafica_portainnesto` | S-16, S-17 |
| R5 | Validation: variety constrained, clone depends on variety, rootstock constrained | §3.4, S-13, S-14, S-15 |
| R6 | 4 roles, different capabilities | §2 |
| R7 | Availability summary (`riepilogo_disponibilità`) with entered/ordered/shipped/available | §3.5, S-04, S-05 |
| R8 | Filters Tipologia / Produzione / Codice varietà (searchable) | S-10, S-04, S-05 |
| R9 | Grouping by clone + rootstock, sort by rootstock, subtotals per rootstock — **superseded**: the rootstock became a filter, no grouping (§15.3 PD-1) | §3.6, S-04, S-05 |
| R10 | Negative availability → whole row bold red | §3.7, S-04, S-08 |
| R11 | Per-grower availability summary (Admin + Amministrazione only) | S-06, S-07 |
| R12 | Unavailability/shortages report | S-08, S-09 |
| R13 | Responsive across phone/tablet/PC for output tables | §4 |
| R14 | Data-entry screens PC-only | §4.3 |
| R15 | Excel upload into both tables | S-15 |
| R16 | Admin can create/modify forms and screens | S-18 |

---

## 1. Overview

### 1.1 Purpose

The nursery ships grapevine cuttings (barbatelle) and rootstocks to client vineyards. Eight member growers deliver material into a shared warehouse; commercial orders commit quantities out of it. Without a single system of record, the same questions recur by phone and e-mail: *how much of this clone do we actually have left, and whose is it?*

**Fede Magazzino** is the answer to that question. It records warehouse lots and commercial commitments, and turns them into three authoritative views: total availability, availability per grower, and shortages.

### 1.2 Product summary

| Capability | Who | Screen |
|---|---|---|
| Sign in, role-scoped navigation | All | S-01 |
| Dashboard with availability health | All (role-filtered) | S-02, S-03 |
| Availability summary (magazzino, ordinato, di cui spedito, disponibilità) | All | S-04, S-05 |
| Availability summary per grower (8 grower columns) | Admin, Amministrazione | S-06, S-07 |
| Unavailability / shortages | Admin, Amministrazione, Produttore | S-08, S-09 |
| Data entry of warehouse lots | Admin, Amministrazione (PC) | S-13 |
| Data entry of orders/commitments | Admin, Amministrazione (PC) | S-14 |
| Excel bulk import into both tables | Admin, Amministrazione (PC) | S-15 |
| Variety/clone master data | Admin (PC) | S-16 |
| Rootstock master data | Admin (PC) | S-17 |
| Form/screen builder | Admin (PC) | S-18 |
| Users, roles and permissions | Admin (PC) | S-19 |
| Profile and session | All | S-20 |

### 1.3 Goals

| # | Goal | GUI consequence |
|---|---|---|
| G1 | Any role can read availability on a phone in seconds | Report screens are the mobile-first core; filters are one tap away and never block the table |
| G2 | Shortages are impossible to miss | Negative availability is bold red **and** additionally flagged with an icon and a count in the dashboard KPI |
| G3 | Data entry stays trustworthy in the master data | Dependent selects (variety → clone), constrained selects (rootstock), inline validation, Excel import with a mandatory validation step |
| G4 | Nobody edits data by accident on a phone | Entry screens are unreachable below 1024 dp; a phone shows an explicit "available on PC" notice |
| G5 | Each role sees only its own data | Navigation is generated from the permission matrix; unauthorised routes render M-05, never an empty table |
| G6 | Wide, numeric tables remain legible at 390 dp | Grouped card + metric-strip layout instead of a squeezed grid (§4.2) |

### 1.4 Non-goals (v1)

- Invoicing, transport documents, lot traceability to the client vineyard block.
- Client-facing (external) access — the eight growers are internal members.
- Native mobile applications; the mobile experience is the responsive web app plus PWA install.
- Offline data entry; mobile is read-only by design.
- Charts/BI beyond the three specified reports (deferred to v2).

### 1.5 Success metrics

| Metric | Target |
|---|---|
| Time on phone: open → availability filtered by variety | ≤ 20 s |
| Report first paint (p75, 4G, mid Android) | ≤ 1.5 s |
| Negative rows escaping the red treatment | 0 (hard invariant) |
| Excel import rows rejected without an actionable reason | 0 |
| Data-entry error rate on new lots (invalid variety/clone/rootstock) | ≤ 1 % |
| WCAG 2.2 AA conformance | 100 % of screens |
| Desktop report usable without horizontal scroll at 1280 dp | Yes (per-grower table excepted) |

---

## 2. Users, roles and permissions

### 2.1 Roles

| Role (UI label) | Code | Who | Device | Essence |
|---|---|---|---|---|
| **Amministratore** | `admin` | Owner of the system | PC + phone | Configures everything: forms, master data, users; also enters data and reads all reports |
| **Amministrazione** | `ufficio` | Office staff who record deliveries and orders | PC (phone: read-only reports) | Enters quantities (UI or Excel), reads all reports |
| **Produttore** | `produttore` | One of the 8 member growers | Phone mostly | Reads availability and shortages — read-only |
| **Vendite** | `vendite` | Commercial / sales staff | Phone | Reads the availability summary only (restricted subset) |

Grower list (closed, seeded): Mori Marco · Donati · Agriserv · Vivai riuniti · Bianchi · Golferenzo · Lorin · Esterno.

> **Decision to confirm (§15 Q3):** whether a `produttore` user is bound to exactly one grower and therefore sees only their own quantities, or sees the shared totals. This spec assumes **totals visible, own quantities highlighted** and a per-grower breakdown restricted to Admin/Amministrazione (as required), so the grower's "own column" is emphasised in S-04's detail sheet.

### 2.2 Permission matrix (authoritative; navigation is generated from it)

Legend: **E** = enter/edit · **R** = read · **R\*** = read, aggregated totals only · **—** = hidden

| Capability / screen | Admin | Amministrazione | Produttore | Vendite |
|---|---|---|---|---|
| S-02/S-03 Dashboard | R | R | R | R |
| S-04/S-05 Riepilogo disponibilità | R | R | R | R |
| S-06/S-07 Riepilogo per produttore | R | R | — | — |
| S-08/S-09 Mancanze (indisponibilità) | R | R | R | — |
| S-23 Messo a disposizione | — | — | R | — |
| S-13 Lotti magazzino | E | E | — | — |
| S-14 Ordini e impegni | E | E | — | — |
| S-15 Import Excel | E | E | — | — |
| S-16 Anagrafica vite | E | R | — | — |
| S-17 Anagrafica portainnesto | E | R | — | — |
| S-18 Form builder | E | — | — | — |
| S-19 Utenti e ruoli | E | — | — | — |
| S-20 Profilo | R | R | R | R |
| Export a report (S-12) | Y | Y | Y | Y |
| Export per-grower report | Y | Y | No (hidden) | No |

Notes

- Requirement says "Admin: allows creating and modifying forms/screens, entering values, and viewing tables" and "Amministrazione: allows data entry … as well as viewing output tables" — hence Admin and Amministrazione are functional peers on data entry; Admin additionally owns configuration.
- "Vendite: view-only access to output tables (a restricted subset)" → the subset is **Riepilogo disponibilità only**; Indisponibilità and the per-grower report are hidden.
- Hiding a control is never the only control: every route and endpoint is additionally authorised server-side by role (see §12).

### 2.3 Jobs to be done

| JTBD | Persona | Today | With Fede |
|---|---|---|---|
| "How much of clone X of variety Y do we still have?" | Vendite | Phone call to the office | Filter by variety, read the disponibilità column |
| "Is anything oversold?" | Amministrazione | Manual spreadsheet review | Open Indisponibilità, count the red rows |
| "Record this morning's delivery from Donati" | Amministrazione | Keyboard into a spreadsheet | Lotti magazzino → Nuovo lotto → dependent selects |
| "Load the whole harvest in one go" | Amministrazione | Re-typing | Excel import with validation report |
| "Which grower has stock of this rootstock?" | Admin | Ask around | Riepilogo per produttore |
| "Add a new clone of variety Chardonnay" | Admin | Ask the developer | Anagrafica vite → Nuova varietà/clone → immediately available in all selects |
| "Add a field to the lot entry form" | Admin | Change request to a developer | Form builder → add field → publish |

### 2.4 Key scenarios

**SC-1 — Sales checks availability on a phone.**
Login (`vendite`) → Dashboard shows *Disponibilità totale* and a shortcut to the last-used filter → *Riepiloghi* → **Riepilogo disponibilità** → taps the filter bar → **M-03 Filtri** → Tipologia `Barbatelle innestate`, Produzione `Vaso` → search field types `chard` → taps `CH-01` → sheet closes, table reloads in 700 ms → rootstock groups render, subtotal rows bold on tinted background → one clone row is bold red with a `−` availability (`-450`) → taps it → **S-11** detail sheet shows magazzino 0, ordinato 450, spedito 200 → closes app. 22 s.

**SC-2 — Office records a delivery and the day's orders.**
PC, `ufficio` → Lotti magazzino → *Nuovo lotto* → Produttore `Donati`, Tipologia, Produzione → Codice varietà searchable select → **Codice clone is disabled until a variety is chosen**, then offers only that variety's clones → Portainnesto select lists only master-data codes → Quantità → Salva → row appears at the top, master data validated, toast "Lotto salvato".
Then Ordini e impegni → same dependent-select rules → sets `Spedito` on two orders → the *spedito* figure in the availability report moves accordingly.

**SC-3 — Bulk import with errors.**
Import Excel → drags `lotti_ottobre.xlsx` → column mapping auto-detects 8 of 9 columns, operator maps `Quantità` manually → **Validazione** finds 3 invalid rows (unknown variety `CH-99`, clone not belonging to the variety, negative quantity) → error table lists row number, column, value and reason → operator fixes the file and re-uploads → 412 rows imported, toast + summary card.

**SC-4 — Admin finds a shortage and notifies.**
PC, `admin` → Dashboard KPI *Articoli in indisponibilità: 7* is a red card → tap → **S-09 Indisponibilità** sorted by varietà, portainnesto, clone → sees `Mori Marco` short of 1 200 plants of a rootstock → exports PDF → sends.

**SC-5 — A grower checks their own stock on a phone.**
`produttore` login → Home shows only two report tiles (Disponibilità, Indisponibilità) → opens Indisponibilità → filtered chips show no grower filter (they see aggregate) → the rows involving their grower are marked `•` with their own quantities shown in the detail sheet.

**SC-6 — PC-only gate on a phone.**
A `ufficio` user opens the app on a phone and taps *Dati* in the tab bar → instead of the entry screens, an explicit card: "*Inserimento dati disponibile solo da PC*" with a *Copia link* action. No partial editing UI on mobile.

---

## 3. Data domain

Grounded in the delivered schema (`docs/db-schema.sql`, a Supabase/PostgreSQL dump). The dump contains **four tables and no views**; the report views referenced by the requirements still have to be created (§3.8).

### 3.1 Delivered schema, at a glance

| Object | Columns (business-relevant) | Notes |
|---|---|---|
| `anagrafica_vite` | `id` (text PK) · `codice_varieta` · `codice_clone` · `created_at` | **One row per variety+clone pair** — there is no separate clone table and no description column |
| `anagrafica_portainnesto` | `codice_portainnesto` (PK) · `created_at` | Code only, no description |
| `lotti_magazzino` | `id` (uuid PK) · `tipologia` · `produzione` · `codice_varieta` · `codice_clone` · `codice_portainnesto` · `produttore` · `anno_conferimento` · `quantita` · `note` · `created_at` | Warehouse lots |
| `ordini_impegni` | `id` (uuid PK) · `id_magazzino` · `tipologia` · `produzione` · `codice_varieta` · `codice_clone` · `codice_portainnesto` · `quantita` · `spedito` · `note` · `created_at` | Commitments; `id_magazzino` points at a lot |

Facts that drive the interface:

1. **There is no date column.** Lots carry `anno_conferimento` (integer year) plus `created_at`; orders carry only `created_at`. The UI must therefore speak in **years**, not dates (§3.4, F-V6).
2. **There is no customer column.** An order is not sold to a named customer in this schema: it points at a warehouse lot through `id_magazzino`. Order entry is a *commitment against a lot*, and any S-13/S-14 "cliente" field from a generic design is wrong here.
3. **There is no `data_spedizione`.** Shipping is a single boolean `spedito`; "di cui spedito" is therefore a sum of quantities, exactly as the requirements describe.
4. **`tipologia` and `produzione` are fixed enumerations** enforced by `CHECK` constraints — not master-data tables. The UI shows 4 and 3 options respectively (§3.2) and offers no "manage values" screen.
5. **Growers are not a table.** `lotti_magazzino.produttore` is free `text`, nullable. The closed list of 8 growers lives in application configuration, and the interface is the only place it is enforced (§3.4, F-V5).
6. **`lotti_magazzino` allows `NULL` tipologia/produzione, `ordini_impegni` does not.** Legacy or imported lots may lack these dimensions; reports must show them under an explicit "(non indicata)" group rather than dropping the row (§3.5).
7. **`quantita` is `integer`** in both tables — no decimals, no unit-of-measure ambiguity beyond "pieces/plants". The UI never shows a decimal separator (§13 formatting).
8. **`produttore` is nullable**, so per-grower reporting needs an explicit "Non attribuito" column (§3.6).

### 3.2 Enumerations (fixed by the database)

| Enum | UI label | Values (verbatim, Italian) | Count |
|---|---|---|---|
| `lotti_magazzino.tipologia`, `ordini_impegni.tipologia` | Tipologia | `Barbatelle innestate` · `Barbatelle selvatiche` · `Vasetti` · `Barbatelloni` | 4 |
| `lotti_magazzino.produzione`, `ordini_impegni.produzione` | Produzione | `Nuova produzione` · `Ripiantato` · `Frigoconservato` | 3 |

Rules

- Values are rendered verbatim, capitalisation included. The UI must never translate, abbreviate or re-order them: the filter list order is the order above, which is stable and predictable.
- Adding a value is a **database migration**, not an admin task; the interface states this in the tooltip of a disabled "aggiungi valore" affordance (v1 shows no affordance at all).

### 3.3 Growers (application-level master list)

Closed list, seeded in configuration and used by every producer select and by the per-grower report:

`Mori Marco` · `Donati` · `Agriserv` · `Vivai riuniti` · `Bianchi` · `Golferenzo` · `Lorin` · `Esterno`

- Order is **canonical and permanent** — it is the column order of Report 2 and the chip order in S-06. Never alphabetical, never derived from the data.
- The interface never writes a grower value that is not in this list (F-V5), but the database will accept one: rows with an unknown `produttore` (legacy/imported) are surfaced in the report as an extra column **"Non riconosciuto"** and flagged with a data-quality badge in the admin view. Silently hiding them would make the totals wrong.
- `Esterno` is treated as a grower like the others (it is the non-member supplier bucket).

### 3.4 Field specification

**`lotti_magazzino` — lot entry form (S-13)**

| # | Field | Type | Null | Control | Rule |
|---|---|---|---|---|---|
| 1 | `anno_conferimento` | integer | yes | year select (current year ± 5, current default) | F-V6 |
| 2 | `produttore` | text | **yes in DB, required in the UI** | single-select from the 8 growers | F-V5 |
| 3 | `tipologia` | text enum | yes | single-select, 4 values | F-V8 |
| 4 | `produzione` | text enum | yes | single-select, 3 values | F-V8 |
| 5 | `codice_varieta` | text | **NOT NULL** | searchable single-select (distinct values) | F-V1 |
| 6 | `codice_clone` | text | **NOT NULL** | single-select, filtered by variety, disabled until variety chosen | F-V2 |
| 7 | `codice_portainnesto` | text | **NOT NULL** | single-select from `anagrafica_portainnesto` | F-V3 |
| 8 | `quantita` | integer | NOT NULL, default 0 | integer input (`inputmode=numeric`) | F-V4 |
| 9 | `note` | text | yes | textarea, 500 chars | — |

**`ordini_impegni` — order entry form (S-14)**

| # | Field | Type | Null | Control | Rule |
|---|---|---|---|---|---|
| 1 | `id_magazzino` | uuid | **yes** | lot picker: searchable by produttore/year/varietà, showing the lot's remaining quantity | F-V9 |
| 2 | `tipologia` | text enum | **NOT NULL** | single-select, 4 values; **prefilled from the chosen lot** | F-V8 |
| 3 | `produzione` | text enum | **NOT NULL** | single-select, 3 values; prefilled from the lot | F-V8 |
| 4 | `codice_varieta` | text | **NOT NULL** | searchable single-select; prefilled from the lot | F-V1 |
| 5 | `codice_clone` | text | **NOT NULL** | dependent select; prefilled from the lot | F-V2 |
| 6 | `codice_portainnesto` | text | **NOT NULL** | single-select; prefilled from the lot | F-V3 |
| 7 | `quantita` | integer | **NOT NULL** | integer input | F-V4, F-V10 |
| 8 | `spedito` | boolean | NOT NULL, default false | toggle | F-V7 |
| 9 | `note` | text | yes | textarea | — |

Selecting a lot prefills the five dimension fields **and keeps them editable**: the schema does not constrain the order's dimensions to the lot's, and an operator may legitimately record a commitment whose dimension differs. When they differ, a non-blocking warning explains the consequence ("Questo impegno non risulterà nella riga del lotto").

### 3.5 Quantity model

Grouping key for every report: `(tipologia, produzione, codice_varieta, codice_clone, codice_portainnesto)`.

| Term | UI label | Definition |
|---|---|---|
| Quantità a magazzino | `Magazzino` | `SUM(lotti_magazzino.quantita)` over the key |
| Quantità ordinata | `Ordinato` | `SUM(ordini_impegni.quantita)` over the key |
| Di cui spedita | `Di cui spedito` | `SUM(ordini_impegni.quantita) WHERE spedito = TRUE` |
| Disponibilità | `Disponibilità` | `Magazzino − Ordinato` (may be negative) |
| Deficit | `Deficit` | `Ordinato − Magazzino` for rows where Disponibilità < 0, displayed with a leading `−` |

Null-dimension handling

- A lot with `tipologia IS NULL` or `produzione IS NULL` is **not dropped**: it is grouped under the literal value **"(non indicata)"**, sorted last within its group, and marked with a subtle badge so the office can clean the data. The same applies to `produttore IS NULL` (§3.6).
- The report header states how many rows are in a "(non indicata)" group, so nobody assumes the total is complete.

### 3.6 Report definitions

**Report 1 — Riepilogo disponibilità** (all roles)

| Aspect | Specification |
|---|---|
| Source | `lotti_magazzino` ⟕ `ordini_impegni` on the grouping key |
| Filters | **`tipologia` is mandatory** and opens on `Barbatelle innestate`; **Produzione is not a filter** — the table always shows the quantities of **Nuova produzione** (PD-18); `codice_varieta` (searchable) and **`codice_portainnesto` (searchable)** are optional |
| Layout | **Flat list**: one row per combination. The rootstock is a filter and a column, **not** a grouping level — no group headers, and the **subtotal row opens each rootstock group** instead of closing it (PD-7) |
| Columns | Codice clone (+ variety) · Codice portainnesto · Magazzino · Ordinato · Di cui spedito · Disponibilità — **no «Da spedire» column** (PD-3); **Ripiantato** and **Frigoconservato** appear at the end only when the *Aggiungi altro* button in the header is pressed (PD-16, PD-18); with them open, combinations whose alternative stock has no «Nuova produzione» reference are added as extra rows (PD-19) |
| Sort | `codice_portainnesto` ASC, then `codice_clone` ASC |
| Totals | a **subtotal row per rootstock**, labelled **"Totale per portainnesto"** with its rootstock code and the aggregated values, highlighted and bold, placed **first in its group** — the per-clone lines it summarises follow it (PD-3, PD-7); then one **"Totale generale"** row |
| Alert | Disponibilità < 0 → whole row bold red + `!` icon + red left border |
| Export | CSV of the filtered rows, per-rootstock subtotals included in the same order as the table (subtotal first), plus the grand total |

**Report 2 — Riepilogo disponibilità per produttore** (Admin, Amministrazione)

| Aspect | Specification |
|---|---|
| Split basis | Warehouse quantities split by `lotti_magazzino.produttore` (canonical 8 + **"Non attribuito"** + **"Non riconosciuto"**) |
| Ordered quantities | An order is attributed to a grower **through `id_magazzino → lotti.produttore`**. Orders with `id_magazzino IS NULL` cannot be attributed and land in the **"Non attribuito"** column, never silently spread across growers |
| Filters | As Report 1 — **Tipologia and Produzione mandatory**, Codice varietà and Codice portainnesto optional — **plus Produttore**. Choosing a grower keeps only the combinations that involve them and highlights that column; their column total does not change, since filtered-out rows contributed zero |
| Layout | **Flat list**, one row per combination, with the **same per-rootstock subtotals as Report 1** (PD-7): no group headers, a subtotal row as the first row of each rootstock group |
| Columns | Codice clone · Codice portainnesto · Magazzino · Ordinato · Di cui spedito · Disponibilità · 8 grower columns — **no «Non attribuito», no «Totale produttori»** (PD-4: every commitment is placed against a lot, so every record has a producer) |
| Columns total | 6 + 8 = **14** |
| Sort | by rootstock, then clone (as Report 1) |
| Totals | a **"Totale per portainnesto"** row opening each rootstock group, summing **every** column — the eight grower columns included — then one **"Totale generale"** row |
| Self-check | "Totale produttori" must equal the grower columns sum; a mismatch (possible only from unattributed orders) is shown as a reconciliation note with the amount |

**Report 4 — Da spedire** (Admin, Amministrazione)

| Aspect | Specification |
|---|---|
| Purpose | The commitments still to be shipped, reached from the «Da spedire» KPI on the home screen (Admin, Amministrazione) — the **producer** panorama neither shows the KPI nor a shortcut to this report (PD-7) |
| Row set | `ordini_impegni` with `spedito = FALSE`, after the filters |
| Filters | **Tipologia and Produzione mandatory** (as Report 1); Codice varietà and Codice portainnesto optional |
| Columns | Codice clone (+ variety) · Codice portainnesto · Lotto collegato (produttore · anno) · Quantità |
| Sort | by rootstock, then clone |
| Totals | one row with the count of commitments and the summed quantity |
| Devices | **Also on a phone** — not PC-gated like the entry screens |

**Report 3 — Mancanze** (Admin, Amministrazione, Produttore) — *named «Indisponibilità» until PD-11*

| Aspect | Specification |
|---|---|
| Row set | Only keys where `Magazzino − Ordinato < 0` |
| Columns | Tipologia · Produzione · Codice varietà · Codice clone · Codice portainnesto · Magazzino · Ordinato · **Deficit** |
| Sort | `codice_portainnesto` → `codice_clone` → `codice_varieta`, so the groups are contiguous (PD-7) |
| Emphasis | Deficit bold red with leading `−`, red left border, red row tint; count badge in the header |
| Totals | **"Totale per portainnesto"** row opening each rootstock group (magazzino, ordinato and the summed deficit, shown negative), exactly like Report 1 (PD-7). There is no grand total row: the banner above the table carries the overall deficit |
| Empty | Green "nessuna indisponibilità" state |

**Report 5 — Messo a disposizione** (Produttore)

| Aspect | Specification |
|---|---|
| Purpose | Answers "what did **I** put into the warehouse, and what is still committed against it?" — the producer's own side of the availability picture |
| Row set | The lots whose `produttore` is the grower linked to the signed-in profile, with the commitments recorded on those lots (`ordini_impegni.id_magazzino → lotti_magazzino`). Served by the `vista_messo_a_disposizione` view, which filters by `auth_grower()` **inside** the definition (migration 005) |
| Filters | **Tipologia and Produzione mandatory** (same defaults as Report 1), Codice varietà and Codice portainnesto optional. There is **no produttore filter**: the producer is the session |
| Layout | Identical to Report 1 — flat list, the **subtotal row opens each rootstock group** (PD-7) |
| Columns | Codice clone (+ variety) · Codice portainnesto · Magazzino · Ordinato · Di cui spedito · Disponibilità |
| Sort / Totals | as Report 1 (rootstock → clone; per-rootstock subtotals first, then the "Totale generale" row) |
| Emphasis | Disponibilità < 0 → red, exactly as in Report 1 |
| Export | CSV of the filtered rows plus the subtotals, same columns as Report 1 |
| Empty | No records → empty state naming the producer; **no producer linked to the profile** → an explanatory state pointing at Utenti |

### 3.7 Validation rules

| ID | Rule | Enforcement |
|---|---|---|
| **F-V1** | `codice_varieta` must equal one of the distinct `codice_varieta` in `anagrafica_vite` | Select from data + server check |
| **F-V2** | The chosen `(codice_varieta, codice_clone)` pair must exist in `anagrafica_vite`; the clone select is disabled until a variety is chosen and cleared when the variety changes | UI + server |
| **F-V3** | `codice_portainnesto` must exist in `anagrafica_portainnesto` | UI + server |
| **F-V4** | `quantita` is an integer ≥ 0; non-integers, `1.250,5` and negatives are rejected with the value quoted back | Input mask + server + import validation |
| **F-V5** | `produttore`, when set, must be one of the 8 grower names (exact string, case-sensitive) | UI select is the only input; import validates against the list and reports near-misses ("Mori" → "Mori Marco?") |
| **F-V6** | `anno_conferimento` is a 4-digit year in `[2000, current_year + 1]` | Picker constrained; server check |
| **F-V7** | `spedito` is a boolean; it may be toggled freely, with an 8-second undo. There is no shipment date to validate | UI optimistic update + toast |
| **F-V8** | `tipologia` / `produzione` must be one of the enumeration values. Required in the UI for both entities even though `lotti_magazzino` permits NULL (legacy rows stay NULL and render as "(non indicata)") | Select + server `CHECK` |
| **F-V9** | A lot referenced by any `ordini_impegni.id_magazzino` cannot be deleted; the UI explains the count and offers to clear the reference first | Server FK/guard + M-01 |
| **F-V10** | Nothing prevents `SUM(ordini.quantita) > lot.quantita` — overselling is the very condition Report 3 exists to show. Entry therefore **warns** ("La disponibilità andrà sotto zero: −450") and requires an explicit acknowledgement, but never blocks | UI warning only |

Data-quality notes surfaced in the UI

- `produttore` free text: the admin screen shows a "valori non riconosciuti" section listing distinct values outside the 8-name list, so the office can fix them (§15 Q9 recommends a real FK).
- `lotti_magazzino.tipologia/produzione` nullable: rows without them appear as "(non indicata)" and are counted in a badge on the report filter bar.

### 3.8 Database objects missing or to be added

| # | Object | Status | Why it matters to the GUI |
|---|---|---|---|
| D1 | `VIEW riepilogo_disponibilita` | **referenced by the requirements, absent from the dump** | The availability report is specified against it; the client should not compute the aggregate, so the definition lives in one place |
| D2 | `VIEW riepilogo_per_produttore` | to create | 16-column pivot incl. unattributed orders |
| D3 | `VIEW indisponibilita` | to create | `WHERE magazzino − ordinato < 0` |
| D4 | `UNIQUE (codice_varieta, codice_clone)` on `anagrafica_vite` | **missing** — only `id` is unique | Without it, duplicate pairs make the clone select ambiguous and the "pair must exist" rule untestable |
| D5 | `FOREIGN KEY (id_magazzino) → lotti_magazzino(id)` | missing | Grower attribution of orders (Report 2) silently breaks if a lot is deleted |
| D6 | Index `(codice_portainnesto, codice_clone)`, `(codice_varieta)`, `(produttore)`, partial `(spedito) WHERE spedito` | to add | p75 report latency ≤ 1.5 s on mobile |
| D7 | Grower table or `CHECK (produttore IN (...))` | missing | The closed list currently exists only in the UI (§15 Q9) |

Suggested definitions (to be reviewed by the backend owner; the client only consumes them):

```sql
CREATE OR REPLACE VIEW public.riepilogo_disponibilita AS
SELECT tipologia, produzione, codice_varieta, codice_clone, codice_portainnesto,
       SUM(magazzino)                          AS magazzino,
       SUM(ordinato)                           AS ordinato,
       SUM(spedito)                            AS spedito,
       SUM(magazzino) - SUM(ordinato)          AS disponibilita
FROM (
  SELECT tipologia, produzione, codice_varieta, codice_clone,
         codice_portainnesto, quantita AS magazzino, 0 AS ordinato, 0 AS spedito
  FROM public.lotti_magazzino
  UNION ALL
  SELECT tipologia, produzione, codice_varieta, codice_clone,
         codice_portainnesto, 0, quantita,
         CASE WHEN spedito THEN quantita ELSE 0 END
  FROM public.ordini_impegni
) t
GROUP BY 1,2,3,4,5;
```

The per-grower view joins `ordini_impegni.id_magazzino → lotti_magazzino.id` to derive the grower for ordered quantities and keeps a separate `non_attribuito` bucket for `id_magazzino IS NULL` (see §3.6).

---

## 4. Platform and responsive strategy

### 4.1 Devices and support

| Device | Width | Primary use | Support |
|---|---|---|---|
| Smartphone (Android Chrome) | 320–479 dp | Read the three reports, filter, drill into a row | **Primary — must be excellent** |
| Smartphone (iOS Safari) | 390–430 dp | Same | Functional, no PWA install prompt |
| Tablet | 768–1023 dp | Read reports, two-pane | Full |
| Laptop / PC (Chrome) | 1024–1920 dp | Reports **and all data entry** | Full |

Installable PWA: manifest with `display: standalone`, `orientation: any`, theme colour matching the brand header, maskable icon. The app must survive a refresh at any depth (client routing + server fallback).

### 4.2 Reports: one dataset, three layouts

This is the central responsive decision of the product. **The same query result set is rendered by three different presentations.**

| Breakpoint | Presentation | Rationale |
|---|---|---|
| `xs` 320–639 | **Grouped cards.** One card per rootstock: header = rootstock code + subtotal disponibilità; body = one row per clone with a 4-cell metric strip (Magazzino / Ordinato / Spedito / Disponibilità). Negative availability → card segment bold red with `!`. Tap a clone row → **S-11** detail sheet | A 5-column numeric table at 390 dp is unreadable; the metric strip keeps every value visible without horizontal scroll |
| `sm` 640–1023 | Same grouping, two metric columns, clone rows as a key/value list; filter bar wraps to two lines | Tablet portrait |
| `md`+ 1024+ | **True data grid** (C-13): sticky header, right-aligned numbers, tinted subtotal rows, red negative rows, frozen first column, column visibility menu | The requirement's "output tables" |

Rules that apply at every breakpoint

- R-1 The filter bar is **always visible above the table**, never behind a menu (requirement: "Filters at the top").
- R-2 Active filters are shown as removable chips; a `Rimuovi filtri` reset is always present when any filter is active. **Mandatory filters (Tipologia, Produzione) are never chips** — they cannot be removed.
- R-2b On a phone every report offers **Schede / Tabella**: cards by default, or the same table as the web inside a horizontally scrolling panel. The choice is remembered across screens.
- R-3 No report groups by rootstock any more (PD-1, PD-2): both tables are flat lists with a single "Totale generale" row, and the rootstock is a filter.
- R-4 The red-negative treatment is identical in all layouts: bold + red text + icon + left border.
- R-5 Horizontal scrolling is forbidden on the page; only inside a data table (`md`+ per-grower report).
- R-6 Pinch-to-zoom is disabled in the app shell (`user-scalable=no`) because the layouts are already at readable scale — the grid at `md`+ has its own zoom control.

### 4.3 Data entry is PC-only

Entry screens (S-13 … S-19) require **≥ 1024 dp** and a pointer.
Below that:

- The tab bar shows a `Dati` item that renders **S-13L**, a locked explainer card: "*Inserimento dati disponibile solo da PC. Apri l'app su un computer per registrare lotti e ordini.*" with a *Copia link* button.
- Direct navigation to an entry route on a narrow viewport renders the same locked card — no partially functional form. Read-only users can still **view** the delivery list at `md`+ only.
- This is a product rule, not a CSS accident: no inline editing below 1024 dp.

### 4.4 Connectivity

| State | Behaviour |
|---|---|
| Online | Normal |
| Slow (> 1.5 s) | Skeleton after 300 ms, "Caricamento…" with elapsed time after 4 s, cancel available |
| Offline | Grey banner "Offline — i dati potrebbero non essere aggiornati"; reports serve the **last successful result** with a `Aggiornato 14:32` badge; entry screens disabled |
| Session expired | M-05 sheet with *Accedi di nuovo*, preserving the intended route |
| Server error | Inline error card with *Riprova* and a correlation id for support |

---

## 5. Design principles

1. **The number is the interface.** These screens exist to show quantities. Chrome is quiet, numbers are large, aligned and tabular.
2. **Red means oversold.** Red is reserved exclusively for negative availability and destructive actions. It is never decorative, never used for "warning" or branding.
3. **Filters beat folding.** The rootstock is a filter in both reports, not a grouping level: isolating one rootstock is a single choice, not a scroll to the right section. The only aggregate a table carries is its grand total, and it is unmistakable — bold on a tinted row in every layout.
4. **Filter first, then read.** Filters sit at the top, are single-select, and never hide the current result while they load (stale-while-revalidate with a subtle dim).
5. **Never let a phone pretend to be a workstation.** Editing on a phone is refused explicitly, not approximated.
6. **Master data is the only vocabulary.** Every place a variety, clone or rootstock appears it comes from a select — free text is a defect.
7. **Errors are located.** Validation messages name the row, the column and the offending value ("Riga 47 · Codice varietà · `CH-99` non presente in anagrafica").

---

## 6. Design system

### 6.1 Colour tokens

| Token | Hex | Use |
|---|---|---|
| `ink-900` | `#0F172A` | Headings, app-bar text, table header text |
| `ink-700` | `#334155` | Body text, table cells |
| `ink-500` | `#64748B` | Secondary labels, units, placeholders |
| `ink-300` | `#CBD5E1` | Disabled, dividers on dark |
| `line` | `#E2E8F0` | Table grid lines, card borders, input borders |
| `surface` | `#FFFFFF` | Cards, table body, sheets |
| `canvas` | `#F6F8FA` | Page background, table zebra |
| `brand-700` | `#175E43` | App bar, primary button pressed |
| `brand-600` | `#1E6B4F` | Primary buttons, active tab, links, focus ring |
| `brand-500` | `#2A8A63` | Charts, hover accents, selected chip |
| `brand-50` | `#E9F5EF` | Selected rows, active chips, **subtotal rows** |
| `success-600` | `#16A34A` | Healthy, confirmed save |
| `warn-600` | `#D97706` | Stale data, incomplete import, pending |
| `danger-700` | `#B91C1C` | **Negative availability text**, deficit values |
| `danger-600` | `#DC2626` | Destructive buttons, error text, negative border |
| `danger-50` | `#FEF2F2` | Negative row background tint |
| `info-600` | `#0891B2` | Informational banner, "spedito" flag |

Subtotal row = `brand-50` background + `ink-900` bold text + `1.5 px` top border `#CBD5E1`.
Negative row = `danger-50` background + `danger-700` bold text + `3 px` left border `danger-600` + `!` icon.
Table header = `ink-900` text on `canvas`, 12 dp uppercase `label`, sticky.
Zebra = even rows `#FBFCFD` (only at `md`+, and only when no row is tinted, to avoid colour collision).

Contrast: all text ≥ 4.5:1; `danger-700` on `danger-50` = 6.3:1 ✓; `brand-600` on white = 5.2:1 ✓. Colour is always doubled by weight, icon or label.

### 6.2 Typography

Stack: `-apple-system, "Segoe UI", Roboto, Inter, sans-serif`. Numeric tables: `font-variant-numeric: tabular-nums; font-feature-settings: "tnum"`.

| Style | Size / line / weight | Use |
|---|---|---|
| `display` | 26 / 32 / 700 | Mobile report title |
| `h1` | 20 / 26 / 600 | Desktop page title, sheet title |
| `h2` | 16 / 22 / 600 | Card title, section header, rootstock group header |
| `body` | 15 / 22 / 400 | Default |
| `body-strong` | 15 / 22 / 600 | Clone code, list primary line |
| `label` | 13 / 18 / 500 | Field labels, chips, tab labels |
| `caption` | 12 / 16 / 400 | Metadata, "Aggiornato 14:32", units |
| `num` | 15 / 22 / 500 tabular | Metric strip values |
| `num-strong` | 15 / 22 / 700 tabular | Subtotal and negative values |
| `table` | 13 / 20 / 400 tabular | Data grid (`md`+) |
| `table-strong` | 13 / 20 / 700 tabular | Subtotal and negative cells |

### 6.3 Spacing, radius, elevation, motion

- Spacing scale `4, 8, 12, 16, 20, 24, 32, 40, 56`; screen padding 16 dp (`xs`) / 24 dp (`md`+); card padding 12 dp.
- Radius: controls 8, cards 12, sheets 20 top, pills 999.
- Elevation: `elev-1` cards `0 1px 2px rgba(15,23,42,.06)`; `elev-2` sticky header/filter bar `0 2px 8px rgba(15,23,42,.08)`; `elev-3` sheets `0 -8px 24px rgba(15,23,42,.16)`.
- Motion: 120 ms (press), 180 ms (expand/tab), 240 ms (sheet). `cubic-bezier(.2,.8,.2,1)`. All disabled under `prefers-reduced-motion: reduce`.
- Touch targets ≥ 44×44 dp; table row height ≥ 44 dp on touch, 36 dp with a pointer.

### 6.4 Iconography

24 dp outline, 1.75 dp stroke: `filter`, `search`, `chevron-down/right`, `alert-triangle` (negative), `truck` (spedito), `download`, `share`, `plus`, `edit`, `trash`, `upload` (Excel), `table`, `layers` (rootstock group), `user`, `lock`, `check`, `info`, `grip` (drag), `columns` (column chooser).

### 6.5 Component catalogue

| ID | Component | Variants / states |
|---|---|---|
| C-01 | App bar (`xs`) | title, back, role chip, overflow; `brand-700` fill |
| C-02 | Bottom tab bar | 4 items by role; role-filtered; `Dati` shown only at `md`+ |
| C-03 | Desktop shell | left sidebar (nav + role), top bar (title, filters, user) |
| C-04 | Filter bar | 3 single-selects (Tipologia, Produzione, Codice varietà searchable) + reset; wraps at `sm`; sticky |
| C-05 | Filter chip | removable, active filters summary |
| C-06 | Select (single) | default, open, selected, disabled (clone before variety), error |
| C-07 | Searchable select | input + listbox, type-ahead over code and description, "Nessun risultato", keyboard/mobile full-screen variant (M-03) |
| C-08 | Report card group (`xs`) | rootstock header with subtotal, clone rows, metric strip |
| C-09 | Metric strip | 4 cells, label above value, negative cell red bold |
| C-10 | Data grid (`md`+) | sticky header, zebra, subtotal row, negative row, sorted column, column chooser, frozen first col |
| C-11 | Subtotal row | used by Report 2 only: "Totale portainnesto" + code, bold, tinted, top border |
| C-12 | Negative row treatment | tint + bold red + `!` + left border |
| C-13 | Button | primary, secondary, ghost, danger, icon, loading, disabled |
| C-14 | Text/number field | default, focus, filled, error + message, suffix unit, disabled-with-reason |
| C-15 | Date field | picker, error, clearable |
| C-16 | Toggle (Spedito) | off/on, disabled, with date dependency |
| C-17 | Status chip | healthy, stale, pending, deficit, read-only |
| C-18 | Empty state | icon, title, explanation, one primary action |
| C-19 | Inline banner | info, warn, error, success; dismissible |
| C-20 | Toast | success, error, undo, progress |
| C-21 | Bottom sheet (`xs`) | peek/half/full, drag handle, scrim, focus trap |
| C-22 | Modal (`md`+) | centred, max 640 dp, scrim |
| C-23 | Stepper (import) | 4 steps, current/done/error |
| C-24 | Skeleton | card, table-row, metric |
| C-25 | KPI card | value, label, delta, tone (neutral/success/danger), tap-through |
| C-26 | Side drawer form (desktop) | 480 dp, sticky footer Salva/Annulla |

---

## 7. Information architecture and navigation

### 7.1 Sitemap (role-generated)

```
Accesso                      (all)
└── S-01 Accedi
    └── S-02 Home (mobile) / S-03 Home (desktop)
        ├── Riepiloghi
        │   ├── S-04/S-05  Riepilogo disponibilità        admin · ufficio · produttore · vendite
        │   ├── S-06/S-07  Riepilogo per produttore       admin · ufficio
        │   └── S-08/S-09  Indisponibilità                admin · ufficio · produttore
        │        ├── S-10 Filtri (sheet / modal)
        │        ├── S-11 Dettaglio riga (sheet / drawer)
        │        └── S-12 Esporta e condividi (sheet / modal)
        ├── Dati  (PC only, ≥1024 dp)                     admin · ufficio
        │   ├── S-13 Lotti magazzino
        │   ├── S-14 Ordini e impegni
        │   └── S-15 Import Excel
        ├── Anagrafiche                                    admin (E) · ufficio (R)
        │   ├── S-16 Anagrafica vite (varietà + cloni)
        │   └── S-17 Anagrafica portainnesto
        ├── Configurazione                                 admin only
        │   ├── S-18 Form builder
        │   └── S-19 Utenti e ruoli
        └── S-20 Profilo e impostazioni                    all
```

### 7.2 Mobile navigation model (`xs`/`sm`)

- **App bar (C-01)**: screen title, back chevron when not at a root, role chip on the right (`Vendite`, `Produttore`, …), overflow menu (Esci, Profilo).
- **Bottom tab bar (C-02)**, max 4 items, role-filtered:

| Tab | Icon | Route | admin | ufficio | produttore | vendite |
|---|---|---|---|---|---|---|
| Home | house | S-02 | ✓ | ✓ | ✓ | ✓ |
| Riepiloghi | table | S-04 | ✓ | ✓ | ✓ | ✓ |
| Indisponibili | alert | S-08 | ✓ | ✓ | ✓ | — |
| Dati / Profilo | sliders | S-13L / S-20 | ✓ Dati | ✓ Dati | ✓ Profilo | ✓ Profilo |

  Where a role has fewer than three primary destinations, the last tab becomes **Profilo** and the entry screens are reached from Home tiles (Admin/Amministrazione only, at `md`+).
- **Sheets (C-21)** carry every modal task: filters (S-10), row detail (S-11), export (S-12), confirmations (M-01/M-02). Never a new full page for a task that can be dismissed.
- **No hamburger menu.** Navigation is either a tab or a card on Home.

### 7.3 Desktop navigation model (`md`+)

- **Sidebar (C-03)** 240 dp: product mark, then sections *Riepiloghi · Dati · Anagrafiche · Configurazione*, filtered by role, with the active item tinted `brand-50`. Collapsible to 72 dp icon rail at 1024–1279 dp.
- **Top bar** 64 dp: page title, breadcrumb (e.g. `Riepiloghi / Disponibilità`), filter bar (report screens), user menu with role badge.
- **Detail drawer (C-26)** 480 dp from the right for row detail and entry forms; the underlying table stays visible and keeps its scroll position.
- Keyboard: `Tab` order follows reading order; `/` focuses the filter search; `Esc` closes drawer/modal; `Ctrl/⌘+Enter` saves in an entry form.

### 7.4 Deep links

Every view is addressable so a link can be pasted into a chat:

```
/                                → role-aware landing (S-02/S-03)
/r/disponibilita                 → S-04 / S-05
/r/disponibilita?tipologia=…&produzione=…&varieta=CH-01
/r/produttore                    → S-06 / S-07
/r/indisponibilita               → S-08 / S-09
/r/indisponibilita?varieta=CH-01
/dati/lotti                      → S-13
/dati/ordini                     → S-14
/dati/import                     → S-15
/anagrafiche/vite                → S-16
/anagrafiche/portainnesti        → S-17
/config/form                      → S-18
/config/utenti                   → S-19
/profilo                         → S-20
```

Filter state lives in the query string, so a filtered report can be shared and survives a refresh/install. Opening a `Dati` link on a narrow viewport renders S-13L (locked) and preserves the intended destination after sign-in on a PC.

---

## 8. Screen specifications

Every screen below states: purpose · roles · entry · layout zones · components · data · states · acceptance criteria (AC). Layout zones refer to C-xx components from §6.5 and to frames in the mockup (`docs/mockups/fede-magazzino-mockup.drawio`, page/frame labels match screen IDs).

---

### S-01 · Accedi (sign in)

| | |
|---|---|
| **Purpose** | Authenticate and route to the role-aware landing screen |
| **Roles** | All (unauthenticated) |
| **Entry** | App launch without a valid session; expired session (M-05); logout |
| **Breakpoints** | `xs`–`xl` (single centred column, max 420 dp) |

**Layout (`xs`)**

1. Brand header — product mark + "Fede Magazzino", on `brand-700`, 180 dp tall, with a subtle vineyard-line illustration.
2. Card: *Email* field (C-14, `type=email`, `autocomplete=username`), *Password* field (C-14 secure, show/hide toggle), *Ricordami su questo dispositivo* switch.
3. Primary button **Accedi** (full width, 48 dp).
4. Text link *Password dimenticata?*.
5. Footer: version + environment badge ("produzione").

**Data** — `POST /auth/login` → token + `{user_id, nome, ruolo}`. Client stores the session in an `HttpOnly` cookie (preferred) or memory + refresh token; never in `localStorage`.

**States**

| State | UI |
|---|---|
| Default | Fields empty, Accedi disabled until both non-empty |
| Loading | Button shows spinner + "Accesso…", fields disabled, no navigation yet |
| Invalid credentials | Inline banner (C-19, error) above the button: "Email o password non corretti." Password field cleared, email kept, focus moves to password |
| Locked out (5 attempts) | Banner: "Troppi tentativi. Riprova tra 15 minuti." Button disabled with countdown |
| Offline | Banner "Nessuna connessione" + disabled button |
| Success | Full-screen progress, then S-02/S-03 per role; intended deep-link route preserved |

**AC**

- AC-1 Keyboard: submitting with the Android/desktop keyboard "Go" submits the form.
- AC-2 iOS Safari does not zoom on field focus (field font-size ≥ 16 px).
- AC-3 Wrong credentials never state whether the email exists.
- AC-4 A `produttore`/`vendite` user lands on S-02 with only their permitted tiles.

---

### S-02 · Home — mobile (`xs`/`sm`)

| | |
|---|---|
| **Purpose** | The role-scoped launchpad: current availability health and one tap to every permitted destination |
| **Roles** | All — content differs by role per §2.2 |
| **Entry** | Post-login landing; Home tab |

**Layout zones**

| Zone | Content |
|---|---|
| App bar | "Fede Magazzino" + role chip (`Amministratore`/`Amministrazione`/`Produttore`/`Vendite`); overflow = Esci |
| KPI row (2×2) | **Disponibilità totale** (sum of Magazzino − Ordinato, formatted), **Articoli in indisponibilità** (`n`, red card if n > 0, tap → S-08), **Lotti registrati (mese)**, **Ordini non spediti**. Cards are C-25, each a deep link |
| Section "Riepiloghi" | Tiles (C-05 list): *Riepilogo disponibilità* → S-04; *Riepilogo per produttore* → S-06 (admin/ufficio only); *Indisponibilità* → S-08 (not for vendite) |
| Section "Accessi rapidi" | Last-used filter combination as a chip row ("Barbatelle innestate · Vaso · CH-01") with *Riapri* → S-04 with those filters; last 3 visited varieties as chips |
| Section "Inserimento dati" (admin/ufficio, phone) | Single locked tile → S-13L ("Disponibile solo da PC") |
| Bottom tab bar | Home · Riepiloghi · Indisponibili · Dati/Profilo |

**States** — Loading: KPI skeletons (C-24), tiles rendered immediately (no layout shift). Error: KPI block replaced by inline error banner + *Riprova*; tiles remain usable. Fresh install (no history): "Accessi rapidi" section hidden (not an empty box). Offline: KPI values dimmed with `Aggiornato 14:32` caption.

**AC**

- AC-1 The tile set exactly equals §2.2 for the logged-in role; a `vendite` user never sees an Indisponibilità tile or tab.
- AC-2 KPI "Articoli in indisponibilità" > 0 renders the card with `danger-50` background, `danger-700` value and a `!` icon — not colour alone.
- AC-3 Tapping a KPI or tile navigates in ≤ 1 action.
- AC-4 All primary content is reachable one-handed: the tab bar and lower tiles sit in the bottom 40 % of the viewport.

---

### S-03 · Home — desktop (`md`+)

| | |
|---|---|
| **Purpose** | Same information as S-02, arranged for a workstation, with entry shortcuts |
| **Roles** | All (role-filtered) |
| **Entry** | Post-login landing at ≥ 1024 dp |

**Layout** — sidebar (C-03) · top bar with title "Panoramica" and user menu · content max-width 1280 dp:

| Zone | Content |
|---|---|
| Row 1 | 4 KPI cards horizontally (same four as S-02), each with a sparkline-free delta caption ("vs. mese precedente") |
| Row 2 (2 columns) | Left: **Ultimi lotti registrati** (5 rows: data, produttore, varietà, clone, quantità) with *Apri lotti* → S-13. Right: **Indisponibilità principali** (top 5 deficit rows: varietà, clone, portainnesto, deficit) with *Vedi tutte* → S-09 |
| Row 3 | Report shortcuts as large cards (3 or 2 per role) |
| Row 4 (admin/ufficio) | Quick actions: *Nuovo lotto* · *Nuovo ordine* · *Importa Excel* — each opens the target screen with the drawer/modal already open |

**States** — identical semantics to S-02 plus: hover states on rows (`canvas` tint), keyboard focus rings (`brand-600`, 2 dp offset), and `Ctrl/⌘+K` opening a command palette listing screens and varieties.

**AC**

- AC-1 No horizontal scrollbar at 1024 dp.
- AC-2 "Ultimi lotti" shows the 5 newest by `data` desc, then id desc.
- AC-3 Quick actions are hidden entirely (not disabled) for roles without entry rights.

---

### S-04 · Riepilogo disponibilità — mobile

| | |
|---|---|
| **Purpose** | Read availability by rootstock group and clone, on a phone, filtered |
| **Roles** | Admin, Amministrazione, Produttore, Vendite |
| **Entry** | Home tile; tab bar → Riepiloghi; deep link `/r/disponibilita` |
| **Data** | `GET /reports/disponibilita?tipologia=&produzione=&varieta=` → rows grouped by `codice_portainnesto` |

**Layout zones (top → bottom)**

| Zone | Spec |
|---|---|
| Sticky filter bar (C-04) | Four compact selectors showing current values (`Tipologia ▾`, `Produzione ▾`, `Codice varietà 🔍 ▾`, `Codice portainnesto 🔍 ▾`), 44 dp tall, `elev-2`, sticky under the app bar. Trailing `Filtri` icon button opens S-10 (full-screen on `xs`) |
| Active filter chips (C-05) | Shown only when filters are active: `Tipologia: Barbatelle innestate ✕` etc. + `Azzera` |
| Summary strip | "3 portainnesti · 24 cloni · aggiornato 14:32" + a red pill `2 in negativo` when applicable |
| Row cards | One card per combination: `Codice clone` (with the variety beneath) and `Codice portainnesto` on the identity line, then the metric strip |
| Clone row (C-09) | Line 1: `Codice clone` (body-strong) + `!` icon if negative. Line 2: metric strip of 4 cells — Magazzino / Ordinato / Di spedito / **Disponibilità**. Negative disponibilità cell: `danger-50` background, `danger-700` bold. Whole row: `danger-50` tint + 3 dp `danger-600` left border + bold text |
| Final row | "Totale generale" card, bold on `brand-50` with a 2 dp top border |
| Bottom tab bar | Persistent |

**Interactions**

- Tap a clone row → **S-11** detail sheet (bottom sheet, half height, draggable to full).
- Tap a group header → collapse/expand that group (state kept for the session; all groups start expanded).
- Swipe a chip → remove that filter; result reloads with stale-while-revalidate (previous list dimmed 40 % until fresh data arrives).
- Pull-to-refresh refetches with current filters; shows a timestamp on completion.
- Long-press a metric cell → copy value with a "Copiato" toast (C-20).

**States**

| State | UI |
|---|---|
| Loading (first) | 3 skeleton group cards (C-24) with metric strips; filter bar interactive |
| Refreshing | Existing content at 40 % opacity + 2 dp progress bar under the filter bar |
| Empty (no rows) | C-18: icon, "Nessun dato con i filtri selezionati", explanation, primary *Rimuovi filtri* |
| Empty (no variety selected, huge dataset) | Card limit: first 20 groups + *Mostra altri* button — prevents a 4 000-row DOM on a phone |
| Error | Inline banner "Impossibile caricare il riepilogo" + correlation id + *Riprova* |
| Offline | Cached result + `info` banner "Dati non aggiornati" with timestamp |

**AC**

- AC-1 The list is flat: no rootstock group headers and no per-rootstock subtotals; the only aggregate is the final "Totale generale" row.
- AC-1b The rootstock appears as its own column on every row and as a **filter** in the filter bar.
- AC-2 Every row with Disponibilità < 0 is bold and red across the whole row, with an icon; contrast ≥ 4.5:1.
- AC-3 Sort order is rootstock code, then clone code — identical to the desktop grid.
- AC-4 Filters are single-select; Codice varietà offers a search field; changing any filter updates the URL query string.
- AC-5 No horizontal page scrolling at 320 dp; metric values never truncate (they wrap to a second line if needed).
- AC-6 The figure shown as "Disponibilità" equals Magazzino − Ordinato for every row (spot-checkable in the UI).

---

### S-05 · Riepilogo disponibilità — desktop (`md`+)

| | |
|---|---|
| **Purpose** | The authoritative wide table for the office |
| **Roles** | Same as S-04 |
| **Entry** | Sidebar → Riepiloghi → Disponibilità; deep link |

**Layout** — sidebar · top bar with breadcrumb `Riepiloghi / Disponibilità` · **filter bar row** (three selects, inline, with labels above; searchable varietà; `Azzera filtri`) · toolbar right side (*Esporta* → S-12, *Colonne* chooser, refresh with "Aggiornato 14:32") · data grid (C-10) filling the remaining height.

**Grid specification**

| Column | Align | Width | Notes |
|---|---|---|---|
| Codice clone | left | 140 | frozen; with `!` icon when negative |
| Codice portainnesto | left | 140 | shown on the group's first row; the subtotal row carries it |
| Magazzino | right | 120 | tabular |
| Ordinato | right | 120 | |
| Di cui spedito | right | 130 | `info-600` text |
| Disponibilità | right | 140 | bold; red when negative |

- Sticky header (36 dp) + sticky first column; row height 36 dp; zebra `#FBFCFD` on even rows where no tint applies.
- Flat rows: the rootstock is a normal column (not a group header), so the table has no subtotal rows; the sticky footer carries the grand total.
- Negative rows: `danger-50` background, `danger-700` bold, 3 dp left border.
- Sorting: default rootstock → clone (per requirement); clicking a numeric header sorts client-side within the current result and shows a sort indicator with an `aria-sort` attribute; a *Ripristina ordine* action returns to the required order.
- Column chooser remembers the choice per user (localStorage, non-secret).

**States** — as S-04 plus: grid-level loading with 8 skeleton rows; virtualised rendering above 200 rows; footer summary line "24 cloni · 3 portainnesti · Totale disponibilità 12 340".

**AC**

- AC-1 Requirement R9 satisfied: grouping by clone+rootstock, sort by rootstock, subtotal styled bold with distinct background.
- AC-2 Horizontal scrolling, if any, happens **inside the grid only**, with the header and the first column pinned.
- AC-3 Export uses the same filters and includes subtotal rows.
- AC-4 At 1280×800 all six columns are visible without horizontal scroll.

---

### S-06 · Riepilogo per produttore — mobile

| | |
|---|---|
| **Purpose** | See how availability splits across the 8 growers, on a phone |
| **Roles** | **Admin, Amministrazione only** |
| **Entry** | Home tile (visible only to those roles); deep link `/r/produttore` |
| **Data** | `GET /reports/produttore` → rows with `magazzino, ordinato, spedito, disponibilita, per_produttore{8}` |

**Layout zones** — identical shell to S-04 (filter bar, chips, summary strip) with these differences:

| Zone | Spec |
|---|---|
| Row card | Identity line: rootstock code + clone code |
| Clone row | Line 1: clone code + total Disponibilità (bold). Line 2: mini strip Magazzino / Ordinato / Spedito. Line 3: **"Per produttore"** — a horizontally scrollable strip of grower chips (`Mori Marco` `120`, `Donati` `0`, `Agriserv` `−80` …) within the row, each chip 88 dp wide |
| Negative | A negative *grower* value colours that chip red-bold; a negative *total* colours the whole row as in S-04 |
| Overflow affordance | A fade gradient + `›` at the strip edge signals more growers; tapping any chip opens S-11 scoped to that grower |

**Rules**

- The grower order in every strip is the canonical seeded order (Mori Marco, Donati, Agriserv, Vivai riuniti, Bianchi, Golferenzo, Lorin, Esterno) — never alphabetical, never dependent on data presence, so the same grower is always in the same position.
- A grower with no quantity shows `—` (not `0`), with the accessible name "nessuna quantità".
- The chip strip is the only horizontally scrollable element on the page, and it never scrolls the page itself.

**States** — as S-04. Access by a `produttore`/`vendite` user (e.g. a saved link) renders **M-05 Accesso negato**, never an empty table.

**AC**

- AC-1 All 8 growers are represented in every row strip, in canonical order.
- AC-2 Visible only to Admin/Amministrazione — verified both by hidden navigation and by a route guard.
- AC-3 The list is flat (no group headers, no subtotals); the final row sums the total column *and* each grower column.
- AC-5 The **Produttore** filter keeps only the combinations involving that grower and highlights their column; the column total is unchanged by the filter.
- AC-4 Negative values at both levels are bold red with an icon; the two levels are distinguishable (row tint vs chip tint).

---

### S-07 · Riepilogo per produttore — desktop (`md`+)

| | |
|---|---|
| **Purpose** | The wide, per-grower matrix for the office |
| **Roles** | Admin, Amministrazione |
| **Entry** | Sidebar → Riepiloghi → Per produttore |

**Layout** — same shell as S-05. Grid columns:

| # | Column | Align | Note |
|---|---|---|---|
| 1 | Codice clone | left | frozen |
| 2 | Codice portainnesto | left | frozen |
| 3 | Magazzino | right | |
| 4 | Ordinato | right | |
| 5 | Di cui spedito | right | |
| 6 | Disponibilità | right | bold |
| 7–14 | One column per grower (8), header = grower name, two lines allowed | right | `−` values bold red |
| 15 | **Non attribuito** | right | orders with `id_magazzino IS NULL` — never spread across growers |
| 16 | Totale produttori | right | sum of columns 7–15, for verification |

- Header row height 48 dp to fit two-line grower names; the highlighted (filtered) grower column is tinted in both header and cells.
- Because the matrix exceeds 1440 dp, the grid scrolls horizontally inside its container with columns 1–2 and the header pinned; a *Solo disponibilità* toggle hides columns 3–5 for narrower screens.
- Sticky footer row "Totale generale" sums every numeric column; there are no per-rootstock subtotal rows (PD-2).

**AC**

- AC-1 Column 16 equals the sum of columns 7–15 for every row (a self-check visible to the user), and the 16 columns match §3.6.
- AC-2 Frozen columns 1–2 remain visible at any horizontal scroll offset.
- AC-3 Grower columns use the canonical order, and the order is configurable only in the column chooser (not by sorting the header).

---

### S-08 · Indisponibilità — mobile

| | |
|---|---|
| **Purpose** | Surface every combination where orders exceed stock, on a phone |
| **Roles** | Admin, Amministrazione, Produttore |
| **Entry** | Tab bar → Indisponibili; Home KPI card; deep link `/r/indisponibilita` |
| **Data** | `GET /reports/indisponibilita?...` → only rows with Magazzino − Ordinato < 0 |

**Layout zones**

| Zone | Spec |
|---|---|
| App bar | Title "Indisponibilità" + count badge `7` (red pill) |
| Filter bar | Same three filters as S-04 (Tipologia, Produzione, Codice varietà) — consistency over minimalism |
| Alert summary | Red-tinted card: "7 articoli con disponibilità negativa · deficit totale 3 240" with `!` icon |
| Deficit cards | One card per row (C-05 with negative treatment): Line 1 = `Codice varietà · clone` + deficit value right-aligned bold red (`−1.200`). Line 2 = `Portainnesto · Tipologia · Produzione` in caption. Line 3 = mini metrics `Magazzino 0 · Ordinato 1.200` |
| Sort disclosure | Caption "Ordinato per varietà, portainnesto, clone" — the required order, stated so nobody hunts for a sort control that isn't there |
| Bottom tab bar | Persistent, Indisponibili active |

**Interactions** — tap a card → S-11 detail sheet (shows the ordered lots/orders contributing, and the grower split where permitted). Pull-to-refresh. Long-press the deficit value → copy.

**States**

| State | UI |
|---|---|
| Loading | 3 skeleton negative cards (no red tint while unknown — red must never appear for unresolved data) |
| **Empty (the good case)** | `success-50` card: green check icon, "Nessuna indisponibilità con i filtri attuali", caption with the active filters, secondary action *Vedi disponibilità* → S-04 |
| Filtered-empty | Same card but with *Rimuovi filtri* as primary |
| Error | Inline banner + *Riprova* |

**AC**

- AC-1 Every displayed row satisfies Magazzino − Ordinato < 0; a row with zero or positive availability must never appear.
- AC-2 Sort order is varietà → portainnesto → clone, stated on screen.
- AC-3 The count badge equals the number of visible rows and is announced to assistive tech (`aria-live="polite"`).
- AC-4 The deficit figure equals `|Magazzino − Ordinato|` displayed with a leading `−`.
- AC-5 Never rendered for the `vendite` role (tab hidden + route guard → M-05).

---

### S-09 · Indisponibilità — desktop (`md`+)

**Purpose** — the wide shortage table for triage and export. **Roles** — admin, ufficio, produttore.

**Layout** — shell as S-05; a red summary strip above the grid ("7 articoli · deficit totale 3 240"), then the grid:

| Column | Align | Note |
|---|---|---|
| Tipologia | left | |
| Produzione | left | |
| Codice varietà | left | |
| Codice clone | left | |
| Codice portainnesto | left | |
| Magazzino | right | |
| Ordinato | right | |
| Deficit | right | bold red `−`, 3 dp left border on the row |

- Default sort varietà → portainnesto → clone (required); other columns sortable client-side with *Ripristina ordine*.
- Optional group-by-variety toggle inserts a variety subtotal row ("Totale varietà CH-01") — an addition for readability, visually distinct from the required rootstock subtotal; confirm §15 Q5.
- Row click opens the detail drawer (S-11) with the contributing orders.
- Empty state occupies the grid area with the green "nessuna indisponibilità" card.

**AC** — same invariants as S-08 AC-1/AC-2/AC-4, plus: the grid never renders a positive deficit, and the export (CSV/Excel/PDF) contains exactly the visible rows and columns.

---

### S-10 · Filtri (sheet `xs` / modal `md`+)

| | |
|---|---|
| **Purpose** | Set the three report filters comfortably, especially the searchable variety selector |
| **Roles** | All report roles |
| **Entry** | *Filtri* button in the report filter bar; tapping any filter chip's edit affordance; deep-linked with filters pre-set |

**Layout (`xs` — full-screen sheet, C-21)**

1. Header: "Filtri" + `Chiudi` (✕) on the left, `Applica` text button on the right (disabled until a change is made).
2. **Tipologia** — single-select list (radio rows, 44 dp), options from master data; first row `Tutte`.
3. **Produzione** — same pattern.
4. **Codice varietà** — searchable select (C-07): a search input pinned at the top of the section, virtualised result list showing `codice` (bold, mono) + `descrizione`; typing filters on both; empty search shows "Nessun risultato" + *Cancella ricerca*; selecting closes the list and shows the choice as a chip inside the row.
5. Footer (sticky): primary `Applica` (full width) and ghost `Azzera filtri`.

**Layout (`md`+)** — centred modal 560 dp: the three selects stacked with labels above, no Apply button (changes apply immediately, with debounce 300 ms), plus a footer `Azzera`.

**Behaviour**

- Single-select everywhere (requirement). Selecting a value in a group replaces the previous selection.
- `Applica` commits filters to the URL, closes the sheet and reloads the report; cancelling/back leaves the previous filters untouched.
- The variety select is searchable by code prefix and description substring, case- and accent-insensitive.
- Clone is **not** a report filter (the reports group by clone); the clone dependency (F-V2) applies only to entry screens.

**States** — no master data loaded: skeleton rows + banner "Caricamento anagrafiche…" with *Riprova*; master-data error blocks Apply and says so, rather than silently returning all rows.

**AC**

- AC-1 Every filter is a single-select; multi-select chips are impossible.
- AC-2 The variety list scrolls smoothly with 500+ codes (virtualised) and search results appear within 100 ms of typing.
- AC-3 The applied filter combination is visible as chips on the report and in the URL.
- AC-4 Applying filters never navigates away from the report screen; only the sheet closes.
- AC-5 Touch targets ≥ 44 dp; the sheet is dismissible by swipe-down and by the scrim.

---

### S-11 · Dettaglio riga (sheet `xs` / drawer `md`+)

| | |
|---|---|
| **Purpose** | Show every value behind one clone row, including the per-grower split and the contributing records |
| **Roles** | All report roles (grower columns only for Admin/Amministrazione) |
| **Entry** | Tap a clone row in S-04/S-06/S-08; click a grid row in S-05/S-07/S-09 |

**Layout (`xs` bottom sheet, half → full)**

1. Drag handle + title `CH-01 · 1103P` (variety · rootstock) with a close ✕.
2. Quantity block — four metric rows (label left, value right, tabular bold):
   `Magazzino`, `Ordinato`, `Di cui spedito`, `Disponibilità` (red bold when negative, with `!`).
3. **Per produttore** block (Admin/Amministrazione only) — vertical list of the 8 growers with their availability; `—` for absent, negative in red; a footer row `Totale` summing them.
4. **Dettaglio forniture** — the warehouse lots contributing (data, produttore, quantità) and **Dettaglio impegni** — the orders contributing (data, cliente, quantità, spedito ✓). Each block is capped at 5 rows with *Mostra tutti* expanding in place.
5. Sticky footer actions: `Copia valori` (clipboard, formatted TSV) · `Chiudi`.

**Layout (`md`+)** — right drawer 480 dp (C-26), same content in two columns; underlying grid keeps its scroll and selection highlight.

**States** — Loading: block skeletons per section. Partial data: sections that fail show their own inline error + *Riprova* while the rest renders. No contributions: C-18 mini empty state per block ("Nessun lotto registrato").

**AC**

- AC-1 The four quantities in the sheet exactly equal the row it was opened from.
- AC-2 The per-grower block is absent (not empty) for `produttore`/`vendite`.
- AC-3 `Copia valori` produces TSV that pastes into a spreadsheet as columns.
- AC-4 Closing returns to the same scroll position and filter state.

---

### S-12 · Esporta e condividi (sheet `xs` / modal `md`+)

| | |
|---|---|
| **Purpose** | Take the current report out of the app, with the given data, into a shareable file |
| **Roles** | All report roles (per-grower format only for Admin/Amministrazione) |
| **Entry** | `Esporta` in the report toolbar / app-bar overflow |

**Layout** — title "Esporta" + subtitle describing the active scope: "*Riepilogo disponibilità — 24 cloni, 3 portainnesti, filtri: Barbatelle innestate, Vaso, tutte le varietà*".

| Control | Options |
|---|---|
| Formato | Segmented: **Excel (.xlsx)** · CSV · PDF |
| Contenuto | Checkbox `Includi righe di subtotale` (on), `Includi righe negative evidenziate` (on, PDF only formatting note), `Includi filtri applicati come intestazione` (on) |
| Azioni | Primary `Esporta` · secondary `Condividi` (Web Share API where available) |

**Behaviour**

- `xs`: primary uses `navigator.share` with the file when supported (Android Chrome), otherwise triggers a download and shows a toast "File salvato in Download".
- Excel export produces one sheet per report, subtotal rows bold with a fill, negative rows bold red (matching the on-screen treatment).
- PDF export renders a print stylesheet: report title, filter line, generation timestamp and user, landscape at `md`+ / portrait on mobile, footer page numbers.
- Large exports (> 5 000 rows) run server-side and show a progress toast with cancel; the file downloads when ready.

**States** — preparing (button spinner + "Preparazione…"), success toast with *Apri*, error toast with *Riprova* and the correlation id, offline (export requires connectivity → button disabled with reason "Richiede connessione").

**AC**

- AC-1 The exported figures equal the on-screen figures, including subtotals.
- AC-2 Forbidden format/role combinations are absent, not disabled.
- AC-3 PDF portrait on phone does not clip the Disponibilità column of Report 1 (paginate columns instead).

---

### S-13 · Lotti magazzino — PC only (`md`+)

| | |
|---|---|
| **Purpose** | Record and correct the quantities that growers deliver into the warehouse |
| **Roles** | Admin, Amministrazione (entry). Read-only view for others is not exposed |
| **Entry** | Sidebar → Dati → Lotti magazzino; Home quick action; deep link `/dati/lotti` |
| **Guard** | `< 1024 dp` → renders **S-13L** (see below) |

**Layout** — shell (C-03) · top bar `Dati / Lotti magazzino` · toolbar: search field, filters (Produttore, Tipologia, Produzione, Varietà, date range), `Esporta CSV` (secondary — the **whole filtered list**, not just the page on screen, with the same headers the import accepts plus `id`), `Importa CSV` (secondary), `Nuovo lotto` (primary) · data grid (C-10).

**Grid columns**

| Column | Type | Notes |
|---|---|---|
| Data | date | default sort desc |
| Produttore | text | from the closed list |
| Tipologia | text | |
| Produzione | text | |
| Codice varietà | mono | |
| Codice clone | mono | |
| Codice portainnesto | mono | |
| Quantità | number, right | tabular, Italian locale |
| Note | text | truncated with tooltip |
| Azioni | icon buttons | Modifica · Duplica · Elimina (danger) |

Row height 40 dp; inline actions appear on hover or keyboard focus (always present on touch-capable PCs).

**Entry drawer (C-26) — `Nuovo lotto` / `Modifica lotto`**

| Order | Field | Control | Rules |
|---|---|---|---|
| 1 | Anno di conferimento | year select (current year ± 5, current by default) | F-V6 |
| 2 | Produttore | single-select, the 8 growers (§3.3) | F-V5 — nullable in the DB, **required in the UI** |
| 3 | Tipologia | single-select, the 4 fixed values | F-V8, required |
| 4 | Produzione | single-select, the 3 fixed values | F-V8, required |
| 5 | Codice varietà | **searchable** single-select from `anagrafica_vite` | F-V1, required |
| 6 | Codice clone | single-select, **disabled until a variety is chosen**, options = clones of that variety; changing the variety clears the clone and shows the hint "Seleziona prima la varietà" | F-V2, required |
| 7 | Codice portainnesto | single-select from `anagrafica_portainnesto` | F-V3, required |
| 8 | Quantità | integer input, `inputmode=numeric`, no decimals | F-V4, required |
| 9 | Note | textarea, 500 chars, counter | optional |

- Sticky footer: `Salva` (primary) · `Salva e nuovo` (secondary) · `Annulla` (ghost). `Ctrl/⌘+Enter` saves; `Esc` prompts if dirty.
- Saving validates client-side, submits, then closes the drawer, keeps the filters, re-fetches and highlights the new row for 2 s with a `brand-50` flash + toast "Lotto salvato".
- `Duplica` opens the drawer prefilled from the selected row with a fresh date.
- `Elimina` opens **M-01** (high severity if the lot is referenced by any commitment, explaining why).

**States** — table loading (8 skeleton rows), empty ("Nessun lotto registrato" + *Nuovo lotto*), filter-empty (+ *Azzera filtri*), save error (drawer stays open, error banner at the top, offending field focused), concurrent-edit conflict ("Questo lotto è stato modificato da un altro utente" + *Ricarica* / *Sovrascrivi* for Admin only).

**AC**

- AC-1 The clone select is not usable before a variety is selected and never lists clones of another variety (verified by API too).
- AC-2 Quick entry of a lot takes ≤ 8 interactions with no free-text typing of codes.
- AC-3 A failed save never loses the entered data.
- AC-4 Quantities are integers (per the `integer` column): displayed with the Italian thousands separator (`1.250`), never with decimals, and the input rejects a decimal separator with an explicit message.

**S-13L · Locked card (any viewport < 1024 dp)**

App bar "Dati" + a centred card: lock icon, title "Inserimento dati disponibile solo da PC", body "Registra lotti e ordini da un computer. Su smartphone puoi consultare i riepiloghi.", primary `Vai ai riepiloghi` → S-04, secondary `Copia link` (copies the deep link for the PC). No fields, no tables.

---

### S-14 · Ordini e impegni — PC only (`md`+)

| | |
|---|---|
| **Purpose** | Record committed/sold quantities and their shipping state |
| **Roles** | Admin, Amministrazione |
| **Entry** | Sidebar → Dati → Ordini e impegni; Home quick action `/dati/ordini` |

**Layout** — identical structure to S-13 (toolbar with `Esporta CSV` and `Importa CSV`, grid, drawer), with these differences:

| Column | Type | Notes |
|---|---|---|
| Lotto collegato | lot ref | `id_magazzino` — shows the lot's produttore/year, or — when null |
| Tipologia | text | prefilled from the lot, still editable |
| Produzione | text | prefilled from the lot, still editable |
| Codice varietà · clone · portainnesto | mono | same validation as lots |
| Quantità ordinata | integer, right | F-V4 |
| Spedito | **toggle (C-16)** | inline editable; toggling stamps a `brand-50` row tint and an undo toast. There is **no shipment date** in the schema (F-V7) |
| Note | text | **shown in full in read mode**, wrapped inside the cell (no truncation, no tooltip needed): the office reads the delivery instructions straight from the list |
| Azioni | icons | Modifica · Elimina |

**Drawer fields** (in schema order, §3.4) — Lotto collegato (searchable lot picker prefilling the dimensions) · Tipologia · Produzione · Codice varietà (searchable) · Codice clone (dependent) · Codice portainnesto · Quantità ordinata · **Spedito** switch · Note. Error actions `Segna come spedito` ignore the dimensions and only flip `spedito`.

**Behaviour**

- Toggling `Spedito` inline saves immediately with an optimistic update and an **undo toast** (C-20) for 8 s; failure reverts the toggle with an error toast.
- Because ordered quantities feed what the reports call `Ordinato`, an order that pushes a key below zero raises the non-blocking F-V10 acknowledgement: "La disponibilità andrà sotto zero: −450". Overselling is a legitimate recorded state here, never a blocked one.
- Bulk actions: select rows → `Segna come spedito` / `Esporta selezione`.

**AC**

- AC-1 Any change to `spedito` is visible in S-04/S-05 "Di cui spedito" after the next refresh (documented cache TTL ≤ 30 s).
- AC-2 The order form has no date field: the lot year is inherited from `id_magazzino` and an order's own age is `created_at`, shown read-only in the drawer footer.
- AC-3 Excel import and manual entry produce identical validation messages for the same bad values.

---

### S-15 · Import Excel — PC only (`md`+)

| | |
|---|---|
| **Purpose** | Load many lots or orders in one operation, with validation before anything is written |
| **Roles** | Admin, Amministrazione |
| **Entry** | Sidebar → Dati → Importa Excel (or `Importa Excel` from S-13/S-14) `/dati/import` |

**Layout** — stepper (C-23) across the top: `1 Carica file → 2 Mappa colonne → 3 Valida → 4 Importa`. Body is a 720 dp centred card. Nothing is written to the database before step 4 is confirmed.

**Step 1 — Carica**

- Target selector: **Lotti magazzino** / **Ordini e impegni** (determines the required column set).
- Drop zone + `Scegli file` (`.xlsx`, `.xls`, `.csv`), max 20 MB, template download link `Scarica modello`.
- Client-side parse of the sheet: choose the sheet if more than one; show row/column counts.

**Step 2 — Mappa colonne**

- Two-column table: **Colonna del file** (detected header) → **Campo dell'applicazione** (select). Auto-detection by header name; unmatched fields highlighted `warn`.
- Required fields must all be mapped before `Avanti` enables. For `lotti_magazzino`: Anno di conferimento, Codice varietà, Codice clone, Codice portainnesto, Quantità (Produttore, Tipologia and Produzione are strongly recommended and reported as warnings when missing). For `ordini_impegni`: Tipologia, Produzione, Codice varietà, Codice clone, Codice portainnesto, Quantità, Spedito (Sì/No/TRUE/FALSE).
- "Ignora colonne non mappate" is implicit; a `Salva mappatura` option stores the mapping per user for next time.

**Step 3 — Valida**

- Runs F-V1…F-V7 row by row **plus** cross-row checks (duplicate rows, variety/clone mismatch).
- Summary strip: `412 righe lette · 409 valide · 3 con errori · 5 avvisi`.
- Error table (C-10): Riga · Colonna · Valore · Motivo ("`CH-99` non presente in anagrafica", "Clone `CL-3` non appartiene alla varietà `CH-01`", "Quantità negativa"). Each error is exportable as a CSV the operator can fix and re-upload.
- Warnings (non-blocking): duplicate in-file row, quantity zero, produttore `Esterno` without note.
- `Avanti` is enabled only when there are **zero errors**; warnings require an explicit "Ignora avvisi" checkbox.

**Step 4 — Importa**

- Confirmation panel: "Stai per importare 409 lotti in lotti_magazzino", the target, and a warning that the operation is logged.
- Primary `Importa 409 righe` (danger-styled only for orders affecting shipped quantities; otherwise primary).
- Progress bar with row counter and cancel; on completion: results card `409 importate · 0 scartate` + `Scarica report` + `Nuova importazione` + link to S-13 filtered to the imported date.

**States** — wrong file type (inline error, drop zone shake suppressed under reduced motion), unreadable sheet, mapping impossible (required field missing from the file → explained with the template link), server validation race (server re-validates; a late error returns the operator to step 3 with the new errors merged), offline (blocked at step 1).

**AC**

- AC-1 No row reaches the database before step 4 confirmation.
- AC-2 Every rejected row carries a reason an operator can act on — row, column, value and cause.
- AC-3 The import is atomic: either all valid rows are written or none (per file), and the report states which.
- AC-4 The same file uploaded twice produces a duplicate warning per previously imported row.

---

### S-16 · Anagrafica vite — PC only (`md`+)

| | |
|---|---|
| **Purpose** | Own the variety/clone vocabulary that every lot, order and import is validated against |
| **Roles** | Admin (edit), Amministrazione (read) |
| **Entry** | Sidebar → Anagrafiche → Vite `/anagrafiche/vite` |
| **Data** | `anagrafica_vite (id, codice_varieta, codice_clone, created_at)` — **one row per pair** |

**Layout** — a single pane, because the schema has no separate clone entity:

| Zone | Content |
|---|---|
| Toolbar | Search (matches variety or clone, case-insensitive), `Varietà` searchable filter, `Nuova varietà/clone` (primary), `Aggiungi in blocco` |
| Filters | **Varietà** (searchable single-select over the 1 452 variety codes) and a **clone code** search box; `Azzera` clears both. The variety is a *filter*, not a grouping level (PD-5) |
| Grid | `Codice clone` (mono) · `Codice varietà` (mono) · `Utilizzi` (count of lots + orders referencing the pair) · `Stato` · actions. One row per pair, sorted by variety then clone, 60 rows per page with «Mostra altri» |

**Behaviours**

- `Nuova varietà/clone` opens a drawer with **two** fields: `Codice varietà` (searchable select whose last option is **"+ crea nuova varietà…"**, because a variety exists only through its pairs) and `Codice clone`. Saving inserts one pair.
- `Aggiungi clone` on a group header opens the same drawer with the variety prefilled — the common daily operation.
- `Aggiungi in blocco`: paste lines of `VARIETÀ;CLONE` (or `VARIETÀ<TAB>CLONE`), preview the parsed pairs, mark duplicates and invalid blanks, then commit in one action.
- Deleting the **last clone of a variety** removes that variety from every select: the UI states this explicitly with the clone count and requires M-01 confirmation.
- A pair referenced by lots or orders cannot be deleted (F-V9 pattern): the count is shown and deactivation is offered instead.
- Duplicate `(varietà, clone)` pairs are refused by the UI with an inline error even though the database does not yet enforce uniqueness (§3.8 D4).

**AC**

- AC-1 A pair created here is immediately selectable in S-13, S-14 and S-15 (cache invalidated on save) without a redeploy.
- AC-2 A duplicate pair is rejected client-side before any write, naming the existing row.
- AC-3 Deleting a referenced pair is impossible from the UI and rejected by the API.
- AC-4 The `Utilizzi` count equals lots + orders for that pair, and recomputes after any delete attempt.
- AC-6 The list is flat: no variety group headers. Choosing a variety keeps only that variety's pairs and the subtitle reads "n cloni di <varietà>"; `Azzera` restores the full list.
- AC-5 Codes are trimmed and compared case-insensitively for duplicates, but stored exactly as typed.

---

### S-17 · Anagrafica portainnesto — PC only (`md`+)

**Purpose** — own the rootstock vocabulary (the third validation constraint). **Roles** — Admin (edit), Amministrazione (read).

**Layout** — single pane: toolbar (search, `Nuovo portainnesto`) + grid: `Codice portainnesto` · `Utilizzi` · `Stato` · actions. The table has **no description column** — `anagrafica_portainnesto` stores the code only, so the description field from a generic design does not exist here. Same referential-integrity rule as S-16: referenced codes cannot be deleted, only deactivated. Codes feed every portainnesto select and are the group key of all three reports, so a rename is restricted to unreferenced codes and is logged.

**AC** — AC-1 Deactivating a rootstock removes it from entry selects but keeps it visible in historical reports with an `inattivo` chip. AC-2 The report grouping order follows code ascending.

---

### S-18 · Form builder — PC only (`md`+), Admin only

| | |
|---|---|
| **Purpose** | Let the Admin add or change fields and sections of the data-entry screens without a developer |
| **Roles** | `admin` only |
| **Entry** | Sidebar → Configurazione → Form builder `/config/form` |

**Layout** — three panes:

| Pane | Content |
|---|---|
| Left (280 dp) | **Schermate** list: *Lotti magazzino*, *Ordini e impegni* (extensible to custom screens). Each shows a `pubblicato`/`bozza` chip and last-modified metadata. `Nuova schermata` at the bottom |
| Centre (flex) | **Canvas** of the selected form: ordered list of field rows and section headers, each a draggable card (C-cards with a grip) showing label, field type chip and a `obbligatorio` badge. Toolbar: `Anteprima`, `Salva bozza`, `Pubblica`, `Annulla modifiche` |
| Right (360 dp) | **Palette** on top (`Trascina un nuovo campo`): Testo, Numero, Data, Selezione singola, Selezione multipla, Casella, Testo lungo, Intestazione sezione. Below it, the **properties** of the selected field |

**Field properties**

`Etichetta` · `Nome campo (API)` · `Tipo` · `Obbligatorio` · `Valore predefinito` · `Suggerimento` · `Origine dati` (static list / `anagrafica_vite` / `anagrafica_portainnesto` / growers) · `Dipende da` (e.g. clone depends on variety — this is how F-V2 is declared) · `Visibile ai ruoli` · `Larghezza` (½ / 1 colonna).

**Behaviour and guardrails**

- `Anteprima` opens a read-only rendering of the form with real master data — including the dependent-select behaviour — before publishing.
- `Pubblica` opens **M-04** summarising changes ("2 campi aggiunti, 1 obbligatorio reso opzionale") and requires confirmation; publishing bumps a version and writes an audit entry.
- Required system fields (the master-data trio, date, quantity, produttore) cannot be deleted or made optional — the UI marks them `Sistema` with a lock icon and explains why.
- Deleting a custom field never deletes stored data: it hides it, and existing values remain readable in the record drawer under "Campi non più in uso".
- A published form is what S-13/S-14 render; drafts are visible only in the builder.

**AC**

- AC-1 Changes affect the entry screens only after `Pubblica`; a reload of S-13 never shows a draft.
- AC-2 System fields are protected from removal, renaming and de-requiring.
- AC-3 Every publish creates a restorable version.
- AC-4 The builder is unreachable (and the route blocked) for non-admin roles → M-05.

---

### S-19 · Utenti e ruoli — PC only (`md`+), Admin only

**Purpose** — manage who signs in and with which of the four roles. **Roles** — `admin`.

**Layout** — toolbar (`+ Nuovo utente`) + grid: Nome · Email · Ruolo · Produttore collegato (only when ruolo = `produttore`) · Stato (attivo/invitato/sospeso) · Azioni (`Ruolo`, `Password`, `Sospendi` / `Riattiva`). Below the grid, a banner explains that in *Dati reali* mode the account is created in the database and the permissions are enforced there.

**Behaviour**

- `Nuovo utente` creates the account **in the database** through a staff-only server function and returns a **one-time temporary password**, shown once in a panel with `Copia` and `Invia email`: the administrator either hands the password over or lets the user set their own through the e-mail link (PD-6). The password is never stored by the app, never listed in the grid, and cannot be shown again.
- When the project deploys the `send-credentials` Edge Function (PD-8), the form shows *“Invia la password all'indirizzo indicato”*: the password is e-mailed immediately and the panel reports the delivery (`Invia email` becomes `Reinvia email`). Without the function — or without a mail-provider secret — the screen behaves as before and says so in the panel.
- `Password` opens a small sheet with **two modes** (PD-9): *genera una password temporanea* (the one-time panel above, optionally e-mailed) or *imposta una password scelta da te*, for the cases where the office hands over a password already agreed with the person. In both modes the previous password stops working immediately.
- Creating a `produttore` requires selecting the producer they represent; the two are linked 1:1.
- `Sospendi` sets the account inactive: it cannot sign in and the sign-in is refused at the profile check; `Riattiva` reverts it.
- The last remaining `admin` cannot be suspended or demoted (explained inline).

**AC**

- AC-1 Role changes take effect on the affected user's next sign-in (no stale menu) — verified against the live database.
- AC-2 Permission language on this screen matches the actual route guards (§12) — verified by test.
- AC-3 Emails are validated and unique; a duplicate is refused by the database with an inline Italian error.
- AC-4 A user who is not an administrator calling the creation/reset functions directly is refused (`Non autorizzato`) — verified by test.
- AC-6 A chosen password must be 8–72 characters, must not be the e-mail address, and can only be set by staff; a non-staff caller is refused — verified against the live database.
- AC-5 In *Modalità dimostrativa* the same flows run against the local registry, with no network call.

---

### S-20 · Profilo e impostazioni (`xs`–`xl`)

**Purpose** — identity, session and the small set of preferences that matter. **Roles** — all.

**Layout (`xs`)** — app bar "Profilo" · header card (name, email, role chip, grower if applicable) · list groups:

| Group | Rows |
|---|---|
| Account | Dati personali (read-only for non-admin), Cambia password. **The registered-account list is visible to Amministratore only** |
| Gestione | *Gestione utenti* — shown to Admin and Amministrazione |
| Preferenze | Unità di misura visualizzata (if configurable), Formato numerico (it-IT, fixed), Dimensione testo della tabella (`md`+) |
| Sessione | Disconnetti (danger text) |
| Informazioni | Versione, Ambiente, Note legali, *Installa l'app* (PWA prompt where available) |

**States** — offline (preferences read-only, sign-out still allowed), session expiring (banner "Sessione in scadenza" + *Rinnova*).

**AC**

- AC-1 `Disconnetti` clears the session and returns to S-01 in one tap with no confirmation dialog (low-risk, recoverable).
- AC-2 Preferences persist per user server-side only when they affect reports (unit of measure), otherwise locally.
- AC-3 The screen is the same for every role; rows the role cannot use are absent.

---

## 9. Overlays

### M-01 · Conferma eliminazione

| | |
|---|---|
| **Trigger** | `Elimina` on a lot/order; any destructive action |
| **Layout** | Centred modal (`md`+) / bottom sheet (`xs`): danger icon, title "Eliminare il lotto?", body naming the record (`2 ott 2026 · Donati · CH-01 · CL-3 · 1.250`), consequence line ("Verrà rimosso dai riepiloghi"), footer `Annulla` (secondary) + `Elimina` (danger) |
| **High severity** | When the record is referenced (`utilizzi > 0`) the severity escalates: red header band, explanation with the reference count, and **type-to-confirm** — the operator types the clone code to enable `Elimina`. Destructive button is never focused by default |
| **Keys** | `Esc` cancels; `Enter` never confirms a high-severity deletion |

### M-02 · Report errori di importazione

Modal (720 dp) listing rejected rows (same table as S-15 step 3) with `Scarica CSV degli errori` and `Chiudi`. Available after any import, including from the completion card.

### M-03 · Selettore varietà a schermo intero (`xs`)

Full-screen searchable list (C-07 mobile variant): search input autofocused with the on-screen keyboard, sticky header `Codice varietà` + `Annulla`, results as 56 dp rows (`CH-01` mono bold + description + the variety's clone count), recent selections at the top when the query is empty, `Nessun risultato` state with *Cancella ricerca*.

### M-04 · Conferma pubblicazione form

Publish confirmation for S-18: what changes, what it affects, who will see it, `Pubblica` (primary) / `Annulla`. Includes "Anteprima" link.

### M-05 · Accesso negato / Sessione scaduta

Single modal with two variants:

- **Negato** — lock icon, "Non hai i permessi per questa sezione", body naming the role, primary `Torna alla home`.
- **Scaduta** — "Sessione scaduta", body "Accedi di nuovo per continuare", primary `Accedi di nuovo` (returns to the exact intended route after login).

Never rendered as an empty table or a blank screen.

---

## 10. Cross-cutting patterns

### 10.1 State matrix (every data screen)

| State | Requirement |
|---|---|
| Initial load | Skeleton matching the final layout (never a centred spinner alone); layout must not shift on data arrival |
| Refreshing with data | Keep data, dim to 40 %, 2 dp indeterminate bar under the filter bar |
| Empty | C-18 with icon, reason, one primary action. Distinct copy for "no data at all" vs "no data for these filters" |
| Error | Inline banner in the affected region (not a toast, not a full-page takeover), message in plain Italian, correlation id in caption, `Riprova` action |
| Partial failure (KPIs ok, one section failed) | Section-level error; the rest of the screen stays usable |
| Offline | Banner + last-known data + timestamp; write actions disabled with a reason |
| Permission denied | M-05, never an empty state |
| Long operation | Progress with elapsed time and a working `Annulla` |

### 10.2 Formatting rules

| Item | Rule |
|---|---|
| Numbers | `Intl.NumberFormat('it-IT')`; thousands `.`, decimals `,`; `tabular-nums`; negatives prefixed `−` |
| Decimals | 0 by default for quantities; 2 only if the unit requires it (§15 Q1) |
| Dates | `2 ott 2026` (`xs` lists), `02/10/2026` (tables), relative ("2 h fa") in activity contexts only |
| Codes | Always monospace, always shown verbatim, never title-cased (`CH-01`, `1103P`, `CL-3`) |
| Emptiness | `—` for "not applicable/absent"; `0` only for a real measured zero |
| Text truncation | 1 line with ellipsis in lists, full value in the detail sheet, `title`/`aria-label` carrying the full text |

### 10.3 Toasts and feedback

Success toasts are short and specific ("Lotto salvato"), appear above the tab bar (`xs`) or bottom-right (`md`+), auto-dismiss after 4 s, and never stack more than one. Undo affordances (8 s) for `Spedito` toggles and inline deletions. Errors that need action are inline banners, not toasts.

### 10.4 Copy tone

Italian, second person singular ("Accedi", "Rimuovi filtri"), no exclamation marks, no jargon like "record" in user-facing copy. Quantities always name their unit when ambiguous. Validation messages follow `Riga {n} · {campo} · {valore}: {motivo}`.

### 10.5 Print / export stylesheet

Reports print with: report title, filter summary line, generation timestamp and user, repeating table header, subtotal rows bold with a grey fill, negative rows bold with a red tint that survives greyscale (bold + `−` prefix carry the meaning in monochrome), page numbers, and the app footer with the environment.

---

## 11. Accessibility (WCAG 2.2 AA)

| Area | Requirement |
|---|---|
| Landmarks | `header`, `nav`, `main`, `footer`; report tables are real `<table>` with `<caption>`, `<th scope>` and `aria-sort` |
| Groups | Rootstock groups use `<tbody>` with a `role="rowgroup"` + labelled sub-header so a screen reader announces "Portainnesto 1103P, totale disponibilità 12.340" before the clone rows |
| Negative values | Announced as "meno 450", never conveyed by colour alone — the `!` icon has `aria-label="disponibilità negativa"` and the cell carries `aria-describedby` to a hidden note |
| Subtotal rows | `aria-rowindex` + accessible name "Totale portainnesto 1103P" |
| Touch targets | ≥ 44×44 dp with ≥ 8 dp separation; metric strips keep 44 dp height |
| Focus | Visible ring `2 dp brand-600` with 2 dp offset; logical order follows visual order; no focus traps outside sheets (which trap intentionally and restore focus on close) |
| Contrast | Text ≥ 4.5:1, non-text ≥ 3:1; verified for `danger-700`/`danger-50` and `brand-600`/white |
| Zoom | 200 % text zoom without loss of function; the `md`+ grid offers its own density control because page zoom is suppressed by the app shell |
| Motion | All animation honours `prefers-reduced-motion` |
| Forms | Every input has a persistent visible label (no placeholder-as-label), `autocomplete` set, errors linked via `aria-describedby` and `aria-invalid` |
| Screen-reader flows | Login → home → filter → read a group → open detail, operable without sight of the table |
| Language | `<html lang="it">`; codes marked `lang="und"` where a screen reader would mispronounce them |

---

## 12. Security and permissions enforcement in the UI

1. **Role-scoped rendering is presentation only.** Every screen and endpoint is authorised server-side; the client never receives data the role may not see (the per-grower report is not merely hidden — it is not fetched).
2. **Session** in `HttpOnly`+`Secure`+`SameSite=Lax` cookies; no tokens in `localStorage`; sign-out clears server session.
3. **Password handling** — never displayed, never re-readable after creation, reset only through a link, `autocomplete="current-password"` / `"new-password"`.
4. **No credential material in the UI logs.** Analytics events carry roles, screen ids and counts — never quantities, codes, emails or free text (§14).
5. **Least data on mobile** — the phone fetches report aggregates only; export of the per-grower matrix is role-gated.
6. **Idle lock** — after 15 min backgrounded, a return shows a re-auth prompt (M-05, scaduta) before data is re-rendered from cache.
7. **CSRF** — double-submit token on all mutating requests; the import wizard uses an idempotency key so a retry cannot double-import.
8. **Client-side validation is a convenience**, never a boundary: F-V1…F-V7 are re-validated server-side and the API is the source of truth for the master-data constraints.
9. **Audit trail** — lot/order create/update/delete, `spedito` changes, master-data edits and form publishes are recorded with user, timestamp and before/after values; readable by Admin (v1.1 screen).

---

## 13. Performance budgets

| Interaction | Budget (p75, mid-tier Android / office PC) |
|---|---|
| Cold start → Home first paint | ≤ 1.8 s mobile · ≤ 1.0 s PC |
| Report switch | ≤ 120 ms (client) + ≤ 1.5 s first data |
| Filter apply → new data rendered | ≤ 900 ms |
| Group expand/collapse | ≤ 100 ms, no network |
| Detail sheet open | ≤ 180 ms |
| Import validation of 500 rows | ≤ 2 s client-side |
| Initial JS bundle | ≤ 200 KB gzipped |
| Dataset ceiling on mobile | 20 groups × 50 clones per page, then paginate |
| Memory ceiling | ≤ 200 MB with 5 000 rows available |
| Table rendering | virtualised beyond 200 rows at `md`+ |

---

## 14. Analytics (privacy-preserving)

Events carry screen id, role and counts only — never quantities, codes, grower names or free text.

| Event | Properties |
|---|---|
| `screen_view` | `screen_id`, `role`, `breakpoint` |
| `report_filter_applied` | `report_id`, `which_filters_set` (booleans), `result_rows` |
| `report_row_opened` | `report_id`, `was_negative` (bool) |
| `report_exported` | `report_id`, `format`, `row_count` |
| `entry_saved` | `entity` (lotto/ordine), `is_new`, `validation_errors` |
| `import_completed` | `entity`, `rows_total`, `rows_ok`, `rows_failed`, `duration_ms` |
| `pc_only_gate_shown` | `attempted_route`, `breakpoint` |
| `permission_denied` | `route`, `role` |
| `search_variety` | `query_length_bucket`, `results_count` (never the query text) |

---

## 15. Open questions and decisions

Status after reconciling `docs/db-schema.sql`.

### 15.1 Resolved by the delivered schema

| # | Question | Resolution |
|---|---|---|
| Q1 | Unit of measure and decimals for `quantita` | `quantita integer` in both tables → whole pieces, no decimals, `inputmode=numeric`, Italian thousands separator only (§3.5) |
| Q2 | Field names and types | Taken from the dump — §3.1/3.4 replace the earlier ⟨TBD-schema⟩ placeholders. Residual gaps are tracked in §3.8, not against the whole model |
| Q6 | Is there a grower attribution behind ordered quantities? | Partially: an order reaches a grower only through `ordini_impegni.id_magazzino → lotti_magazzino.produttore`. Orders with a null link are reported in a dedicated **"Non attribuito"** column (§3.6). What the business *expects* is still to be confirmed (below) |
| Q7 | Are `tipologia` / `produzione` master data? | No: fixed `CHECK` enumerations, 4 and 3 values (§3.2). Adding a value is a migration, not an admin action |
| Q9 | Are there also "dates" to filter by? | The only time dimensions are `anno_conferimento` (lots) and `created_at` (both). There is no business date field and no shipment date |

### 15.2 Still open

| # | Question | Current assumption in this spec | Owner |
|---|---|---|---|
| Q3 | Is a `produttore` user bound 1:1 to one grower, and must the phone hide other growers' figures? | Aggregate totals visible to all report roles; per-grower split restricted to Admin/Amministrazione as required | Business |
| Q4 | `anno_conferimento` exists on lots but **not** on orders: how should a year filter behave? | Optional year filter scoped to lots only, labelled "Anno di conferimento (lotti)"; orders are never excluded by it — stated in a caption so the numbers are interpretable | Business + backend |
| Q5 | Is a "Totale generale" row wanted in Report 1? | Included; the requirement only mandates per-rootstock subtotals | Business |
| Q8 | Excel column layout expected by the office | Now fully definable from §3.4; a canonical template ships with S-15 | Business |
| Q11 | The three report views (`riepilogo_disponibilita`, per-grower, `indisponibilita`) are **absent from the dump** although the requirements cite `riepilogo_disponibilità`. Who owns them? | Spec assumes server-side views exist as the single definition of the metrics; a reference SQL sketch is in §3.8 | Backend |
| Q12 | `anagrafica_vite` has no unique constraint on `(codice_varieta, codice_clone)`, and `anagrafica_portainnesto` has no description column | UI enforces uniqueness client-side meanwhile (§3.8 D4); no description field is designed | Backend |
| Q13 | `lotti_magazzino.produttore` is nullable free text with no reference table — should it become an FK to a growers table? | UI enforces the closed 8-name list; unknown/legacy values surface as "Non riconosciuto" rather than being hidden (§3.3) | Backend |
| Q14 | There is no customer/reference field on `ordini_impegni`. Does the office need to record who an order is for? | **Not designed in v1** — orders are commitments against a lot. If a customer dimension is required it is a schema change plus an S-14/S-15 field | Business |
| Q15 | `lotti_magazzino.tipologia/produzione` are nullable while the same columns are `NOT NULL` on orders. Are null lots legacy data to clean up or a valid state? | Tolerated: grouped as "(non indicata)" with a data-quality badge (§3.5) | Business |
| Q16 | Authentication source — Supabase Auth, SSO, or local users? | Email + password managed by the app, no SSO in v1 | Tech |
| Q17 | Is "Esterno" a real grower with the same rights as the others? | Treated as an equal grower (non-member supplier bucket) | Business |

---

### 15.3 Product decisions that override the requirements

| # | Decision | Rationale | Effect |
|---|---|---|---|
| **PD-16** | The availability report gains **«Ripiantate» and «Frigoconservate»** — the warehouse quantity of the same clone+rootstock held with `produzione = 'Ripiantato'` / `'Frigoconservato'` — shown after Disponibilità and **hidden until the «Aggiungi altro» button in the header is pressed** (the choice is remembered) | The office checks at a glance whether a clone is only sold as new production or is also held as replanted/fridge-stored material; keeping the two columns behind a button keeps the everyday table at six columns on a phone | Adds the button to S-04, the two columns to the export when open; combinations that exist *only* with the other produzione have no row in a produzione-filtered report, so their quantity is not represented |
| **PD-19** | **Alternative stock without a «Nuova produzione» reference gets its own row** when «Aggiungi altro» is pressed: the four main columns at zero, the two new columns filled, muted style and a «solo Ripiantato/Frigoconservato» badge; the rows join the usual groups, so subtotals and the grand total cover the whole alternative stock | The reference join of PD-18 is right for comparing a clone with itself, but it hid real stock whenever the replanted/fridge-stored lot had a different produttore, year or rootstock — the column then showed a fraction of the truth. A separate row keeps the comparison honest and still shows everything | Supersedes the row set of PD-18; migration 008 recreates the view with `ha_riferimento` |
| **PD-18** | The availability report **drops the Produzione filter** and always shows the quantities of **Nuova produzione**; the two optional columns are **«Ripiantato»** and **«Frigoconservato»**, joined on the **lot reference** of a Nuova produzione lot (tipologia, codice varietà, codice clone, codice portainnesto, produttore, anno di conferimento) and carrying the *available* quantity of that reference in the other produzione — warehouse **minus** commitments — still hidden behind «Aggiungi altro» | Comparing new-production stock with replanted/fridge-stored material is a daily question, and it only makes sense against the same lot reference: mixing varieties or producers produced numbers that never reconciled. Keeping one produzione in the table removes a filter nobody changed and makes the baseline unambiguous | Supersedes the produzione-filter part of PD-3/PD-16; adds migration 007 for the roles that cannot read the tables |
| **PD-17** | **An order can be saved with `id_magazzino = NULL`**: the picker offers «— Nessun lotto —» and a «Nessun lotto» button detaches the current one, keeping the dimensions already filled | Recording a commitment before the delivery exists is normal; until now the only way out was to cancel the form | Supersedes the «the link is optional» UI gap of PD-13 (the data model already allowed it) |
| **PD-13** | **The lot link on an order is optional**: tipologia, produzione, varietà, clone, portainnesto, quantità and the shipped flag are enough to record a commitment; `id_magazzino` stays a convenience that attributes the quantity to a producer | The office sometimes records a commitment before the delivery that will feed it exists. Forcing the link produced placeholder lots; leaving it empty is honest, and the per-grower report already warns about the unattributed quantity | Supersedes the «every commitment is placed against a lot» rule stated in PD-4 and S-14 |
| **PD-12** | **A per-rootstock subtotal never crosses a variety**: its key is tipologia + produzione + varietà + portainnesto, so the total sits directly above the rows it sums; rows are sorted rootstock → varietà → clone and the subtotal line repeats the variety | With one subtotal per rootstock code, a variety that shares its rootstock with a dozen others showed a total nobody could reconcile with the visible rows; the office reads the table from the total down, so the total must describe exactly what follows it | Supersedes the per-rootstock key of PD-7 in every report (availability, mancanze, per-grower, messo a disposizione) |
| **PD-11** | The shortage report is called **«Mancanze»** in the menu, on the Panoramica («In mancanze») and on its own page; the subtitle keeps «combinazioni in deficit» | «Indisponibilità» described a state of the *warehouse*; the office asks «cosa manca?» — the new label reads as a question in the panorama tiles and matches how the shortage list is discussed in the warehouse | Labels only: the route `#/r/indisponibilita`, the capability key and the CSV content are unchanged (the exported file is called `mancanze_…csv`) |
| **PD-10** | **Data entry writes to the database** — the entry screens (lots, orders, import, anagrafiche) no longer stop at a «read-only» notice: they call PostgREST directly and the database decides, through the `staff_write` RLS policies and the existing validation triggers | The app is used on the real warehouse, so recording a delivery had to happen in the app rather than in the Supabase table editor. Keeping the check in the policies (not in the browser) means the same rules already verified for the reports also hold for writes, and the demo backend keeps working through the same API | Supersedes the read-only notice of S-13/S-14/S-15/S-16/S-17; no schema change needed |
| **PD-9** | **Passwords are self-service and settable**: the Profilo screen lets a signed-in user change their own password by giving the current one, and the *Utenti* sheet lets staff either generate a one-time password or **type one themselves** (RPC `set_user_password`, staff-checked) | Until now only a generated password existed, so a person who forgot theirs had to ask an administrator, and an administrator could not set a password the office had already agreed on. Requiring the current password for self-service keeps a stolen session from locking the owner out, and keeping the check inside the database means the browser cannot grant itself the right to change someone else's credentials | Adds migration 006 and the Profilo *Password* card |
| **PD-8** | **The one-time password can be e-mailed by an Edge Function** (`send-credentials`), which the *Utenti* screen calls with the administrator's own token; the function re-uses the same staff-checked RPCs and sends the mail through a provider key kept as a function secret. Fully optional: without it, the panel keeps the copy/link behaviour | Mailing the password from a static page is impossible without the secret key, and e-mailing it from the browser would need that key in the bundle. A function keeps the check in the database, removes the copy-by-hand step the office complained about, and still degrades to the old flow when it is not deployed | Adds `supabase/functions/send-credentials`; see its README for the two secrets and the `EMAIL_CREDENTIALS` flag in `js/config.js` |
| **PD-7** | **The per-rootstock subtotal opens its group instead of closing it** (Report 1, 3, 2 and the new Report 5), Report 2 and Report 3 gain the same subtotal logic, Report 3 is re-sorted rootstock-first, the note reaches the read grid of S-14 with a CSV export on S-13 and S-14, and the producer panorama drops «Da spedire» in favour of the new **Messo a disposizione** report | The office reads a group from its total down to the single clones: with the subtotal at the end the eye has to jump back, and on a phone the total landed after the content it summarised. Report 3 had the same need but its variety-first sort made the groups non-contiguous, hence the new order. A producer does not ship: the «Da spedire» shortcut was noise on their phone, while “what did I make available?” is the only question that profile asks, and it must be answered without exposing the other producers' rows | Supersedes the “no subtotals in Report 2” part of PD-2/PD-4 and the subtotal-at-end rule of PD-3; adds S-23 and migration 005. The draw.io mockup (pages 03–05) still shows the pre-PD-7 subtotal position and has no S-23 page |
| **PD-6** | **Creating a user is part of the GUI, with a one-time password (plus an optional e-mail link)** instead of a mail-only invitation. The screen also gains *Sospendi/Riattiva* and a password reset that returns a fresh one-time password | The owner operates the site alone and has no Supabase console workflow: a plain "send an invitation e-mail" needed a hosted mailer and produced 2-per-hour limits during testing. A password generated in the database and shown once gets a new colleague working in seconds, and the e-mail option stays available when SMTP is configured | Supersedes the "the Admin never sees or sets a password" rule of S-19; the mockup page 07 still shows the pre-PD-6 grid |
| **PD-3** | Report 1 keeps the flat list but **regains a subtotal row per rootstock** ("Totale per portainnesto", bold, tinted) and **drops the «Da spedire» column**; Tipologia and Produzione become **mandatory** filters with defaults | The office asked for the per-rootstock total back while keeping the filterable list; «Da spedire» duplicated a derived value and now has its own report; the two dimensions are not shown in the table, so they cannot be left ambiguous | Supersedes part of PD-1 |
| **PD-5** | **Anagrafica vite is no longer grouped by variety**: it is a flat list with a searchable **Varietà** filter (plus a clone search) | With 4 786 pairs the group headers made the screen long and hard to scan; a filter answers "show me this variety's clones" in one step, and the variety stays visible as a column | Supersedes the grouped layout of S-16 |
| **PD-4** | Report 2 **drops «Non attribuito» e «Totale produttori»**; every commitment is placed against a lot (the order form requires it) | Business rule: a record in stock always has a producer — a member or *Esterno* — so an unattributed bucket is a data error, not a column. The report warns if such data ever appears | Supersedes the PD-2 column set |
| **PD-2** | **Report 2 follows PD-1**: flat list, no rootstock grouping or subtotals, and two new filters — **Codice portainnesto** and **Produttore** | One consistent, filterable table shape across both reports; the grower filter answers "show me this grower's rows" in one choice and highlights the column instead of hiding the context | Supersedes the grouped/modified requirement for the per-grower report. Requirement R11 (role restriction) is unchanged |
| **PD-1** | **Report 1 is no longer grouped by rootstock**: the rootstock is a filter and a column, and the only aggregate is the grand total | One flat list reads better on a phone and lets the office isolate a single rootstock in one tap instead of scrolling to its group; the per-grower report keeps the grouped/subtotal layout | Supersedes requirement R9's grouping/subtotal rule for Report 1. R10 (red negative rows) still holds. Report 2 is unchanged |

---

## 16. Appendix

### 16.1 Screen inventory → mockup map

| Screen | Title (UI) | Mockup page | Frame label |
|---|---|---|---|
| S-01 | Accedi | 01 · Accesso e home (mobile) | `S-01` |
| S-02 | Home (mobile) | 01 | `S-02` |
| S-20 | Profilo e impostazioni | 01 | `S-20` |
| S-03 | Home (desktop) | 02 · Home e riepiloghi (desktop + mobile) | `S-03` |
| S-04 | Riepilogo disponibilità (mobile) | 02 | `S-04` |
| S-06 | Riepilogo per produttore (mobile) | 02 | `S-06` |
| S-08 | Indisponibilità (mobile) | 03 · Riepiloghi mobile | `S-08` |
| S-10 | Filtri | 03 | `S-10` |
| S-11 | Dettaglio riga | 03 | `S-11` |
| S-12 | Esporta e condividi | 03 | `S-12` |
| S-05 | Riepilogo disponibilità (desktop) | 04 · Riepiloghi desktop | `S-05` |
| S-07 | Riepilogo per produttore (desktop) | 04 | `S-07` |
| S-09 | Indisponibilità (desktop) | 04 | `S-09` |
| S-13 | Lotti magazzino | 05 · Inserimento dati | `S-13` |
| S-13L | Blocco PC-only | 05 | `S-13L` |
| S-14 | Ordini e impegni | 05 | `S-14` |
| S-15 | Import Excel | 06 · Import e anagrafiche | `S-15` |
| S-16 | Anagrafica vite | 06 | `S-16` |
| S-17 | Anagrafica portainnesto | 06 | `S-17` |
| S-18 | Form builder | 07 · Amministrazione | `S-18` |
| S-19 | Utenti e ruoli | 07 | `S-19` |
| M-01…M-05 | Overlay e stati | 08 · Overlay e stati | `M-0n` |

### 16.2 Mockup pages (10 pages, 2 239 shapes)

| Page | Name in the file | Frames |
|---|---|---|
| 00 | `00 · Architettura, ruoli e permessi` | 4 role cards, permission matrix, responsive strategy, design principles |
| 01 | `01 · Accesso e home (mobile)` | S-01, S-02, S-20 |
| 02 | `02 · Home desktop e riepiloghi mobile` | S-03 (desktop), S-04, S-06 |
| 03 | `03 · Riepiloghi mobile e overlay` | S-08, S-10, S-11 (sheet), S-12 (sheet) |
| 04 | `04 · Riepiloghi desktop` | S-05, S-09, S-07 (wide, 16 columns) |
| 05 | `05 · Inserimento dati (solo PC)` | S-13, S-14, S-13L |
| 06 | `06 · Import e anagrafiche` | S-15, S-16, S-17 |
| 07 | `07 · Amministrazione` | S-18, S-19 |
| 08 | `08 · Overlay e stati` | M-01, M-03, M-05, plus empty / negative / offline / error state cards |
| 09 | `09 · Design system` | colour + type tokens, report card, grid row kinds, controls |

Regenerate with `python3 docs/mockups/build_mockup.py` (asserts XML well-formedness on build). The file is uncompressed multi-page draw.io XML, so it opens in app.diagrams.net, the draw.io desktop app, or the VS Code draw.io extension, and each page can be exported to PNG/PDF independently.

### 16.3 What the delivered schema changed in this specification

The first draft assumed a generic shape (dates, customers, free-text dimensions). The dump in `docs/db-schema.sql` corrected it; the deltas are worth knowing because they are the parts a reviewer is most likely to query:

| Assumption removed | Reality | Where fixed |
|---|---|---|
| A `data` column on lots and orders | `anno_conferimento` (lots only) + `created_at` | §3.1, §3.4, S-13, S-15 |
| A customer/reference on orders | `id_magazzino` link to a lot; no customer field at all | §3.1, S-14, Q14 |
| `data_spedizione` | `spedito` boolean only | §3.4, F-V7, S-14 |
| Master-data tables for tipologia/produzione | Fixed `CHECK` enumerations (4 + 3 values) | §3.2, S-13, S-14 |
| A separate clone table with descriptions | `anagrafica_vite` = one row per (variety, clone) pair | §3.1, S-16 |
| Descriptions on portainnesti | Code only | §3.1, S-17 |
| Decimals on quantities | `quantita integer` | §3.5, §13, S-13 |
| A growers table | Free text, nullable → "Non attribuito" bucket | §3.3, §3.6, Report 2 |

### 16.3 Glossary

| Italian (UI / schema) | English |
|---|---|
| Lotto (magazzino) | Warehouse lot / batch — a quantity delivered into stock |
| Ordine / Impegno | Order / commitment of stock against future availability |
| Disponibilità | Availability = magazzino − ordinato |
| Indisponibilità / Deficit | Shortage — orders exceeding stock |
| Produttore | Grower (one of the 8 members) |
| Tipologia | Product type |
| Produzione | Production method (e.g. potted, bare-root) |
| Codice varietà | Variety code (`anagrafica_vite`) |
| Codice clone | Clone code (child of a variety) |
| Codice portainnesto | Rootstock code (`anagrafica_portainnesto`) |
| Spedito | Shipped (`spedito = TRUE`) |
| Riepilogo portainnesto | Rootstock subtotal row |
| Anagrafica | Master data |
| Form builder / Schermata | The Admin's form and screen editor |


