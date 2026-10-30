# Changelog

All notable changes to Vignero. Newest first. Each entry names the fix and what
it changes for the user.

## v1.0.1 — 2026-10-30

Three changes on top of v1.0.0: the linked lot can be detached and saved as
`NULL`; the availability report can show **Ripiantate** and **Frigoconservate**;
those two columns stay hidden until the **«Aggiungi altro»** button is pressed.

Rollback: `git checkout v1.0.1`, or redeploy it with
`git push origin v1.0.1:main --force-with-lease`.

## v1.0.0 — 2026-10-30

First release in production at <https://vititalia.github.io/> (repository
`Vititalia/Vititalia.github.io`, published from `main`). Signed off by the
owner: real login, real database, data entry from the app, reports reviewed with
the office.

Rollback: `git checkout v1.0.0` to inspect, or redeploy it with
`git push origin v1.0.0:main --force-with-lease` (Pages rebuilds in ~1 minute).
The procedure is also in the README, under *Releases*.

## 4. «Messo a disposizione» — the producer's own three quantities

The producer report now shows **Messo a disposizione** (the quantity that entered
the warehouse from their lots), **Spedito** (what left through the shipped
commitments on those lots) and **A magazzino** (the difference between the two,
red when negative). The previous Magazzino / Ordinato / Di cui spedito /
Disponibilità set answered a different question; these three are the ones the
producer actually reconciles.

## 6. Ordini e impegni — search box

The orders list gains the same search field as the lots screen: it matches
produttore (of the linked lot), varietà, clone, portainnesto, tipologia,
produzione, year and note text, and it filters the list in place.

## 7. Ordini e impegni sorted by varietà → clone → portainnesto → produttore

Same reading order as the lots screen: variety first, then clone, then rootstock,
then the producer of the linked lot (orders without a lot come last).

## 10. Exports follow one column order: Tipologia; Produzione; Varietà; Clone; Portainnesto

Every CSV now opens with the same five dimension columns, then its measures —
including the per-grower report (which also gains tipologia and produzione) and
the producer report. The variety/clone pair is no longer inverted anywhere, and
subtotal lines carry tipologia, produzione and varietà too, so a spreadsheet
pivot works without renaming anything.

## 11. Quantities always show the dot as thousands separator

`1.234` instead of `1234`: the formatting helper now groups by hand, because the
Italian CLDR rules deliberately leave four-digit numbers ungrouped. It applies to
every table, card, subtotal and toast (report cells, lots, orders, anagrafiche,
KPIs). Negative values keep the leading `−` (`−1.234`).

## 18. The two columns are behind «Aggiungi altro»

A new **«Aggiungi altro»** button in the report header opens *Ripiantate* and
*Frigoconservate*; until it is pressed the availability table stays at its six
columns. The button lights up when active, the choice is remembered in the
browser (like the cards/table switch), and the CSV export follows it — with the
columns open the file carries them too. Works the same on a phone.

## 17. Disponibilità gains «Ripiantate» and «Frigoconservate»

After Disponibilità the table now carries the warehouse quantity of the same
clone + rootstock held with `produzione = 'Ripiantato'` and
`produzione = 'Frigoconservato'` — the two other production modes of the same
plant. The values are attached to the combination, so they repeat on each row of
it, and both the subtotals and the grand total sum them. Exports include the two
columns.

## 16. An order can be saved with no lot at all

The lot picker offers **«— Nessun lotto —»** as its first choice and the form has a
**«Nessun lotto»** button that detaches the current one, keeping the dimensions
already filled. A line under the picker states what is linked («Collegato: Donati ·
2026 · CHARDONNAY B. · 95» or «Nessun lotto collegato»), and the order saves with
`id_magazzino = NULL`.

## 15. Three links removed

* **«Ripristina gli utenti dimostrativi»** (Utenti) — gone, together with its
  confirmation sheet; the demo registry is still reset by the test suite through
  `auth.resetRegistry()`.
* **«Specifica»** and **«Mockup»** (Profilo) — gone; both files stay in the
  repository under `docs/` for whoever needs them.

The now-unused `profilo.docs` capability is removed from the permission table, so
the in-app matrix lists exactly what the app offers.

## 14. The search boxes keep the caret while the list refreshes

Writing in «Cerca» (lotti, ordini, anagrafiche) or «Cerca codice» (portainnesti)
no longer loses the cursor: the debounced refresh re-renders the list and then
puts the focus back into the same field at the same position, so typing just
continues. Verified in a real browser (typing `CH` then `A` gives `CHA`).

## 13. Variety and rootstock filters work for produttore and vendite

Those roles cannot read the anagrafiche (RLS), so the filter comboboxes opened
empty and the reports looked unfilterable. The master-data index is now built
from the aggregate rows the view already returns — the codes that actually
appear — so both comboboxes fill and the filter applies. «Mancanze» also gained
the rootstock filter it was missing. Verified live as produttore and vendite.

## 12. Nuovo impegno shows the residual value before saving

Above the save button the form now shows two figures — **Disponibilità attuale**
and **Residuo dopo il salvataggio** — updated as the operator types, in place of
the old warning that appeared only once the value went negative. When the
residual is negative the warning stays, with the before → after pair.

Editing an existing order no longer double-counts it: the previous quantity is
added back before the subtraction.

## 9. The linked lot is optional on an order

«Nuovo impegno» no longer requires a lot: the label lost «(obbligatorio)», the
form and the CSV import accept a row without `id_magazzino`, and the info banner
explains the consequence (the quantity simply stays out of the per-grower
columns). The per-grower report keeps warning when such rows exist.

## 8. Lotti magazzino sorted by varietà → clone → portainnesto → produttore

The list no longer opens in reverse insertion order: it is ordered the way the
office reads it — by variety, then clone, then rootstock, then grower (newest
year first inside the same pair). The search box also matches the note text.

## 5. «Totale per portainnesto» never mixes varieties

The subtotal row is now keyed by **tipologia + produzione + varietà +
portainnesto**, in the availability report, «Mancanze», the per-grower report and
the producer's «Messo a disposizione». Before, a rootstock shared by several
varieties showed one subtotal that summed them all, which never reconciled with
the rows above it. Rows are sorted rootstock → **varietà** → clone so each group
stays contiguous, and the subtotal line repeats the variety under the label.

Exports carry the same subtotal lines in the same order.

## 3. «Indisponibilità» is now «Mancanze»

Menu, page title, mobile tab, panorama tile and the Panoramica KPI («In
mancanze») use the new name; the subtitle still reads «combinazioni in deficit»,
and the exported file is `mancanze_<timestamp>.csv`. The URL
(`#/r/indisponibilita`), the capability key and the content are untouched.

## 2. Lotti magazzino — the note is visible in the table

The lot grid gains a **Note** column (wrapped, full text, `—` when empty), so the
delivery note no longer requires opening the edit form.

## 1. Anagrafica vite — varietà before clone

The table and every export now list **Codice varietà** first and **Codice clone**
second, matching the order used everywhere else in the app. Reading a pair no
longer means jumping right-to-left.

