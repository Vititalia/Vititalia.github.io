# Changelog

All notable changes to Vignero. Newest first. Each entry names the fix and what
it changes for the user.

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

