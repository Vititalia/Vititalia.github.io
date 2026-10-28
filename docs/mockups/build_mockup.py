#!/usr/bin/env python3
"""
Generates docs/mockups/fede-magazzino-mockup.drawio

A page-per-flow wireframe set for the Fede Magazzino GUI specification
(docs/01-gui-specification.md). Frames are hand-placed: this is a UI mockup,
not a flow diagram, so no auto-layout is used.

Run:  python3 build_mockup.py
"""

import html
import os

# --------------------------------------------------------------------------
# palette (identical to spec §6.1)
# --------------------------------------------------------------------------
INK900 = "#0F172A"
INK700 = "#334155"
INK500 = "#64748B"
INK300 = "#CBD5E1"
LINE = "#E2E8F0"
SURF = "#FFFFFF"
CANVAS = "#F6F8FA"
ZEBRA = "#FBFCFD"
B700 = "#175E43"
B600 = "#1E6B4F"
B500 = "#2A8A63"
B50 = "#E9F5EF"
OK = "#16A34A"
OK50 = "#ECFDF5"
WARN = "#D97706"
WARN50 = "#FFFBEB"
D700 = "#B91C1C"
D600 = "#DC2626"
D50 = "#FEF2F2"
INFO = "#0891B2"
INFO50 = "#ECFEFF"
NONE = "none"


def esc(value):
    return html.escape(str(value), quote=True)


def style(fill=SURF, stroke=LINE, sw=1, fc=INK900, fs=13, bold=False,
          align="center", valign="middle", mono=False, rnd=False, dash=False,
          opacity=None, extra=""):
    parts = [
        "rounded=%d" % (1 if rnd else 0),
        "whiteSpace=wrap",
        "html=1",
        "fillColor=%s" % fill,
        "strokeColor=%s" % stroke,
        "strokeWidth=%s" % sw,
        "fontSize=%s" % fs,
        "fontColor=%s" % fc,
        "align=%s" % align,
        "verticalAlign=%s" % valign,
    ]
    if bold:
        parts.append("fontStyle=1")
    if mono:
        parts.append("fontFamily=Courier New")
    if dash:
        parts.append("dashed=1")
    if opacity is not None:
        parts.append("opacity=%s" % opacity)
    if extra:
        parts.append(extra)
    return ";".join(parts) + ";"


class Page(object):
    def __init__(self, pid, name, width, height):
        self.pid = pid
        self.name = name
        self.width = width
        self.height = height
        self.cells = []
        self._n = 0

    # -- primitives --------------------------------------------------------
    def _id(self, prefix):
        self._n += 1
        return "%s_%s%d" % (self.pid, prefix, self._n)

    def box(self, x, y, w, h, fill=SURF, stroke=LINE, sw=1, text="", fs=13,
            fc=INK900, bold=False, align="center", valign="middle", mono=False,
            rnd=False, dash=False, opacity=None, extra=""):
        cid = self._id("b")
        st = style(fill, stroke, sw, fc, fs, bold, align, valign, mono, rnd,
                   dash, opacity, extra)
        self.cells.append(
            '<mxCell id="%s" value="%s" style="%s" vertex="1" parent="1">'
            '<mxGeometry x="%s" y="%s" width="%s" height="%s" as="geometry"/>'
            "</mxCell>" % (cid, esc(text), st, round(x, 1), round(y, 1),
                           round(w, 1), round(h, 1)))
        return cid

    def text(self, x, y, w, h, text, fs=12, fc=INK500, bold=False,
             align="left", valign="middle", mono=False, rnd=False):
        return self.box(x, y, w, h, fill=NONE, stroke=NONE, sw=0, text=text,
                        fs=fs, fc=fc, bold=bold, align=align, valign=valign,
                        mono=mono)

    def pill(self, x, y, w, h, text, fill=B50, fc=B600, fs=10, bold=True,
             stroke=NONE):
        return self.box(x, y, w, h, fill=fill, stroke=stroke, text=text, fs=fs,
                        fc=fc, bold=bold, rnd=True)

    def hr(self, x, y, w, color=LINE, sw=1, dash=False):
        return self.box(x, y, w, 0, fill=NONE, stroke=color, sw=sw, dash=dash)

    # -- serialisation -----------------------------------------------------
    def xml(self):
        return (
            '<diagram id="%s" name="%s"><mxGraphModel dx="%d" dy="%d" '
            'grid="0" gridSize="10" guides="0" tooltips="1" connect="0" '
            'arrows="0" fold="0" page="1" pageScale="1" pageWidth="%d" '
            'pageHeight="%d" math="0" shadow="0"><root>'
            '<mxCell id="0"/><mxCell id="1" parent="0"/>%s'
            "</root></mxGraphModel></diagram>"
            % (self.pid, esc(self.name), self.width, self.height, self.width,
               self.height, "".join(self.cells)))


# --------------------------------------------------------------------------
# page furniture
# --------------------------------------------------------------------------
def page_title(pg, title, subtitle):
    pg.text(40, 34, 1400, 34, title, fs=24, fc=INK900, bold=True)
    pg.text(40, 70, max(400, pg.width - 80), 24, subtitle, fs=13, fc=INK500)


def caption(pg, x, y, w, sid, title, lines):
    pg.box(x, y, w, 26, fill=B50, stroke=NONE, text="%s · %s" % (sid, title),
           fs=11, fc=B600, bold=True, align="left", extra="spacingLeft=8")
    pg.text(x + 4, y + 30, w - 4, 60, lines, fs=10, fc=INK500, valign="top")


# --------------------------------------------------------------------------
# phone frame
# --------------------------------------------------------------------------
def phone(pg, x, y, sid, title, role, tabs, active, content_fn, scroll_hint=None):
    """Draws a 390x844 phone with app bar + tab bar, then calls content_fn."""
    w, h = 390, 844
    pg.box(x, y, w, h, fill=SURF, stroke="#94A3B8", sw=2, rnd=True)
    # status bar
    pg.text(x + 18, y + 10, 90, 16, "9:41", fs=10, fc=INK900, bold=True)
    pg.text(x + 250, y + 10, 122, 16, "5G  ▮▮▮  100%", fs=10, fc=INK500,
            align="right")
    # app bar
    pg.box(x, y + 34, w, 56, fill=B700, stroke=NONE)
    pg.text(x + 16, y + 34, 200, 56, title, fs=16, fc="#FFFFFF", bold=True)
    pg.pill(x + w - 16 - 78, y + 34 + 17, 78, 22, role, fill=B500, fc="#FFFFFF")
    # content origin
    X, Y, W = x + 16, y + 98, w - 32
    content_fn(pg, X, Y, W)
    # tab bar
    ty = y + h - 68
    pg.box(x, ty, w, 68, fill=SURF, stroke=LINE, sw=1)
    n = len(tabs)
    if not n:
        pg.box(x + w / 2 - 60, y + h - 12, 120, 4, fill=INK300, stroke=NONE, rnd=True)
        return
    tw = w / float(n)
    for i, label in enumerate(tabs):
        on = (i == active)
        pg.text(x + i * tw, ty + 14, tw, 30, label, fs=10,
                fc=(B600 if on else INK500), bold=on, align="center")
        if on:
            pg.box(x + i * tw + tw / 2 - 14, ty + 2, 28, 3, fill=B600,
                   stroke=NONE, rnd=True)
    # home indicator
    pg.box(x + w / 2 - 60, y + h - 12, 120, 4, fill=INK300, stroke=NONE,
           rnd=True)
    if scroll_hint:
        pg.text(x, y + h - 92, w - 12, 18, scroll_hint, fs=9, fc=INK300,
                align="right")


def sheet(pg, x, y, top, sid_label, title, body_fn, height=470):
    """Bottom sheet rendered over a phone: scrim + panel + handle."""
    w = 390
    pg.box(x, y + top, w, (776 - top), fill=INK900, stroke=NONE, opacity=12)
    pg.box(x, y + top, w, height, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.box(x + w / 2 - 22, y + top + 8, 44, 4, fill=INK300, stroke=NONE,
           rnd=True)
    pg.text(x + 16, y + top + 18, 240, 24, title, fs=15, fc=INK900, bold=True)
    pg.text(x + w - 56, y + top + 18, 40, 24, "✕", fs=15, fc=INK500,
            align="right")
    body_fn(pg, x + 16, y + top + 52, w - 32)


# --------------------------------------------------------------------------
# desktop frame
# --------------------------------------------------------------------------
NAV = [
    ("Panoramica", 0),
    ("RIEPILOGHI", None),
    ("Disponibilità", 1),
    ("Per produttore", 1),
    ("Indisponibilità", 1),
    ("DATI", None),
    ("Lotti magazzino", 2),
    ("Ordini e impegni", 2),
    ("Importa Excel", 2),
    ("ANAGRAFICHE", None),
    ("Vite", 3),
    ("Portainnesti", 3),
    ("CONFIGURAZIONE", None),
    ("Form builder", 4),
    ("Utenti e ruoli", 4),
]


def desktop(pg, x, y, w, h, url, title, crumb, role, active_nav,
            content_fn, dim_config=False):
    """Browser window + sidebar + top bar. Returns content origin (X, Y, W, H)."""
    pg.box(x, y, w, h, fill=CANVAS, stroke="#94A3B8", sw=2, rnd=True)
    # window chrome
    pg.box(x, y, w, 34, fill="#E8EDF1", stroke=LINE, sw=1)
    for i, col in enumerate([D600, WARN, OK]):
        pg.box(x + 14 + i * 16, y + 12, 10, 10, fill=col, stroke=NONE, rnd=True)
    pg.box(x + 80, y + 6, w - 160, 22, fill=SURF, stroke=LINE, sw=1,
           text="app.fedemagazzino.it" + url, fs=10, fc=INK500, rnd=True)
    # sidebar
    sw_ = 220
    pg.box(x, y + 34, sw_, h - 34, fill=SURF, stroke=LINE, sw=1)
    pg.box(x + 16, y + 50, 26, 26, fill=B600, stroke=NONE, rnd=True,
           text="F", fs=13, fc="#FFFFFF", bold=True)
    pg.text(x + 50, y + 50, 160, 26, "Fede Magazzino", fs=12, fc=INK900,
            bold=True)
    iy = y + 92
    for label, grp in NAV:
        if grp is None:
            pg.text(x + 16, iy, 190, 22, label, fs=9, fc=INK500, bold=True)
            iy += 20
            continue
        if dim_config and label in ("Form builder", "Utenti e ruoli"):
            iy += 27
            continue
        if label == title_nav(active_nav):
            pg.box(x + 8, iy - 3, sw_ - 16, 27, fill=B50, stroke=NONE, rnd=True)
            pg.text(x + 20, iy, 180, 22, label, fs=12, fc=B600, bold=True)
        else:
            pg.text(x + 20, iy, 180, 22, label, fs=12, fc=INK700)
        iy += 27
    # top bar
    tx = x + sw_
    tw = w - sw_
    pg.box(tx, y + 34, tw, 58, fill=SURF, stroke=LINE, sw=1)
    pg.text(tx + 20, y + 40, tw - 320, 20, crumb, fs=10, fc=INK500)
    pg.text(tx + 20, y + 56, tw - 320, 26, title, fs=17, fc=INK900, bold=True)
    pg.pill(x + w - 130, y + 49, 74, 24, role, fill=B50, fc=B600)
    pg.box(x + w - 48, y + 49, 26, 24, fill=CANVAS, stroke=LINE, sw=1,
           text="IO", fs=9, fc=INK700, rnd=True)
    X, Y, W, H = tx + 20, y + 104, tw - 40, h - 104
    content_fn(pg, X, Y, W, H)
    return (X, Y, W, H)


def title_nav(active_nav):
    """NAV label of the active index (used for highlighting)."""
    return {
        0: "Panoramica",
        1: "Disponibilità",
        2: "Lotti magazzino",
        3: "Vite",
        4: "Form builder",
    }.get(active_nav, "")


# --------------------------------------------------------------------------
# reusable UI widgets
# --------------------------------------------------------------------------
def table(pg, x, y, widths, headers, rows, row_h=30, head_h=34, align=None,
          fs=12):
    """rows: list of dict(cells=[...], kind=''|'zebra'|'subtotal'|'negative'|'total')"""
    if align is None:
        align = ["left"] * len(widths)
    total_w = sum(widths)
    # header
    cx = x
    for i, head in enumerate(headers):
        pg.box(cx, y, widths[i], head_h, fill=CANVAS, stroke=LINE, sw=1,
               text=head, fs=10, fc=INK900, bold=True, align=align[i],
               extra="spacingLeft=8;spacingRight=8")
        cx += widths[i]
    pg.box(x, y, total_w, head_h, fill=NONE, stroke=LINE, sw=1)
    ry = y + head_h
    for row in rows:
        kind = row.get("kind", "")
        fill, fc, bold, sw = SURF, INK700, False, 1
        if kind == "zebra":
            fill = ZEBRA
        elif kind == "subtotal":
            fill, fc, bold, sw = B50, INK900, True, 1
        elif kind == "negative":
            fill, fc, bold = D50, D700, True
        elif kind == "total":
            fill, fc, bold = B50, INK900, True
        cx = x
        for i, val in enumerate(row["cells"]):
            extra = "spacingLeft=8;spacingRight=8"
            if kind == "negative" and i == 0:
                extra += ";strokeColor=%s;strokeWidth=0;fillColor=%s" % (D600, D50)
            if kind == "subtotal" and i == 0:
                extra += ""
            pg.box(cx, ry, widths[i], row_h, fill=fill, stroke=LINE, sw=sw,
                   text=val, fs=fs, fc=fc, bold=bold, align=align[i],
                   extra=extra)
            cx += widths[i]
        if kind == "negative":
            pg.box(x, ry, 3, row_h, fill=D600, stroke=NONE)
        if kind == "subtotal":
            pg.box(x, ry, total_w, 1.5, fill=INK300, stroke=NONE)
        ry += row_h
    pg.box(x, y, total_w, ry - y, fill=NONE, stroke=LINE, sw=1)
    return ry


def filter_bar(pg, x, y, w, labels, compact=False, show_reset=True):
    """Single-select filter row: three selects + outlined reset button."""
    n = len(labels)
    reset_w = 74 if show_reset else 0
    gap = 8
    cw = (w - reset_w - gap * (n + (1 if show_reset else 0))) / float(n)
    cx = x
    for label in labels:
        pg.box(cx, y, cw, 34, fill=SURF, stroke=INK300, sw=1, text=label,
               fs=10, fc=INK700, bold=False, align="left",
               extra="spacingLeft=8", rnd=True)
        cx += cw + gap
    if show_reset:
        pg.box(cx, y, reset_w, 34, fill=NONE, stroke=B600, sw=1, text="Azzera",
               fs=10, fc=B600, bold=True, rnd=True)
    return y + 34


def chips(pg, x, y, items, w_total=358, h=22):
    cx = x
    for label in items:
        w = 12 + len(label) * 5.4
        if cx + w > x + w_total:
            cx = x
            y += h + 6
        pg.pill(cx, y, w, h, label, fill=B50, fc=B600, fs=9)
        cx += w + 6
    return y + h


def kpi(pg, x, y, w, h, label, value, sub="", tone="neutral"):
    fill, fc, st = SURF, INK900, LINE
    if tone == "danger":
        fill, fc, st = D50, D700, D600
    elif tone == "ok":
        fill, fc, st = OK50, "#15803D", OK
    pg.box(x, y, w, h, fill=fill, stroke=st, sw=1, rnd=True)
    pg.text(x + 12, y + 8, w - 24, 16, label, fs=9, fc=INK500, bold=True)
    pg.text(x + 12, y + 26, w - 24, 24, value, fs=20, fc=fc, bold=True,
            align="left")
    if sub:
        pg.text(x + 12, y + h - 20, w - 24, 14, sub, fs=9, fc=INK500)


def metric_strip(pg, x, y, w, values, negative_idx=None, h=42):
    """4 mini metrics: label above value."""
    n = len(values)
    cw = w / float(n)
    for i, (label, val) in enumerate(values):
        neg = (negative_idx is not None and i == negative_idx)
        fill = D50 if neg else CANVAS
        pg.box(x + i * cw, y, cw - 2, h, fill=fill, stroke=LINE, sw=0.5,
               rnd=True)
        pg.text(x + i * cw, y + 4, cw - 2, 12, label, fs=8, fc=INK500,
                align="center")
        pg.text(x + i * cw, y + 17, cw - 2, 20, val, fs=11,
                fc=(D700 if neg else INK900), bold=neg or i == n - 1,
                align="center")
    return h


def group_card(pg, x, y, w, code, subtotal, rows, negative_subtotal=False):
    """Rootstock group card for mobile report layouts."""
    head_h = 34
    row_h = 50
    h = head_h + len(rows) * row_h + 6
    pg.box(x, y, w, h, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.box(x, y, w, head_h, fill=B50, stroke=LINE, sw=1, rnd=True)
    pg.box(x + 1, y + head_h - 4, w - 2, 4, fill=B50, stroke=NONE)
    pg.text(x + 10, y, 150, head_h, "▦ " + code, fs=12, fc=INK900, bold=True)
    pg.text(x + w - 176, y, 166, head_h,
            "Totale portainnesto  " + subtotal, fs=11,
            fc=(D700 if negative_subtotal else INK900), bold=True,
            align="right")
    ry = y + head_h
    for i, r in enumerate(rows):
        neg = r.get("neg", False)
        if neg:
            pg.box(x, ry, w, row_h, fill=D50, stroke=NONE)
            pg.box(x, ry, 3, row_h, fill=D600, stroke=NONE)
        pg.text(x + 12, ry + 2, w - 24, 18,
                ("⚠ " if neg else "") + r["clone"], fs=11,
                fc=(D700 if neg else INK900), bold=True)
        metric_strip(pg, x + 12, ry + 20, w - 24,
                     [("Magazzino", r["mag"]), ("Ordinato", r["ord"]),
                      ("Spedito", r["spe"]), ("Disponib.", r["disp"])],
                     negative_idx=(3 if neg else None), h=26)
        ry += row_h
    return h


def grower_strip(pg, x, y, w, items, shown=4):
    """Horizontally scrollable per-grower chips (S-06)."""
    cw = 68
    for i, (name, val) in enumerate(items[:shown]):
        neg = val.startswith("\u2212")
        pg.box(x + i * (cw + 4), y, cw, 30,
               fill=(D50 if neg else CANVAS), stroke=LINE, sw=0.5, rnd=True)
        pg.text(x + i * (cw + 4), y + 3, cw, 11, name, fs=7, fc=INK500,
                align="center")
        pg.text(x + i * (cw + 4), y + 14, cw, 14, val, fs=9,
                fc=(D700 if neg else INK900), bold=neg, align="center")
    if len(items) > shown:
        pg.text(x + shown * (cw + 4) - 2, y, 20, 30, "\u203a", fs=14,
                fc=INK500, align="center")
    return 30


# ==========================================================================
# PAGE 00 - architecture, roles, permissions
# ==========================================================================
def page00():
    pg = Page("p00", "00 \u00b7 Architettura, ruoli e permessi", 1740, 1330)
    page_title(
        pg,
        "Fede Magazzino \u2014 architettura dell'interfaccia",
        "Ruoli, permessi e mappa delle schermate. Ogni frame \u00e8 "
        "identificato da S-nn / M-nn come nella specifica "
        "(docs/01-gui-specification.md).")

    roles = [
        ("Amministratore", "admin", B600, B50,
         ["Configura schermate e campi (form builder)",
          "Gestisce anagrafiche, utenti e ruoli",
          "Inserisce lotti e ordini (da PC)",
          "Consulta tutti e tre i riepiloghi"]),
        ("Amministrazione", "ufficio", "#0E7490", INFO50,
         ["Inserimento lotti e ordini (da PC)",
          "Import Excel con validazione",
          "Consulta tutti e tre i riepiloghi",
          "Anagrafiche in sola lettura"]),
        ("Produttore", "produttore", WARN, WARN50,
         ["Sola lettura da smartphone",
          "Riepilogo disponibilit\u00e0",
          "Indisponibilit\u00e0 e deficit",
          "Nessun accesso all'inserimento dati"]),
        ("Vendite", "vendite", "#7C3AED", "#F5F3FF",
         ["Sola lettura da smartphone",
          "Solo riepilogo disponibilit\u00e0",
          "Nessun dato per produttore",
          "Modulo pi\u00f9 ristretto"]),
    ]
    for i, (name, code, col, tint, bullets) in enumerate(roles):
        x = 40 + i * 420
        pg.box(x, 116, 400, 244, fill=SURF, stroke=LINE, sw=1, rnd=True)
        pg.box(x, 116, 400, 42, fill=col, stroke=NONE, rnd=True)
        pg.box(x + 1, 146, 398, 12, fill=col, stroke=NONE)
        pg.text(x + 14, 116, 200, 42, name, fs=14, fc="#FFFFFF", bold=True)
        pg.pill(x + 400 - 96, 126, 84, 22, code, fill="#FFFFFF", fc=col, fs=9)
        pg.text(x + 16, 170, 368, 180,
                "<br>".join("\u2022 " + b for b in bullets), fs=11, fc=INK700,
                valign="top")

    pg.text(40, 382, 600, 24, "Matrice dei permessi", fs=15, fc=INK900,
            bold=True)
    pg.text(40, 404, 900, 20, "L'unica fonte per la navigazione: le voci non "
            "consentite non vengono nascoste soltanto, sono impedite.", fs=10,
            fc=INK500)
    rows = []
    perms = [
        ("Panoramica / Home", "R", "R", "R", "R"),
        ("Riepilogo disponibilit\u00e0", "R", "R", "R", "R"),
        ("Riepilogo per produttore", "R", "R", "\u2014", "\u2014"),
        ("Indisponibilit\u00e0 / deficit", "R", "R", "R", "\u2014"),
        ("Lotti magazzino", "E", "E", "\u2014", "\u2014"),
        ("Ordini e impegni", "E", "E", "\u2014", "\u2014"),
        ("Import Excel", "E", "E", "\u2014", "\u2014"),
        ("Anagrafica vite", "E", "R", "\u2014", "\u2014"),
        ("Anagrafica portainnesto", "E", "R", "\u2014", "\u2014"),
        ("Form builder", "E", "\u2014", "\u2014", "\u2014"),
        ("Utenti e ruoli", "E", "\u2014", "\u2014", "\u2014"),
    ]
    for i, p in enumerate(perms):
        rows.append({"cells": list(p),
                     "kind": ("zebra" if i % 2 else "")})
    table(pg, 40, 430, [400, 190, 190, 190, 190],
          ["Capacit\u00e0 / schermata", "Amministratore", "Amministrazione",
           "Produttore", "Vendite"],
          rows, row_h=30, head_h=34,
          align=["left", "center", "center", "center", "center"])

    pg.text(40, 850, 900, 22, "Strategia responsive", fs=15, fc=INK900,
            bold=True)
    pg.text(40, 872, 1200, 20, "Stesso insieme di dati, tre presentazioni. I "
            "riepiloghi sono responsive; l'inserimento dati \u00e8 solo da PC.",
            fs=10, fc=INK500)
    strat = [
        ("xs \u00b7 320\u2013639 \u00b7 smartphone",
         "Raggruppamento per portainnesto: una card per gruppo, una riga per "
         "clone, striscia di 4 metriche. Sottototali nell'intestazione della "
         "card. Nessuno scorrimento orizzontale.", "S-04 \u00b7 S-06 \u00b7 S-08"),
        ("sm/md \u00b7 640\u20131023 \u00b7 tablet",
         "Stessa struttura a gruppi, elenco chiave/valore a due colonne, "
         "barra filtri su due righe. Le card diventano tabelle a partire da "
         "1024 dp.", "S-04 \u00b7 S-05"),
        ("md/lg+ \u00b7 \u22651024 \u00b7 PC",
         "Griglia dati vera: intestazione fissa, numeri allineati a destra, "
         "righe di subtotale evidenziate, righe negative in rosso grassetto. "
         "Solo qui l'inserimento dati.", "S-05 \u00b7 S-07 \u00b7 S-13"),
    ]
    for i, (head, body, ref) in enumerate(strat):
        x = 40 + i * 570
        pg.box(x, 900, 550, 210, fill=SURF, stroke=LINE, sw=1, rnd=True)
        pg.box(x, 900, 550, 34, fill=B50, stroke=NONE, rnd=True)
        pg.text(x + 14, 900, 520, 34, head, fs=11, fc=B600, bold=True)
        pg.text(x + 14, 942, 522, 120, body, fs=10, fc=INK700, valign="top")
        pg.pill(x + 14, 1074, 150, 22, ref, fill=CANVAS, fc=INK500, fs=9)

    pg.text(40, 1140, 900, 22, "Principi di progetto", fs=15, fc=INK900,
            bold=True)
    princ = ("1. Il numero \u00e8 l'interfaccia.   2. Il rosso significa solo "
             "sovra-impegnato.   3. Un subtotale \u00e8 una promessa: "
             "\u00abTotale portainnesto\u00bb sempre in grassetto su fondo "
             "tinto.   4. Prima filtra, poi leggi.   5. Un telefono non finge "
             "di essere una postazione: l'editing \u00e8 negato, non "
             "approssimato.   6. L'anagrafica \u00e8 l'unico vocabolario: mai "
             "testo libero per variet\u00e0, clone, portainnesto.")
    pg.box(40, 1166, 1660, 74, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(56, 1176, 1628, 54, princ, fs=11, fc=INK700, valign="top")
    return pg


# ==========================================================================
# PAGE 01 - access + home (mobile)
# ==========================================================================
TABS_4 = ["Home", "Riepiloghi", "Indisponib.", "Profilo"]
TABS_3 = ["Home", "Riepiloghi", "Profilo"]


def s01_content(pg, X, Y, W):
    pg.box(X + W / 2 - 34, Y + 6, 68, 68, fill=B600, stroke=NONE, rnd=True,
           text="F", fs=30, fc="#FFFFFF", bold=True)
    pg.text(X, Y + 82, W, 22, "Accedi al tuo magazzino", fs=17, fc=INK900,
            bold=True, align="center")
    pg.text(X, Y + 106, W, 18, "Barbatelle, portainnesti e disponibilit\u00e0",
            fs=11, fc=INK500, align="center")

    y = Y + 144
    pg.text(X, y, W, 16, "Email", fs=10, fc=INK700, bold=True)
    pg.box(X, y + 18, W, 44, fill=SURF, stroke=INK300, text="giulia@vivaio.it",
           fs=12, fc=INK700, align="left", extra="spacingLeft=12", rnd=True)
    y += 74
    pg.text(X, y, W, 16, "Password", fs=10, fc=INK700, bold=True)
    pg.box(X, y + 18, W, 44, fill=SURF, stroke=INK300,
           text="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
           fs=14, fc=INK700, align="left", extra="spacingLeft=12", rnd=True)
    pg.text(X + W - 46, y + 18, 38, 44, "\u25c9", fs=13, fc=INK500,
            align="center")
    y += 78
    pg.text(X, y, W - 60, 24, "Ricordami su questo dispositivo", fs=11,
            fc=INK700)
    pg.box(X + W - 48, y + 2, 44, 22, fill=B600, stroke=NONE, rnd=True)
    pg.box(X + W - 24, y + 4, 18, 18, fill="#FFFFFF", stroke=NONE, rnd=True)
    y += 40
    pg.box(X, y, W, 48, fill=B600, stroke=NONE, text="Accedi", fs=14,
           fc="#FFFFFF", bold=True, rnd=True)
    y += 62
    pg.text(X, y, W, 20, "Password dimenticata?", fs=11, fc=B600, bold=True,
            align="center")
    y += 44
    pg.box(X, y, W, 74, fill=INFO50, stroke=INFO, sw=1, rnd=True)
    pg.text(X + 12, y + 8, W - 24, 58,
            "Accesso riservato ai soci e all'ufficio.\nI profili Produttore e "
            "Vendite hanno accesso in sola lettura ai riepiloghi.", fs=10,
            fc="#0E7490", valign="top")
    pg.text(X, Y + 630, W, 18, "v1.0.0 \u00b7 ambiente produzione", fs=9,
            fc=INK300, align="center")


def s02_content(pg, X, Y, W):
    pg.text(X, Y, W, 20, "Ciao, Giulia", fs=16, fc=INK900, bold=True)
    pg.text(X, Y + 20, W, 16, "Profilo Vendite \u00b7 sola lettura", fs=10,
            fc=INK500)
    y = Y + 46
    cw = (W - 12) / 2.0
    kpi(pg, X, y, cw, 76, "DISPONIBILIT\u00c0 TOTALE", "12.340",
        "piante \u00b7 aggiornato 14:32")
    kpi(pg, X + cw + 12, y, cw, 76, "IN INDISPONIBILIT\u00c0", "7",
        "articoli in deficit", tone="danger")
    kpi(pg, X, y + 88, cw, 76, "LOTTI QUESTO MESE", "1.284", "ottobre 2026")
    kpi(pg, X + cw + 12, y + 88, cw, 76, "ORDINI NON SPEDITI", "23",
        "da evadere", tone="ok")
    y += 180
    pg.text(X, y, W, 20, "Riepiloghi", fs=12, fc=INK900, bold=True)
    y += 24
    pg.box(X, y, W, 50, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.text(X + 14, y, W - 60, 50, "Riepilogo disponibilit\u00e0", fs=12,
            fc=INK900, bold=True)
    pg.text(X + W - 34, y, 24, 50, "\u203a", fs=16, fc=INK500)
    y += 60
    pg.text(X, y, W, 20, "Accessi rapidi", fs=12, fc=INK900, bold=True)
    y += 24
    chips(pg, X, y, ["Barbatelle \u00b7 Vaso \u00b7 CH-01", "CH-02"],
          w_total=W)
    y += 60
    pg.box(X, y, W, 72, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(X + 14, y + 8, W - 28, 56,
            "Il tuo profilo vede solo il riepilogo disponibilit\u00e0.\n"
            "Per produttore e Indisponibilit\u00e0 non sono disponibili per "
            "Vendite.", fs=10, fc=INK500, valign="top")
    pg.text(X, y + 86, W, 16, "nessun inserimento dati per questo profilo",
            fs=9, fc=INK300, align="center")


def s20_content(pg, X, Y, W):
    pg.box(X, Y, W, 92, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.box(X + 14, Y + 18, 56, 56, fill=B50, stroke=NONE, rnd=True, text="MR",
           fs=16, fc=B600, bold=True)
    pg.text(X + 82, Y + 18, W - 96, 20, "Marco Rossi", fs=14, fc=INK900,
            bold=True)
    pg.text(X + 82, Y + 38, W - 96, 16, "marco@vivaio.it", fs=10, fc=INK500)
    pg.pill(X + 82, Y + 56, 108, 20, "Produttore \u00b7 Mori", fill=B50,
            fc=B600, fs=9)
    y = Y + 104

    def group(title, rows):
        y_local = group.y
        pg.text(X, y_local, W, 18, title, fs=10, fc=INK500, bold=True)
        y_local += 20
        for label, value, danger in rows:
            pg.box(X, y_local, W, 44, fill=SURF, stroke=LINE, sw=1)
            pg.text(X + 12, y_local, W - 130, 44, label, fs=11,
                    fc=(D600 if danger else INK700), bold=danger)
            pg.text(X + W - 126, y_local, 114, 44, value, fs=10,
                    fc=(D600 if danger else INK500), align="right")
            y_local += 44
        group.y = y_local + 14

    group.y = y
    group("ACCOUNT", [("Dati personali", "sola lettura", False),
                      ("Cambia password", "Invia link", False)])
    group("PREFERENZE", [("Unit\u00e0 di misura", "Piante", False),
                         ("Dimensione testo elenchi", "Normale", False)])
    group("SESSIONE", [("Disconnetti", "", True)])
    group("INFORMAZIONI", [("Versione", "1.0.0", False),
                           ("Installa l'app", "Aggiungi a Home", False)])
    pg.text(X, group.y, W, 30, "Nessuna impostazione nascosta: le voci non "
            "utilizzabili dal profilo sono assenti, non disabilitate.", fs=9,
            fc=INK300, valign="top")


def page01():
    pg = Page("p01", "01 \u00b7 Accesso e home (mobile)", 1460, 1110)
    page_title(pg, "Accesso e home \u00b7 smartphone",
               "Frame da 390 \u00d7 844 dp (Chrome Android, PWA). Il ruolo "
               "attivo \u00e8 mostrato nella barra superiore di ogni schermata.")
    phone(pg, 80, 130, "S-01", "Fede Magazzino", "", [], 0, s01_content)
    phone(pg, 540, 130, "S-02", "Ciao, Giulia", "VENDITE", TABS_3, 0,
          s02_content)
    phone(pg, 1000, 130, "S-20", "Profilo", "PRODUTTORE", TABS_4, 3,
          s20_content)
    caption(pg, 80, 990, 390, "S-01", "Accedi",
            "\u00b7 un'unica colonna, campi a 48 dp\n"
            "\u00b7 errori in banner sopra il pulsante\n"
            "\u00b7 nessuna indicazione se l'email esiste")
    caption(pg, 540, 990, 390, "S-02", "Home mobile (Vendite)",
            "\u00b7 4 KPI, tap per il dettaglio\n"
            "\u00b7 tile Riepiloghi generate dai permessi: qui solo la\n"
            "   disponibilit\u00e0, nessuna Indisponibilit\u00e0\n"
            "\u00b7 accessi rapidi = ultimo filtro usato")
    caption(pg, 1000, 990, 390, "S-20", "Profilo e impostazioni",
            "\u00b7 stesso schermo per tutti i ruoli\n"
            "\u00b7 voci non pertinenti assenti, non disabilitate\n"
            "\u00b7 disconnessione in un tap")
    return pg


# ==========================================================================
# PAGE 02 - desktop home + mobile reports
# ==========================================================================
def s03_content(pg, X, Y, W, H):
    cw = (W - 36) / 4.0
    kpi(pg, X, Y, cw, 84, "DISPONIBILIT\u00c0 TOTALE", "12.340",
        "+3,2% vs settembre")
    kpi(pg, X + cw + 12, Y, cw, 84, "IN INDISPONIBILIT\u00c0", "7",
        "deficit 3.240 piante", tone="danger")
    kpi(pg, X + 2 * (cw + 12), Y, cw, 84, "LOTTI QUESTO MESE", "1.284",
        "ottobre 2026")
    kpi(pg, X + 3 * (cw + 12), Y, cw, 84, "ORDINI NON SPEDITI", "23",
        "da evadere", tone="ok")

    y = Y + 100
    lw = W * 0.58
    pg.box(X, y, lw, 264, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.text(X + 16, y + 10, lw - 120, 20, "Ultimi lotti registrati", fs=12,
            fc=INK900, bold=True)
    pg.text(X + lw - 110, y + 10, 94, 20, "Apri lotti \u203a", fs=10,
            fc=B600, bold=True, align="right")
    rows = [
        {"cells": ["02/10", "Donati", "CH-01 \u00b7 CL-3", "1.250"],
         "kind": "zebra"},
        {"cells": ["02/10", "Mori Marco", "CH-02 \u00b7 CL-1", "800"],
         "kind": ""},
        {"cells": ["01/10", "Agriserv", "CH-01 \u00b7 CL-2", "2.000"],
         "kind": "zebra"},
        {"cells": ["01/10", "Bianchi", "TR-04 \u00b7 CL-1", "150"],
         "kind": ""},
        {"cells": ["30/09", "Esterno", "CH-03 \u00b7 CL-2", "640"],
         "kind": "zebra"},
    ]
    table(pg, X + 16, y + 36, [80, 140, 170, 110],
          ["Data", "Produttore", "Variet\u00e0 / clone", "Quantit\u00e0"],
          rows, row_h=32, head_h=30,
          align=["left", "left", "left", "right"])

    rx = X + lw + 16
    rw = W - lw - 16
    pg.box(rx, y, rw, 264, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.text(rx + 16, y + 10, rw - 120, 20, "Indisponibilit\u00e0 principali",
            fs=12, fc=INK900, bold=True)
    pg.text(rx + rw - 100, y + 10, 84, 20, "Vedi tutte \u203a", fs=10,
            fc=B600, bold=True, align="right")
    items = [("CH-01 \u00b7 CL-1 \u00b7 1103P", "\u22121.200"),
             ("CH-02 \u00b7 CL-3 \u00b7 140Ru", "\u2212800"),
             ("TR-04 \u00b7 CL-1 \u00b7 SO4", "\u2212640"),
             ("CH-01 \u00b7 CL-4 \u00b7 1103P", "\u2212400"),
             ("CH-03 \u00b7 CL-2 \u00b7 K5BB", "\u2212200")]
    iy = y + 40
    for label, val in items:
        pg.box(rx + 12, iy, rw - 24, 34, fill=D50, stroke=NONE, rnd=True)
        pg.box(rx + 12, iy, 3, 34, fill=D600, stroke=NONE)
        pg.text(rx + 22, iy, rw - 110, 34, "\u26a0 " + label, fs=10, fc=D700,
                bold=True)
        pg.text(rx + rw - 96, iy, 76, 34, val, fs=11, fc=D700, bold=True,
                align="right")
        iy += 40

    cy = y + 280
    cards = [("Riepilogo disponibilit\u00e0",
              "Magazzino, ordinato, di cui spedito, disponibilit\u00e0. "
              "Raggruppato per portainnesto.", "S-05"),
             ("Riepilogo per produttore",
              "Le stesse quantit\u00e0 divise nelle 8 colonne dei produttori.",
              "S-07"),
             ("Indisponibilit\u00e0",
              "Solo le combinazioni con disponibilit\u00e0 negativa.", "S-09")]
    cw2 = (W - 24) / 3.0
    for i, (title, body, ref) in enumerate(cards):
        x = X + i * (cw2 + 12)
        pg.box(x, cy, cw2, 104, fill=SURF, stroke=LINE, sw=1, rnd=True)
        pg.text(x + 14, cy + 10, cw2 - 28, 20, title, fs=11, fc=INK900,
                bold=True)
        pg.text(x + 14, cy + 32, cw2 - 28, 46, body, fs=9, fc=INK500,
                valign="top")
        pg.pill(x + 14, cy + 78, 46, 18, ref, fill=B50, fc=B600, fs=8)
    pg.text(X, cy + 114, W, 20, "Azioni rapide: Nuovo lotto \u00b7 Nuovo "
            "ordine \u00b7 Importa Excel (solo Amministratore e "
            "Amministrazione)", fs=9, fc=INK300)


S04_GROUPS = [
    ("1103P", "8.240", [
        {"clone": "CL-1", "mag": "2.400", "ord": "3.600", "spe": "1.200",
         "disp": "\u22121.200", "neg": True},
        {"clone": "CL-2", "mag": "3.200", "ord": "1.800", "spe": "900",
         "disp": "1.400", "neg": False},
        {"clone": "CL-3", "mag": "2.640", "ord": "1.600", "spe": "600",
         "disp": "1.040", "neg": False},
    ]),
    ("140Ru", "2.950", [
        {"clone": "CL-1", "mag": "1.950", "ord": "800", "spe": "300",
         "disp": "1.150", "neg": False},
        {"clone": "CL-3", "mag": "1.000", "ord": "1.800", "spe": "1.000",
         "disp": "\u2212800", "neg": True},
    ]),
]


def s04_content(pg, X, Y, W):
    filter_bar(pg, X, Y, W, ["Tipologia \u25be", "Produzione \u25be",
                             "Variet\u00e0 \U0001F50D"])
    chips(pg, X, Y + 40, ["Barbatelle innestate \u2715", "Vaso \u2715"],
          w_total=W)
    pg.text(X, Y + 68, W - 96, 18, "3 portainnesti \u00b7 24 cloni \u00b7 "
            "aggiornato 14:32", fs=8, fc=INK500)
    pg.pill(X + W - 92, Y + 66, 92, 20, "2 in negativo", fill=D50, fc=D700,
            fs=8)
    y = Y + 92
    for code, tot, rows in S04_GROUPS:
        h = group_card(pg, X, y, W, code, tot, rows,
                       negative_subtotal=code == "1103P")
        y += h + 10
    pg.box(X, y, W, 34, fill=B50, stroke=INK300, sw=1.5, rnd=True,
           text="Totale generale", fs=11, fc=INK900, bold=True, align="left",
           extra="spacingLeft=12")
    pg.text(X + W - 150, y, 138, 34, "11.190", fs=12, fc=INK900, bold=True,
            align="right")
    pg.text(X, y + 42, W, 16, "trascina verso il basso per aggiornare",
            fs=8, fc=INK300, align="center")


S06_GROUPS = [
    ("1103P", [
        {"clone": "CL-1", "disp": "\u22121.200", "neg": True,
         "vals": [("Mori", "1.200"), ("Donati", "800"),
                  ("Agriserv", "\u2212800"), ("V.riuniti", "\u22121.200"),
                  ("Bianchi", "0"), ("Golferenzo", "0"), ("Lorin", "0"),
                  ("Esterno", "0")]},
        {"clone": "CL-2", "disp": "1.400", "neg": False,
         "vals": [("Mori", "400"), ("Donati", "300"), ("Agriserv", "200"),
                  ("V.riuniti", "500"), ("Bianchi", "0"),
                  ("Golferenzo", "0"), ("Lorin", "0"), ("Esterno", "0")]},
    ]),
    ("140Ru", [
        {"clone": "CL-3", "disp": "\u2212800", "neg": True,
         "vals": [("Mori", "\u2212800"), ("Donati", "0"), ("Agriserv", "0"),
                  ("V.riuniti", "0"), ("Bianchi", "0"), ("Golferenzo", "0"),
                  ("Lorin", "0"), ("Esterno", "0")]},
    ]),
]


def s06_content(pg, X, Y, W):
    filter_bar(pg, X, Y, W, ["Tipologia \u25be", "Produzione \u25be",
                             "Variet\u00e0 \U0001F50D"])
    pg.text(X, Y + 42, W, 18, "8 produttori in ordine canonico (non "
            "alfabetico) \u00b7 2 portainnesti", fs=8, fc=INK500)
    y = Y + 64
    for code, rows in S06_GROUPS:
        h = 34 + len(rows) * 78 + 6
        pg.box(X, y, W, h, fill=SURF, stroke=LINE, sw=1, rnd=True)
        pg.box(X, y, W, 34, fill=B50, stroke=LINE, sw=1, rnd=True)
        pg.text(X + 10, y, 200, 34, "\u25a6 " + code, fs=12, fc=INK900,
                bold=True)
        pg.text(X + W - 190, y, 180, 34, "Totale portainnesto", fs=10,
                fc=INK900, bold=True, align="right")
        ry = y + 34
        for r in rows:
            if r["neg"]:
                pg.box(X, ry, W, 78, fill=D50, stroke=NONE)
                pg.box(X, ry, 3, 78, fill=D600, stroke=NONE)
            pg.text(X + 12, ry + 2, 140, 18,
                    ("\u26a0 " if r["neg"] else "") + r["clone"], fs=11,
                    fc=(D700 if r["neg"] else INK900), bold=True)
            pg.text(X + W - 150, ry + 2, 138, 18, "Disp. " + r["disp"],
                    fs=11, fc=(D700 if r["neg"] else INK900), bold=True,
                    align="right")
            pg.text(X + 12, ry + 22, 80, 12, "Per produttore", fs=7,
                    fc=INK500)
            grower_strip(pg, X + 12, ry + 36, W - 24, r["vals"], shown=4)
            ry += 78
        y += h + 10
    pg.text(X, y, W, 18, "\u2039 striscia produttori scorrevole \u00b7 tap su "
            "un produttore = dettaglio (S-11)", fs=8, fc=INK500,
            align="center")


def page02():
    pg = Page("p02", "02 \u00b7 Home desktop e riepiloghi mobile", 2260, 1130)
    page_title(pg, "Panoramica PC e riepiloghi su smartphone",
               "A sinistra la home da PC (Amministratore); a destra i due "
               "riepiloghi mobili: totale e per produttore.")
    desktop(pg, 80, 130, 1180, 740, "/", "Panoramica",
            "Fede Magazzino / Panoramica", "AMMINISTRATORE", 0, s03_content)
    phone(pg, 1310, 130, "S-04", "Riepilogo disponibilit\u00e0",
          "AMMINISTR.", TABS_4, 1, s04_content)
    phone(pg, 1740, 130, "S-06", "Riepilogo per produttore", "AMMINISTRAT.",
          TABS_4, 1, s06_content)
    caption(pg, 80, 900, 1180, "S-03", "Panoramica (PC)",
            "KPI con delta \u00b7 ultimi lotti \u00b7 deficit principali \u00b7 "
            "scorciatoie ai riepiloghi \u00b7 azioni rapide solo ai ruoli "
            "abilitati \u00b7 nessuno scorrimento orizzontale a 1024 dp")
    caption(pg, 1310, 990, 390, "S-04", "Riepilogo disponibilit\u00e0 (xs)",
            "\u00b7 filtri in alto, sempre visibili\n"
            "\u00b7 una card per portainnesto con subtotale\n"
            "\u00b7 riga negativa in rosso grassetto con \u26a0\n"
            "\u00b7 nessuno scorrimento orizzontale di pagina")
    caption(pg, 1740, 990, 390, "S-06", "Per produttore (xs)",
            "\u00b7 otto produttori in una striscia scorrevole\n"
            "\u00b7 ordine canonico, \u2014 per quantit\u00e0 assenti\n"
            "\u00b7 visibile solo ad Amministratore/Amministrazione")
    return pg



# ==========================================================================
# PAGE 03 - mobile reports, filters, detail, export
# ==========================================================================
def s08_content(pg, X, Y, W):
    pg.box(X, Y, W, 62, fill=D50, stroke=D600, sw=1, rnd=True)
    pg.text(X + 12, Y + 6, W - 24, 18, "\u26a0  7 articoli con disponibilit\u00e0 "
            "negativa", fs=11, fc=D700, bold=True)
    pg.text(X + 12, Y + 26, W - 24, 16, "deficit totale 3.240 piante", fs=9,
            fc=D700)
    pg.text(X + 12, Y + 42, W - 24, 14, "ordinato per variet\u00e0 \u00b7 "
            "portainnesto \u00b7 clone", fs=8, fc=INK500)

    cards = [
        ("CH-01 \u00b7 CL-1", "\u22121.200", "1103P \u00b7 Barbatelle innestate "
         "\u00b7 Vaso", "Magazzino 2.400 \u00b7 Ordinato 3.600"),
        ("CH-02 \u00b7 CL-3", "\u2212800", "140Ru \u00b7 Barbatelle innestate "
         "\u00b7 Vaso", "Magazzino 1.000 \u00b7 Ordinato 1.800"),
        ("TR-04 \u00b7 CL-1", "\u2212640", "SO4 \u00b7 Portainnesti \u00b7 "
         "Pieno campo", "Magazzino 360 \u00b7 Ordinato 1.000"),
    ]
    y = Y + 74
    for head, deficit, meta, metrics in cards:
        pg.box(X, y, W, 88, fill=SURF, stroke=D600, sw=1, rnd=True)
        pg.box(X, y, 3, 88, fill=D600, stroke=NONE)
        pg.text(X + 14, y + 6, W - 130, 20, "\u26a0 " + head, fs=12, fc=D700,
                bold=True)
        pg.text(X + W - 116, y + 6, 102, 20, deficit, fs=13, fc=D700,
                bold=True, align="right")
        pg.text(X + 14, y + 26, W - 28, 16, meta, fs=9, fc=INK500)
        pg.box(X + 14, y + 46, W - 28, 30, fill=D50, stroke=NONE, rnd=True)
        pg.text(X + 22, y + 46, W - 44, 30, metrics, fs=9, fc=D700, bold=True)
        y += 96
    pg.text(X, y, W, 16, "Il deficit \u00e8 |magazzino \u2212 ordinato| "
            "mostrato con il segno meno", fs=8, fc=INK300, align="center")


def s10_content(pg, X, Y, W):
    pg.text(X, Y, W, 18, "Filtri", fs=18, fc=INK900, bold=True)
    pg.text(X + W - 60, Y, 60, 18, "Chiudi", fs=10, fc=INK500, align="right")

    def radios(y, title, options, selected):
        pg.text(X, y, W, 16, title, fs=10, fc=INK700, bold=True)
        yy = y + 18
        for i, opt in enumerate(options):
            on = (i == selected)
            pg.box(X, yy, W, 38, fill=(B50 if on else SURF), stroke=LINE, sw=1)
            pg.box(X + 12, yy + 11, 16, 16, fill=(B600 if on else "none"),
                   stroke=(B600 if on else INK300), sw=1.5, rnd=True)
            if on:
                pg.box(X + 16, yy + 15, 8, 8, fill="#FFFFFF", stroke=NONE,
                       rnd=True)
            pg.text(X + 38, yy, W - 50, 38, opt, fs=11,
                    fc=(B600 if on else INK700), bold=on)
            yy += 38
        return yy + 10

    y = Y + 34
    y = radios(y, "TIPOLOGIA", ["Tutte", "Barbatelle innestate",
                                "Portainnesti", "Marze"], 1)
    y = radios(y, "PRODUZIONE", ["Tutte", "Vaso", "Pieno campo",
                                 "Vivaio"], 1)
    pg.text(X, y, W, 16, "CODICE VARIET\u00c0", fs=10, fc=INK700, bold=True)
    pg.box(X, y + 18, W, 40, fill=SURF, stroke=B600, sw=1.5,
           text="\U0001F50D  ch", fs=12, fc=INK700, align="left",
           extra="spacingLeft=12", rnd=True)
    py = y + 64
    for code, desc, n in [("CH-01", "Chardonnay", "4 cloni"),
                          ("CH-02", "Chardonnay clone 96", "2 cloni"),
                          ("CH-03", "Chardonnay bianco", "3 cloni")]:
        pg.box(X, py, W, 44, fill=(B50 if code == "CH-01" else SURF),
               stroke=LINE, sw=1)
        pg.text(X + 12, py, 70, 44, code, fs=11, fc=INK900, bold=True,
                mono=True)
        pg.text(X + 86, py, W - 160, 44, desc, fs=11, fc=INK700)
        pg.text(X + W - 70, py, 58, 44, n, fs=8, fc=INK500, align="right")
        py += 44
    pg.box(X, Y + 604, W, 46, fill=B600, stroke=NONE, text="Applica",
           fs=14, fc="#FFFFFF", bold=True, rnd=True)
    pg.text(X, Y + 656, W, 18, "Azzera filtri", fs=11, fc=B600, bold=True,
            align="center")


def bg_report(pg, X, Y, W):
    filter_bar(pg, X, Y, W, ["Tipologia \u25be", "Produzione \u25be",
                             "Variet\u00e0 \U0001F50D"])
    group_card(pg, X, Y + 44, W, "1103P", "8.240", S04_GROUPS[0][2])


def s11_sheet(pg, X, Y, W):
    rows = [("Magazzino", "2.400", False), ("Ordinato", "3.600", False),
            ("Di cui spedito", "1.200", False),
            ("Disponibilit\u00e0", "\u22121.200", True)]
    y = Y
    for label, val, neg in rows:
        pg.text(X, y, W - 120, 26, label, fs=11, fc=INK700)
        pg.text(X + W - 120, y, 120, 26, val, fs=12,
                fc=(D700 if neg else INK900), bold=True, align="right")
        if neg:
            pg.box(X, y, W, 26, fill=D50, stroke=NONE, rnd=True)
            pg.text(X + 4, y, W - 120, 26, "\u26a0 " + label, fs=11, fc=D700,
                    bold=True)
            pg.text(X + W - 120, y, 116, 26, val, fs=12, fc=D700, bold=True,
                    align="right")
        pg.hr(X, y + 26, W)
        y += 30
    y += 6
    pg.text(X, y, W, 16, "PER PRODUTTORE", fs=9, fc=INK500, bold=True)
    y += 18
    for name, val in [("Mori Marco", "1.200"), ("Donati", "800"),
                      ("Agriserv", "\u2212800"), ("Vivai riuniti",
                                                 "\u22121.200")]:
        neg = val.startswith("\u2212")
        pg.text(X, y, W - 100, 22, name, fs=10, fc=INK700)
        pg.text(X + W - 100, y, 100, 22, val, fs=10,
                fc=(D700 if neg else INK900), bold=neg, align="right")
        y += 22
    pg.box(X, Y + 60, W, 26, fill=NONE, stroke=NONE,
           text="Dettaglio forniture (3 lotti) \u00b7 Dettaglio impegni "
           "(2 ordini)  \u203a", fs=9, fc=B600, bold=True, align="left")
    pg.box(X, Y + 108, W / 2 - 6, 44, fill=SURF, stroke=B600, sw=1,
           text="Copia valori", fs=11, fc=B600, bold=True, rnd=True)
    pg.box(X + W / 2 + 6, Y + 108, W / 2 - 6, 44, fill=B600, stroke=NONE,
           text="Chiudi", fs=11, fc="#FFFFFF", bold=True, rnd=True)


def s12_sheet(pg, X, Y, W):
    pg.text(X, Y, W, 16, "formato", fs=9, fc=INK500, bold=True)
    fmts = ["Excel (.xlsx)", "CSV", "PDF"]
    cw = (W - 12) / 3.0
    for i, f in enumerate(fmts):
        on = (i == 0)
        pg.box(X + i * (cw + 6), Y + 18, cw, 38,
               fill=(B600 if on else SURF), stroke=(B600 if on else LINE),
               sw=1, text=f, fs=10, fc=("#FFFFFF" if on else INK700),
               bold=on, rnd=True)
    y = Y + 70
    pg.text(X, y, W, 16, "contenuto", fs=9, fc=INK500, bold=True)
    y += 18
    for label, on in [("Includi righe di subtotale", True),
                      ("Includi filtri come intestazione", True),
                      ("Evidenzia righe negative", True)]:
        pg.box(X, y, W, 34, fill=SURF, stroke=LINE, sw=1, rnd=True)
        pg.box(X + 10, y + 9, 16, 16, fill=(B600 if on else SURF),
               stroke=B600, sw=1.5, rnd=True)
        pg.text(X + 12, y + 9, 16, 16, "\u2713" if on else "", fs=11,
                fc="#FFFFFF", bold=True)
        pg.text(X + 34, y, W - 44, 34, label, fs=10, fc=INK700)
        y += 38
    pg.text(X, y + 2, W, 28, "Ambito: 24 cloni \u00b7 3 portainnesti \u00b7 "
            "Barbatelle innestate, Vaso", fs=9, fc=INK500, valign="top")
    pg.box(X, Y + 232, W, 46, fill=B600, stroke=NONE, text="Esporta",
           fs=13, fc="#FFFFFF", bold=True, rnd=True)
    pg.text(X, Y + 288, W, 20, "Condividi\u2026", fs=11, fc=B600, bold=True,
            align="center")


def page03():
    pg = Page("p03", "03 \u00b7 Riepiloghi mobile e overlay", 1930, 1130)
    page_title(pg, "Indisponibilit\u00e0, filtri, dettaglio, esporta",
               "Tutte le attivit\u00e0 secondarie sono bottom sheet: nessuna "
               "nuova pagina per un compito che si pu\u00f2 chiudere.")

    phone(pg, 80, 130, "S-08", "Indisponibilit\u00e0", "PRODUTTORE", TABS_4,
          2, s08_content)
    phone(pg, 540, 130, "S-10", "Filtri", "PRODUTTORE", [], 0, s10_content)
    phone(pg, 1000, 130, "S-11", "Riepilogo disponibilit\u00e0", "PRODUTTORE",
          TABS_4, 1, bg_report)
    sheet(pg, 1000, 130, 316, "S-11", "CH-01 \u00b7 1103P", s11_sheet, 430)
    phone(pg, 1460, 130, "S-12", "Riepilogo disponibilit\u00e0",
          "AMMINISTRAT.", TABS_4, 1, bg_report)
    sheet(pg, 1460, 130, 400, "S-12", "Esporta", s12_sheet, 356)

    caption(pg, 80, 990, 390, "S-08", "Indisponibilit\u00e0 (xs)",
            "\u00b7 solo righe con magazzino \u2212 ordinato < 0\n"
            "\u00b7 ordinamento dichiarato in chiaro\n"
            "\u00b7 nessun rosso durante il caricamento")
    caption(pg, 540, 990, 390, "S-10", "Filtri (schermo intero)",
            "\u00b7 tre sezioni a selezione singola\n"
            "\u00b7 variet\u00e0 ricercabile con elenco filtrabile\n"
            "\u00b7 Applica in basso, nel pollice")
    caption(pg, 1000, 990, 390, "S-11", "Dettaglio riga",
            "\u00b7 le quattro quantit\u00e0 della riga\n"
            "\u00b7 ripartizione per produttore (solo\n"
            "   Amministratore/Amministrazione)\n"
            "\u00b7 copia valori in TSV")
    caption(pg, 1460, 990, 390, "S-12", "Esporta e condividi",
            "\u00b7 formato e contenuto espliciti\n"
            "\u00b7 l'ambito descrive i filtri attivi\n"
            "\u00b7 Condividi usa l'API di condivisione")
    return pg


# ==========================================================================
# PAGE 04 - desktop reports
# ==========================================================================
S05_ROWS = [
    {"cells": ["CL-1", "1103P", "2.400", "3.600", "1.200", "\u22121.200"],
     "kind": "negative"},
    {"cells": ["CL-2", "1103P", "3.200", "1.800", "900", "1.400"],
     "kind": ""},
    {"cells": ["CL-3", "1103P", "2.640", "1.600", "600", "1.040"],
     "kind": "zebra"},
    {"cells": ["Totale portainnesto", "1103P", "8.240", "7.000", "2.700",
               "1.240"], "kind": "subtotal"},
    {"cells": ["CL-1", "140Ru", "1.950", "800", "300", "1.150"], "kind": ""},
    {"cells": ["CL-3", "140Ru", "1.000", "1.800", "1.000", "\u2212800"],
     "kind": "negative"},
    {"cells": ["Totale portainnesto", "140Ru", "2.950", "2.600", "1.300",
               "350"], "kind": "subtotal"},
    {"cells": ["CL-1", "SO4", "1.480", "600", "200", "880"], "kind": ""},
    {"cells": ["Totale portainnesto", "SO4", "1.480", "600", "200", "880"],
     "kind": "subtotal"},
    {"cells": ["Totale generale", "", "12.670", "10.200", "4.200", "2.470"],
     "kind": "total"},
]


def s05_content(pg, X, Y, W, H):
    labels = ["Tipologia", "Produzione", "Codice variet\u00e0"]
    cw = (W - 320) / 3.0
    for i, lab in enumerate(labels):
        x = X + i * (cw + 10)
        pg.text(x, Y, cw, 14, lab, fs=9, fc=INK500, bold=True)
        val = ["Tutte", "Vaso", "\U0001F50D  CH-01"][i]
        pg.box(x, Y + 16, cw, 34, fill=SURF, stroke=INK300, sw=1, text=val,
               fs=10, fc=INK700, align="left", extra="spacingLeft=8", rnd=True)
    pg.box(X + W - 300, Y + 16, 74, 34, fill=NONE, stroke=B600, sw=1,
           text="Azzera", fs=10, fc=B600, bold=True, rnd=True)
    pg.box(X + W - 216, Y + 16, 96, 34, fill=SURF, stroke=INK300, sw=1,
           text="Esporta", fs=10, fc=INK700, bold=True, rnd=True)
    pg.box(X + W - 110, Y + 16, 110, 34, fill=SURF, stroke=INK300, sw=1,
           text="Colonne \u25be", fs=10, fc=INK700, bold=True, rnd=True)
    pg.text(X, Y + 58, W, 16, "3 portainnesti \u00b7 24 cloni \u00b7 "
            "aggiornato 14:32 \u00b7 2 righe in negativo", fs=9, fc=INK500)

    table(pg, X, Y + 78, [170, 160, 130, 130, 140, 150],
          ["Codice clone", "Codice portainnesto", "Magazzino", "Ordinato",
           "Di cui spedito", "Disponibilit\u00e0"],
          S05_ROWS, row_h=32, head_h=34,
          align=["left", "left", "right", "right", "right", "right"])
    pg.text(X, Y + H - 18, W, 16, "\u00b7 intestazione e prima colonna "
            "bloccate \u00b7 36 dp per riga \u00b7 zebra solo dove non c'\u00e8 "
            "tinta", fs=8, fc=INK300)


def s09_content(pg, X, Y, W, H):
    pg.box(X, Y, W, 46, fill=D50, stroke=D600, sw=1, rnd=True)
    pg.text(X + 14, Y + 4, W - 28, 20, "\u26a0  7 articoli in "
            "indisponibilit\u00e0 \u00b7 deficit totale 3.240 piante", fs=11,
            fc=D700, bold=True)
    pg.text(X + 14, Y + 24, W - 28, 16, "ordinato per codice variet\u00e0 "
            "\u2192 portainnesto \u2192 clone", fs=9, fc=D700)
    rows = [
        {"cells": ["Barbatelle innestate", "Vaso", "CH-01", "CL-1", "1103P",
                   "2.400", "3.600", "\u22121.200"], "kind": "negative"},
        {"cells": ["Barbatelle innestate", "Vaso", "CH-02", "CL-3", "140Ru",
                   "1.000", "1.800", "\u2212800"], "kind": "negative"},
        {"cells": ["Portainnesti", "Pieno campo", "TR-04", "CL-1", "SO4",
                   "360", "1.000", "\u2212640"], "kind": "negative"},
        {"cells": ["Barbatelle innestate", "Vaso", "CH-01", "CL-4", "1103P",
                   "900", "1.300", "\u2212400"], "kind": "negative"},
        {"cells": ["Barbatelle innestate", "Pieno campo", "CH-03", "CL-2",
                   "K5BB", "450", "650", "\u2212200"], "kind": "negative"},
    ]
    table(pg, X, Y + 62, [150, 110, 90, 80, 120, 100, 100, 110],
          ["Tipologia", "Produzione", "Cod. variet\u00e0", "Clone",
           "Portainnesto", "Magazzino", "Ordinato", "Deficit"],
          rows, row_h=32, head_h=34,
          align=["left", "left", "left", "left", "left", "right", "right",
                 "right"])
    pg.text(X, Y + 62 + 34 + 5 * 32 + 12, W, 16, "Importo negativo: il "
            "deficit \u00e8 mostrato come valore positivo preceduto dal segno "
            "meno. La griglia non mostra mai un deficit \u2265 0.", fs=8,
            fc=INK300)


def s07_content(pg, X, Y, W, H):
    pg.text(X, Y, 300, 14, "Tipologia / Produzione / Variet\u00e0", fs=9,
            fc=INK500, bold=True)
    for i, val in enumerate(["Tutte", "Vaso", "\U0001F50D  CH-01"]):
        pg.box(X + i * 170, Y + 16, 160, 34, fill=SURF, stroke=INK300, sw=1,
               text=val, fs=10, fc=INK700, align="left",
               extra="spacingLeft=8", rnd=True)
    pg.box(X + 520, Y + 16, 170, 34, fill=SURF, stroke=INK300, sw=1,
           text="Solo disponibilit\u00e0", fs=10, fc=INK700, rnd=True)
    pg.box(X + W - 200, Y + 16, 96, 34, fill=SURF, stroke=INK300, sw=1,
           text="Esporta", fs=10, fc=INK700, bold=True, rnd=True)
    pg.box(X + W - 96, Y + 16, 96, 34, fill=SURF, stroke=INK300, sw=1,
           text="Colonne \u25be", fs=10, fc=INK700, bold=True, rnd=True)

    grower_hdr = ["Mori<br>Marco", "Donati", "Agri<br>serv", "Vivai<br>riuniti",
                  "Bianchi", "Golfer<br>enzo", "Lorin", "Esterno"]
    widths = [110, 110, 74, 74, 74, 90] + [72] * 8 + [84]
    headers = ["Clone", "Portainnesto", "Mag", "Ord", "Sped", "Disp"] + \
              grower_hdr + ["Tot. prod."]
    align = ["left", "left"] + ["right"] * 13
    data = [
        (["CL-1", "1103P", "2.400", "3.600", "1.200", "\u22121.200",
          "1.200", "800", "\u2212800", "\u22121.200", "0", "0", "0", "0",
          "\u22121.200"], "negative"),
        (["CL-2", "1103P", "3.200", "1.800", "900", "1.400", "400", "300",
          "200", "500", "0", "0", "0", "0", "1.400"], ""),
        (["CL-3", "1103P", "2.640", "1.600", "600", "1.040", "640", "0",
          "400", "0", "0", "0", "0", "0", "1.040"], "zebra"),
        (["Totale portainnesto", "1103P", "8.240", "7.000", "2.700", "1.240",
          "2.240", "1.100", "\u2212200", "\u2212700", "0", "0", "0", "0",
          "1.240"], "subtotal"),
        (["CL-1", "140Ru", "1.950", "800", "300", "1.150", "950", "200", "0",
          "0", "0", "0", "0", "0", "1.150"], ""),
        (["CL-3", "140Ru", "1.000", "1.800", "1.000", "\u2212800", "\u2212800",
          "0", "0", "0", "0", "0", "0", "0", "\u2212800"], "negative"),
        (["Totale portainnesto", "140Ru", "2.950", "2.600", "1.300", "350",
          "150", "200", "0", "0", "0", "0", "0", "0", "350"], "subtotal"),
    ]
    rows = [{"cells": c, "kind": k} for c, k in data]
    table(pg, X, Y + 62, widths, headers, rows, row_h=30, head_h=44,
          align=align, fs=11)
    pg.text(X, Y + 62 + 44 + 7 * 30 + 12, W, 34,
            "15 colonne: le prime due sono bloccate, le 8 colonne produttore "
            "scorrono orizzontalmente dentro la griglia. La colonna \u00abTot. "
            "prod.\u00bb somma le otto colonne e serve da verifica a vista.",
            fs=9, fc=INK300, valign="top")


def page04():
    pg = Page("p04", "04 \u00b7 Riepiloghi desktop", 2620, 1870)
    page_title(pg, "Riepiloghi su PC \u00b7 le tabelle di output",
               "Griglie vere: intestazione fissa, numeri a destra, subtotali "
               "per portainnesto in grassetto su fondo tinto, righe negative "
               "in rosso grassetto.")
    desktop(pg, 80, 130, 1180, 740, "/r/disponibilita",
            "Riepilogo disponibilit\u00e0",
            "Riepiloghi / Disponibilit\u00e0", "AMMINISTRATORE", 1, s05_content)
    desktop(pg, 1340, 130, 1180, 740, "/r/indisponibilita",
            "Indisponibilit\u00e0", "Riepiloghi / Indisponibilit\u00e0",
            "AMMINISTRATORE", 1, s09_content)
    desktop(pg, 80, 990, 1500, 760, "/r/produttore",
            "Riepilogo per produttore", "Riepiloghi / Per produttore",
            "AMMINISTRATORE", 1, s07_content)

    caption(pg, 80, 900, 1180, "S-05", "Riepilogo disponibilit\u00e0 (PC)",
            "Filtri in alto (Tipologia, Produzione, variet\u00e0 ricercabile) "
            "\u00b7 raggruppamento clone/portainnesto \u00b7 ordinamento per "
            "portainnesto \u00b7 riga \u00abTotale portainnesto\u00bb in "
            "grassetto su fondo tinto \u00b7 rossa l'intera riga con "
            "disponibilit\u00e0 negativa")
    caption(pg, 1340, 900, 1180, "S-09", "Indisponibilit\u00e0 (PC)",
            "Solo deficit \u00b7 ordinamento variet\u00e0 \u2192 portainnesto "
            "\u2192 clone \u00b7 colonna Deficit in grassetto rosso \u00b7 "
            "export identico alla vista")
    caption(pg, 80, 1770, 1500, "S-07", "Riepilogo per produttore (PC)",
            "Le stesse quantit\u00e0 divise nelle 8 colonne dei produttori "
            "\u00b7 sottototali per portainnesto su tutte le colonne \u00b7 "
            "visibile solo ad Amministratore e Amministrazione")
    return pg


# ==========================================================================
# PAGE 05 - data entry (PC only)
# ==========================================================================
S13_ROWS = [
    {"cells": ["2026", "Donati", "Barbatelle innestate", "Nuova produzione",
               "CH-01", "CL-3", "1103P", "1.250", "\u270e \u29c9 \u2715"],
     "kind": "zebra"},
    {"cells": ["2026", "Mori Marco", "Barbatelle innestate", "Ripiantato",
               "CH-02", "CL-1", "140Ru", "800", "\u270e \u29c9 \u2715"],
     "kind": ""},
    {"cells": ["2025", "Agriserv", "Vasetti", "Frigoconservato", "CH-01",
               "CL-2", "1103P", "2.000", "\u270e \u29c9 \u2715"],
     "kind": "zebra"},
    {"cells": ["2025", "Bianchi", "Barbatelloni", "Nuova produzione", "TR-04",
               "CL-1", "SO4", "150", "\u270e \u29c9 \u2715"], "kind": ""},
    {"cells": ["2025", "Esterno", "Barbatelle selvatiche", "Ripiantato",
               "CH-03", "CL-2", "K5BB", "640", "\u270e \u29c9 \u2715"],
     "kind": "zebra"},
    {"cells": ["2024", "Lorin", "(non indicata)", "(non indicata)", "CH-01",
               "CL-1", "1103P", "1.100", "\u270e \u29c9 \u2715"],
     "kind": ""},
]


def drawer(pg, x, y, w, h, title, fields, footer, note=None):
    pg.box(x, y, w, h, fill=SURF, stroke=INK300, sw=1.5, rnd=True)
    pg.box(x, y, w, 44, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(x + 14, y, w - 60, 44, title, fs=12, fc=INK900, bold=True)
    pg.text(x + w - 44, y, 32, 44, "\u2715", fs=12, fc=INK500, align="center")
    fy = y + 52
    for label, value, state in fields:
        pg.text(x + 14, fy, w - 28, 14, label, fs=9, fc=INK700, bold=True)
        if state == "disabled":
            pg.box(x + 14, fy + 15, w - 28, 30, fill=CANVAS, stroke=LINE,
                   sw=1, text=value, fs=10, fc=INK300, align="left",
                   extra="spacingLeft=8", rnd=True)
        elif state == "focus":
            pg.box(x + 14, fy + 15, w - 28, 30, fill=SURF, stroke=B600,
                   sw=1.5, text=value, fs=10, fc=INK900, align="left",
                   extra="spacingLeft=8", rnd=True)
        elif state == "error":
            pg.box(x + 14, fy + 15, w - 28, 30, fill=SURF, stroke=D600,
                   sw=1.5, text=value, fs=10, fc=D700, align="left",
                   extra="spacingLeft=8", rnd=True)
        elif state == "toggle":
            pg.box(x + 14, fy + 15, 38, 20, fill=B600, stroke=NONE, rnd=True)
            pg.box(x + 32, fy + 17, 16, 16, fill="#FFFFFF", stroke=NONE,
                   rnd=True)
            pg.text(x + 60, fy + 15, w - 80, 20, value, fs=10, fc=INK700)
        else:
            pg.box(x + 14, fy + 15, w - 28, 30, fill=SURF, stroke=INK300,
                   sw=1, text=value, fs=10, fc=INK700, align="left",
                   extra="spacingLeft=8", rnd=True)
        if state != "toggle":
            pg.text(x + w - 30, fy + 15, 20, 30, "\u25be", fs=9, fc=INK500,
                    align="center")
        fy += 48
    if note:
        pg.text(x + 14, fy, w - 28, 24, note, fs=8, fc=INK300, valign="top")
    pg.hr(x, y + h - 56, w)
    bx = x + 14
    for label, kind in footer:
        bw = (w - 28 - 8 * (len(footer) - 1)) / float(len(footer))
        if kind == "primary":
            pg.box(bx, y + h - 44, bw, 32, fill=B600, stroke=NONE,
                   text=label, fs=10, fc="#FFFFFF", bold=True, rnd=True)
        elif kind == "secondary":
            pg.box(bx, y + h - 44, bw, 32, fill=SURF, stroke=B600, sw=1,
                   text=label, fs=10, fc=B600, bold=True, rnd=True)
        else:
            pg.box(bx, y + h - 44, bw, 32, fill=NONE, stroke=LINE, sw=1,
                   text=label, fs=10, fc=INK500, rnd=True)
        bx += bw + 8


def s13_content(pg, X, Y, W, H):
    tw = W - 440
    pg.box(X, Y, 210, 34, fill=SURF, stroke=INK300, sw=1,
           text="\U0001F50D  Cerca lotto", fs=10, fc=INK500, align="left",
           extra="spacingLeft=10", rnd=True)
    for i, val in enumerate(["Produttore \u25be", "Variet\u00e0 \u25be",
                             "Anno \u25be"]):
        pg.box(X + 218 + i * 122, Y, 114, 34, fill=SURF, stroke=INK300, sw=1,
               text=val, fs=10, fc=INK700, rnd=True)
    pg.box(X + tw - 196, Y, 90, 34, fill=SURF, stroke=B600, sw=1,
           text="Importa", fs=10, fc=B600, bold=True, rnd=True)
    pg.box(X + tw - 100, Y, 100, 34, fill=B600, stroke=NONE, text="+ Nuovo",
           fs=10, fc="#FFFFFF", bold=True, rnd=True)
    pg.text(X, Y + 42, tw, 16, "1.284 lotti \u00b7 nessun filtro attivo "
            "\u00b7 6 righe senza tipologia (badge dati)", fs=9, fc=INK500)
    table(pg, X, Y + 62, [56, 104, 112, 104, 56, 50, 84, 80, 60],
          ["Anno", "Produttore", "Tipologia", "Produzione", "Variet\u00e0",
           "Clone", "Port.", "Quantit\u00e0", ""],
          S13_ROWS, row_h=32, head_h=34,
          align=["left", "left", "left", "left", "left", "left", "left",
                 "right", "center"], fs=9)
    pg.text(X, Y + H - 24, tw, 16, "Inserimento dati disponibile solo da PC "
            "(\u22651024 dp). Nessuna data: il lotto ha l'anno di "
            "conferimento.", fs=8, fc=INK300)
    drawer(pg, X + tw + 20, Y, 420, H - 20, "Nuovo lotto",
           [("Anno di conferimento", "2026", ""),
            ("Produttore", "Donati", ""),
            ("Tipologia", "Barbatelle innestate", ""),
            ("Produzione", "Nuova produzione", ""),
            ("Codice variet\u00e0", "CH-01", "focus"),
            ("Codice clone", "Seleziona prima la variet\u00e0", "disabled"),
            ("Codice portainnesto", "1103P", ""),
            ("Quantit\u00e0 (interi, no decimali)", "1250", ""),
            ("Note", "", "")],
           [("Salva", "primary"), ("Salva e nuovo", "secondary"),
            ("Annulla", "ghost")],
           note="F-V2: il select dei cloni resta disabilitato finch\u00e9 la "
                "variet\u00e0 non \u00e8 scelta. quantita \u00e8 integer.")


S14_ROWS = [
    {"cells": ["Donati \u00b7 2026", "Barbatelle innestate",
               "Nuova produzione", "CH-01", "CL-3", "1103P", "1.200",
               "\u2713 Spedito"], "kind": "zebra"},
    {"cells": ["\u2014", "Barbatelle innestate", "Ripiantato", "CH-02",
               "CL-1", "140Ru", "800", "\u2014"], "kind": ""},
    {"cells": ["Agriserv \u00b7 2025", "Vasetti", "Frigoconservato", "CH-01",
               "CL-2", "1103P", "2.000", "\u2713 Spedito"], "kind": "zebra"},
    {"cells": ["\u2014", "Barbatelloni", "Nuova produzione", "TR-04",
               "CL-1", "SO4", "150", "\u2014"], "kind": ""},
    {"cells": ["Esterno \u00b7 2025", "Barbatelle selvatiche", "Ripiantato",
               "CH-03", "CL-2", "K5BB", "640", "\u2713 Spedito"],
     "kind": "zebra"},
]


def s14_content(pg, X, Y, W, H):
    tw = W - 440
    pg.box(X, Y, 210, 34, fill=SURF, stroke=INK300, sw=1,
           text="\U0001F50D  Cerca ordine", fs=10, fc=INK500, align="left",
           extra="spacingLeft=10", rnd=True)
    for i, val in enumerate(["Spedito: tutti \u25be", "Variet\u00e0 \u25be",
                             "Anno \u25be"]):
        pg.box(X + 218 + i * 122, Y, 114, 34, fill=SURF, stroke=INK300, sw=1,
               text=val, fs=10, fc=INK700, rnd=True)
    pg.box(X + tw - 196, Y, 90, 34, fill=SURF, stroke=B600, sw=1,
           text="Importa", fs=10, fc=B600, bold=True, rnd=True)
    pg.box(X + tw - 100, Y, 100, 34, fill=B600, stroke=NONE, text="+ Nuovo",
           fs=10, fc="#FFFFFF", bold=True, rnd=True)
    pg.text(X, Y + 42, tw, 16, "312 impegni \u00b7 23 non spediti \u00b7 "
            "nessun campo cliente nello schema", fs=9, fc=INK500)
    table(pg, X, Y + 62, [150, 118, 112, 56, 50, 70, 70, 78],
          ["Lotto collegato", "Tipologia", "Produzione", "Variet\u00e0",
           "Clone", "Port.", "Quantit\u00e0", "Spedito"],
          S14_ROWS, row_h=32, head_h=34,
          align=["left", "left", "left", "left", "left", "left", "right",
                 "center"], fs=9)
    pg.text(X, Y + 62 + 34 + 5 * 32 + 12, tw, 44,
            "Il flag \u00abSpedito\u00bb si attiva inline con undo di 8 s e "
            "alimenta \u00abDi cui spedito\u00bb in tutti i riepiloghi. "
            "Nessuna data di spedizione: la colonna non esiste. Con il lotto "
            "collegato l'impegno entra nella colonna del produttore (Report 2), "
            "altrimenti in \u00abNon attribuito\u00bb.", fs=8, fc=INK300,
            valign="top")
    drawer(pg, X + tw + 20, Y, 420, H - 20, "Nuovo impegno",
           [("Lotto collegato", "Donati \u00b7 2026 \u00b7 CH-01 \u00b7 CL-3",
             "focus"),
            ("Tipologia", "Barbatelle innestate", ""),
            ("Produzione", "Nuova produzione", ""),
            ("Codice variet\u00e0", "CH-01 (dal lotto)", ""),
            ("Codice clone", "CL-3 (dal lotto)", ""),
            ("Codice portainnesto", "1103P", ""),
            ("Quantit\u00e0 ordinata", "1200", ""),
            ("Spedito", "non ancora spedito", "toggle"),
            ("Note", "", "")],
           [("Salva", "primary"), ("Annulla", "ghost")],
           note="Scegliendo il lotto, tipologia/produzione/variet\u00e0/clone/"
                "portainnesto si compilano ma restano modificabili.")


def s13l_content(pg, X, Y, W):
    pg.box(X + W / 2 - 34, Y + 150, 68, 68, fill=CANVAS, stroke=LINE, sw=1,
           rnd=True, text="\U0001F512", fs=26, fc=INK500)
    pg.text(X, Y + 236, W, 44, "Inserimento dati disponibile solo da PC", fs=15,
            fc=INK900, bold=True, align="center")
    pg.text(X, Y + 292, W, 80,
            "Registra lotti e ordini da un computer.\nDa smartphone puoi "
            "consultare i riepiloghi.", fs=11, fc=INK500, align="center",
            valign="top")
    pg.box(X + 24, Y + 392, W - 48, 46, fill=B600, stroke=NONE,
           text="Vai ai riepiloghi", fs=12, fc="#FFFFFF", bold=True, rnd=True)
    pg.box(X + 24, Y + 448, W - 48, 42, fill=SURF, stroke=B600, sw=1,
           text="Copia link per il PC", fs=11, fc=B600, bold=True, rnd=True)
    pg.text(X, Y + 516, W, 40, "Nessun modulo parziale: la rotta di "
            "inserimento \u00e8 bloccata sotto 1024 dp, non adattata.", fs=9,
            fc=INK300, align="center", valign="top")


# ==========================================================================
# PAGE 05 - data entry (PC only)
# ==========================================================================
S13_ROWS = [
    {"cells": ["2026", "Donati", "Barbatelle innestate", "Nuova produzione",
               "CH-01", "CL-3", "1103P", "1.250", "\u270e \u29c9 \u2715"],
     "kind": "zebra"},
    {"cells": ["2026", "Mori Marco", "Barbatelle innestate", "Ripiantato",
               "CH-02", "CL-1", "140Ru", "800", "\u270e \u29c9 \u2715"],
     "kind": ""},
    {"cells": ["2025", "Agriserv", "Vasetti", "Frigoconservato", "CH-01",
               "CL-2", "1103P", "2.000", "\u270e \u29c9 \u2715"],
     "kind": "zebra"},
    {"cells": ["2025", "Bianchi", "Barbatelloni", "Nuova produzione", "TR-04",
               "CL-1", "SO4", "150", "\u270e \u29c9 \u2715"], "kind": ""},
    {"cells": ["2025", "Esterno", "Barbatelle selvatiche", "Ripiantato",
               "CH-03", "CL-2", "K5BB", "640", "\u270e \u29c9 \u2715"],
     "kind": "zebra"},
    {"cells": ["2024", "Lorin", "(non indicata)", "(non indicata)", "CH-01",
               "CL-1", "1103P", "1.100", "\u270e \u29c9 \u2715"],
     "kind": ""},
]

S14_ROWS = [
    {"cells": ["Donati \u00b7 2026", "Barbatelle innestate",
               "Nuova produzione", "CH-01", "CL-3", "1103P", "1.200",
               "\u2713 Spedito"], "kind": "zebra"},
    {"cells": ["\u2014", "Barbatelle innestate", "Ripiantato", "CH-02",
               "CL-1", "140Ru", "800", "\u2014"], "kind": ""},
    {"cells": ["Agriserv \u00b7 2025", "Vasetti", "Frigoconservato", "CH-01",
               "CL-2", "1103P", "2.000", "\u2713 Spedito"], "kind": "zebra"},
    {"cells": ["\u2014", "Barbatelloni", "Nuova produzione", "TR-04",
               "CL-1", "SO4", "150", "\u2014"], "kind": ""},
    {"cells": ["Esterno \u00b7 2025", "Barbatelle selvatiche", "Ripiantato",
               "CH-03", "CL-2", "K5BB", "640", "\u2713 Spedito"],
     "kind": "zebra"},
]


def drawer(pg, x, y, w, h, title, fields, footer, note=None):
    pg.box(x, y, w, h, fill=SURF, stroke=INK300, sw=1.5, rnd=True)
    pg.box(x, y, w, 44, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(x + 14, y, w - 60, 44, title, fs=12, fc=INK900, bold=True)
    pg.text(x + w - 44, y, 32, 44, "\u2715", fs=12, fc=INK500, align="center")
    fy = y + 52
    for label, value, state in fields:
        pg.text(x + 14, fy, w - 28, 14, label, fs=9, fc=INK700, bold=True)
        if state == "disabled":
            pg.box(x + 14, fy + 15, w - 28, 30, fill=CANVAS, stroke=LINE,
                   sw=1, text=value, fs=10, fc=INK300, align="left",
                   extra="spacingLeft=8", rnd=True)
        elif state == "focus":
            pg.box(x + 14, fy + 15, w - 28, 30, fill=SURF, stroke=B600,
                   sw=1.5, text=value, fs=10, fc=INK900, align="left",
                   extra="spacingLeft=8", rnd=True)
        elif state == "error":
            pg.box(x + 14, fy + 15, w - 28, 30, fill=SURF, stroke=D600,
                   sw=1.5, text=value, fs=10, fc=D700, align="left",
                   extra="spacingLeft=8", rnd=True)
        elif state == "toggle":
            pg.box(x + 14, fy + 15, 38, 20, fill=B600, stroke=NONE, rnd=True)
            pg.box(x + 32, fy + 17, 16, 16, fill="#FFFFFF", stroke=NONE,
                   rnd=True)
            pg.text(x + 60, fy + 15, w - 80, 20, value, fs=10, fc=INK700)
        else:
            pg.box(x + 14, fy + 15, w - 28, 30, fill=SURF, stroke=INK300,
                   sw=1, text=value, fs=10, fc=INK700, align="left",
                   extra="spacingLeft=8", rnd=True)
        if state != "toggle":
            pg.text(x + w - 30, fy + 15, 20, 30, "\u25be", fs=9, fc=INK500,
                    align="center")
        fy += 48
    if note:
        pg.text(x + 14, fy, w - 28, 24, note, fs=8, fc=INK300, valign="top")
    pg.hr(x, y + h - 56, w)
    bx = x + 14
    for label, kind in footer:
        bw = (w - 28 - 8 * (len(footer) - 1)) / float(len(footer))
        if kind == "primary":
            pg.box(bx, y + h - 44, bw, 32, fill=B600, stroke=NONE,
                   text=label, fs=10, fc="#FFFFFF", bold=True, rnd=True)
        elif kind == "secondary":
            pg.box(bx, y + h - 44, bw, 32, fill=SURF, stroke=B600, sw=1,
                   text=label, fs=10, fc=B600, bold=True, rnd=True)
        else:
            pg.box(bx, y + h - 44, bw, 32, fill=NONE, stroke=LINE, sw=1,
                   text=label, fs=10, fc=INK500, rnd=True)
        bx += bw + 8


def s13_content(pg, X, Y, W, H):
    tw = W - 440
    pg.box(X, Y, 210, 34, fill=SURF, stroke=INK300, sw=1,
           text="\U0001F50D  Cerca lotto", fs=10, fc=INK500, align="left",
           extra="spacingLeft=10", rnd=True)
    for i, val in enumerate(["Produttore \u25be", "Variet\u00e0 \u25be",
                             "Anno \u25be"]):
        pg.box(X + 218 + i * 122, Y, 114, 34, fill=SURF, stroke=INK300, sw=1,
               text=val, fs=10, fc=INK700, rnd=True)
    pg.box(X + tw - 196, Y, 90, 34, fill=SURF, stroke=B600, sw=1,
           text="Importa", fs=10, fc=B600, bold=True, rnd=True)
    pg.box(X + tw - 100, Y, 100, 34, fill=B600, stroke=NONE, text="+ Nuovo",
           fs=10, fc="#FFFFFF", bold=True, rnd=True)
    pg.text(X, Y + 42, tw, 16, "1.284 lotti \u00b7 nessun filtro attivo "
            "\u00b7 6 righe senza tipologia (badge dati)", fs=9, fc=INK500)
    table(pg, X, Y + 62, [56, 104, 112, 104, 56, 50, 84, 80, 60],
          ["Anno", "Produttore", "Tipologia", "Produzione", "Variet\u00e0",
           "Clone", "Port.", "Quantit\u00e0", ""],
          S13_ROWS, row_h=32, head_h=34,
          align=["left", "left", "left", "left", "left", "left", "left",
                 "right", "center"], fs=9)
    pg.text(X, Y + H - 24, tw, 16, "Inserimento dati disponibile solo da PC "
            "(\u22651024 dp). Nessuna data: il lotto ha l'anno di "
            "conferimento.", fs=8, fc=INK300)
    drawer(pg, X + tw + 20, Y, 420, H - 20, "Nuovo lotto",
           [("Anno di conferimento", "2026", ""),
            ("Produttore", "Donati", ""),
            ("Tipologia", "Barbatelle innestate", ""),
            ("Produzione", "Nuova produzione", ""),
            ("Codice variet\u00e0", "CH-01", "focus"),
            ("Codice clone", "Seleziona prima la variet\u00e0", "disabled"),
            ("Codice portainnesto", "1103P", ""),
            ("Quantit\u00e0 (interi, no decimali)", "1250", ""),
            ("Note", "", "")],
           [("Salva", "primary"), ("Salva e nuovo", "secondary"),
            ("Annulla", "ghost")],
           note="F-V2: il select dei cloni resta disabilitato finch\u00e9 la "
                "variet\u00e0 non \u00e8 scelta. quantita \u00e8 integer.")


def s14_content(pg, X, Y, W, H):
    tw = W - 440
    pg.box(X, Y, 210, 34, fill=SURF, stroke=INK300, sw=1,
           text="\U0001F50D  Cerca impegno", fs=10, fc=INK500, align="left",
           extra="spacingLeft=10", rnd=True)
    for i, val in enumerate(["Spedito: tutti \u25be", "Variet\u00e0 \u25be",
                             "Anno \u25be"]):
        pg.box(X + 218 + i * 122, Y, 114, 34, fill=SURF, stroke=INK300, sw=1,
               text=val, fs=10, fc=INK700, rnd=True)
    pg.box(X + tw - 196, Y, 90, 34, fill=SURF, stroke=B600, sw=1,
           text="Importa", fs=10, fc=B600, bold=True, rnd=True)
    pg.box(X + tw - 100, Y, 100, 34, fill=B600, stroke=NONE, text="+ Nuovo",
           fs=10, fc="#FFFFFF", bold=True, rnd=True)
    pg.text(X, Y + 42, tw, 16, "312 impegni \u00b7 23 non spediti \u00b7 "
            "nessun campo cliente nello schema", fs=9, fc=INK500)
    table(pg, X, Y + 62, [150, 118, 112, 56, 50, 70, 70, 78],
          ["Lotto collegato", "Tipologia", "Produzione", "Variet\u00e0",
           "Clone", "Port.", "Quantit\u00e0", "Spedito"],
          S14_ROWS, row_h=32, head_h=34,
          align=["left", "left", "left", "left", "left", "left", "right",
                 "center"], fs=9)
    pg.text(X, Y + 62 + 34 + 5 * 32 + 12, tw, 44,
            "Il flag \u00abSpedito\u00bb si attiva inline con undo di 8 s e "
            "alimenta \u00abDi cui spedito\u00bb nei riepiloghi. Nessuna data "
            "di spedizione: la colonna non esiste. Con il lotto collegato "
            "l'impegno entra nella colonna del produttore (Report 2), "
            "altrimenti in \u00abNon attribuito\u00bb.", fs=8, fc=INK300,
            valign="top")
    drawer(pg, X + tw + 20, Y, 420, H - 20, "Nuovo impegno",
           [("Lotto collegato", "Donati \u00b7 2026 \u00b7 CH-01 \u00b7 CL-3",
             "focus"),
            ("Tipologia", "Barbatelle innestate", ""),
            ("Produzione", "Nuova produzione", ""),
            ("Codice variet\u00e0", "CH-01 (dal lotto)", ""),
            ("Codice clone", "CL-3 (dal lotto)", ""),
            ("Codice portainnesto", "1103P", ""),
            ("Quantit\u00e0 ordinata", "1200", ""),
            ("Spedito", "non ancora spedito", "toggle"),
            ("Note", "", "")],
           [("Salva", "primary"), ("Annulla", "ghost")],
           note="Scegliendo il lotto, tipologia/produzione/variet\u00e0/clone/"
                "portainnesto si compilano ma restano modificabili.")


def s13l_content(pg, X, Y, W):
    pg.box(X + W / 2 - 34, Y + 150, 68, 68, fill=CANVAS, stroke=LINE, sw=1,
           rnd=True, text="\U0001F512", fs=26, fc=INK500)
    pg.text(X, Y + 236, W, 44, "Inserimento dati disponibile solo da PC",
            fs=15, fc=INK900, bold=True, align="center")
    pg.text(X, Y + 292, W, 80,
            "Registra lotti e ordini da un computer.\nDa smartphone puoi "
            "consultare i riepiloghi.", fs=11, fc=INK500, align="center",
            valign="top")
    pg.box(X + 24, Y + 392, W - 48, 46, fill=B600, stroke=NONE,
           text="Vai ai riepiloghi", fs=12, fc="#FFFFFF", bold=True, rnd=True)
    pg.box(X + 24, Y + 448, W - 48, 42, fill=SURF, stroke=B600, sw=1,
           text="Copia link per il PC", fs=11, fc=B600, bold=True, rnd=True)
    pg.text(X, Y + 516, W, 40, "Nessun modulo parziale: la rotta di "
            "inserimento \u00e8 bloccata sotto 1024 dp, non adattata.", fs=9,
            fc=INK300, align="center", valign="top")


def page05():
    pg = Page("p05", "05 \u00b7 Inserimento dati (solo PC)", 2280, 1880)
    page_title(pg, "Inserimento dati \u00b7 solo da PC",
               "Campi esattamente come da schema: anno_conferimento, "
               "produttore, tipologia (4 valori), produzione (3 valori), "
               "variet\u00e0, clone dipendente, portainnesto, quantita intera.")
    desktop(pg, 80, 130, 1500, 760, "/dati/lotti", "Lotti magazzino",
            "Dati / Lotti magazzino", "AMMINISTRATORE", 2, s13_content)
    desktop(pg, 80, 990, 1500, 760, "/dati/ordini", "Ordini e impegni",
            "Dati / Ordini e impegni", "AMMINISTRATORE", 2, s14_content)
    phone(pg, 1700, 130, "S-13L", "Dati", "AMMINISTRAT.", TABS_4, 3,
          s13l_content)
    caption(pg, 80, 900, 1500, "S-13", "Lotti magazzino (PC)",
            "Drawer laterale \u00b7 variet\u00e0 ricercabile \u00b7 clone "
            "disabilitato finch\u00e9 la variet\u00e0 non \u00e8 scelta (F-V2) "
            "\u00b7 portainnesto solo da anagrafica \u00b7 quantit\u00e0 "
            "intera \u00b7 Salva e nuovo per l'inserimento a raffica \u00b7 "
            "righe con (non indicata) visibili e segnalate")
    caption(pg, 80, 1760, 1500, "S-14", "Ordini e impegni (PC)",
            "Nessun campo cliente: l'impegno punta a un lotto (id_magazzino) "
            "\u00b7 Spedito \u00e8 un booleano con undo di 8 s, senza data "
            "\u00b7 tipologia/produzione obbligatorie e precompilate dal lotto "
            "\u00b7 impegni senza lotto finiscono in \u00abNon attribuito\u00bb")
    caption(pg, 1700, 990, 390, "S-13L", "Blocco PC-only",
            "\u00b7 qualsiasi rotta /dati/* sotto 1024 dp\n"
            "\u00b7 nessun campo, nessuna tabella parziale\n"
            "\u00b7 scorciatoia ai riepiloghi e copia del link")
    return pg


# ==========================================================================
# PAGE 06 - import + master data
# ==========================================================================
def s15_content(pg, X, Y, W, H):
    steps = ["1  Carica file", "2  Mappa colonne", "3  Valida", "4  Importa"]
    cw = (W - 24) / 4.0
    for i, label in enumerate(steps):
        active = (i == 2)
        done = (i < 2)
        fill = B600 if active else (B50 if done else CANVAS)
        fc = "#FFFFFF" if active else (B600 if done else INK500)
        pg.box(X + i * (cw + 8), Y, cw, 44, fill=fill, stroke=LINE, sw=1,
               text=("\u2713  " if done else "") + label, fs=10, fc=fc,
               bold=(active or done), rnd=True)

    y = Y + 58
    pg.box(X, y, W, 40, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(X + 14, y, 220, 40, "412 righe lette \u00b7 409 valide", fs=10,
            fc=INK700, bold=True)
    pg.pill(X + 240, y + 9, 108, 22, "3 con errori", fill=D50, fc=D700, fs=9)
    pg.pill(X + 356, y + 9, 96, 22, "5 avvisi", fill=WARN50, fc=WARN, fs=9)
    pg.text(X + W - 300, y, 286, 40, "lotti_ottobre.xlsx \u00b7 foglio "
            "\u00abLotti\u00bb", fs=9, fc=INK500, align="right")

    rows = [
        {"cells": ["47", "Codice variet\u00e0", "CH-99",
                   "Non presente in anagrafica_vite"], "kind": "negative"},
        {"cells": ["112", "Codice clone", "CL-3",
                   "Il clone CL-3 non appartiene alla variet\u00e0 CH-02"],
         "kind": "negative"},
        {"cells": ["238", "Quantit\u00e0", "-40",
                   "La quantit\u00e0 deve essere un intero \u2265 0"],
         "kind": "negative"},
    ]
    table(pg, X, Y + 110, [70, 150, 110, 570],
          ["Riga", "Colonna", "Valore", "Motivo"], rows, row_h=32, head_h=32,
          align=["left", "left", "left", "left"], fs=10)
    wy = Y + 110 + 32 + 3 * 32 + 12
    pg.box(X, wy, W, 66, fill=WARN50, stroke=WARN, sw=1, rnd=True)
    pg.text(X + 14, wy + 6, W - 28, 54,
            "\u26a0 5 avvisi non bloccanti: 3 righe duplicate nel file, 2 "
            "quantit\u00e0 a zero.\nProduttore assente in 12 righe: verr\u00e0 "
            "importato come \u00abNon attribuito\u00bb.", fs=9, fc="#92400E",
            valign="top")

    by = Y + H - 44
    pg.box(X, by, 240, 36, fill=SURF, stroke=B600, sw=1,
           text="Scarica CSV degli errori", fs=10, fc=B600, bold=True,
           rnd=True)
    pg.box(X + 250, by, 150, 36, fill=NONE, stroke=LINE, sw=1, text="Annulla",
           fs=10, fc=INK500, rnd=True)
    pg.box(X + W - 170, by, 170, 36, fill="#CBD5E1", stroke=NONE,
           text="Avanti (0 errori)", fs=10, fc="#64748B", bold=True, rnd=True)
    pg.text(X, by - 26, W, 20, "Nessuna riga viene scritta nel database prima "
            "del passo 4. Errori esportabili e correggibili.", fs=8,
            fc=INK300)


S16_GROUPS = [
    ("CH-01", [("CL-1", "12 utilizzi"), ("CL-2", "8 utilizzi")]),
    ("CH-02", [("CL-1", "5 utilizzi"), ("CL-3", "2 utilizzi")]),
    ("TR-04", [("CL-1", "3 utilizzi")]),
]


def s16_content(pg, X, Y, W, H):
    pg.box(X, Y, 200, 34, fill=SURF, stroke=INK300, sw=1,
           text="\U0001F50D  Cerca variet\u00e0 o clone", fs=10, fc=INK500,
           align="left", extra="spacingLeft=10", rnd=True)
    pg.box(X + 208, Y, 150, 34, fill=SURF, stroke=INK300, sw=1,
           text="Variet\u00e0 \u25be", fs=10, fc=INK700, rnd=True)
    pg.box(X + W - 330, Y, 150, 34, fill=SURF, stroke=B600, sw=1,
           text="Aggiungi in blocco", fs=10, fc=B600, bold=True, rnd=True)
    pg.box(X + W - 170, Y, 170, 34, fill=B600, stroke=NONE,
           text="+ Variet\u00e0 / clone", fs=10, fc="#FFFFFF", bold=True,
           rnd=True)
    pg.text(X, Y + 44, W, 16, "anagrafica_vite: una riga per coppia "
            "(codice_varieta, codice_clone) \u2014 nessun campo descrizione",
            fs=9, fc=INK500)

    widths = [150, 150, 130, 120, 100]
    heads = ["Codice variet\u00e0", "Codice clone", "Utilizzi", "Stato", ""]
    cx = X
    for i, head in enumerate(heads):
        pg.box(cx, Y + 66, widths[i], 32, fill=CANVAS, stroke=LINE, sw=1,
               text=head, fs=10, fc=INK900, bold=True, align="left",
               extra="spacingLeft=8")
        cx += widths[i]
    ry = Y + 98
    for code, pairs in S16_GROUPS:
        pg.box(X, ry, sum(widths), 28, fill=B50, stroke=LINE, sw=1)
        pg.text(X + 10, ry, 300, 28, "\u25a6 " + code + " \u2014 " +
                str(len(pairs)) + " cloni", fs=10, fc=B600, bold=True)
        pg.text(X + sum(widths) - 120, ry, 110, 28, "+ Aggiungi clone", fs=9,
                fc=B600, bold=True, align="right")
        ry += 28
        for i, (clone, uses) in enumerate(pairs):
            vals = [code if i == 0 else "", clone, uses, "attivo",
                    "\u270e \u2715"]
            cx = X
            for j, v in enumerate(vals):
                pg.box(cx, ry, widths[j], 30, fill=SURF, stroke=LINE, sw=1,
                       text=v, fs=10, fc=(INK900 if j < 2 else INK700),
                       mono=(j < 2), bold=(j == 0),
                       align=("center" if j == 4 else "left"),
                       extra="spacingLeft=8")
                cx += widths[j]
            ry += 30
    pg.text(X, ry + 10, W, 40,
            "Una \u00abvariet\u00e0\u00bb \u00e8 l'insieme delle sue coppie: "
            "cancellare l'ultimo clone elimina la variet\u00e0 da tutti i "
            "select (conferma M-01). Le coppie usate da lotti o impegni non "
            "sono cancellabili: solo disattivabili.", fs=9, fc=INK300,
            valign="top")


def s17_content(pg, X, Y, W, H):
    pg.box(X, Y, 200, 34, fill=SURF, stroke=INK300, sw=1,
           text="\U0001F50D  Cerca portainnesto", fs=10, fc=INK500,
           align="left", extra="spacingLeft=10", rnd=True)
    pg.box(X + W - 180, Y, 180, 34, fill=B600, stroke=NONE,
           text="+ Portainnesto", fs=10, fc="#FFFFFF", bold=True, rnd=True)
    pg.text(X, Y + 44, W, 16, "anagrafica_portainnesto: solo il codice, "
            "nessuna descrizione", fs=9, fc=INK500)
    rows = [
        {"cells": ["1103P", "148 utilizzi", "attivo", "\u270e \u2715"],
         "kind": "zebra"},
        {"cells": ["140Ru", "96 utilizzi", "attivo", "\u270e \u2715"],
         "kind": ""},
        {"cells": ["SO4", "64 utilizzi", "attivo", "\u270e \u2715"],
         "kind": "zebra"},
        {"cells": ["K5BB", "31 utilizzi", "attivo", "\u270e \u2715"],
         "kind": ""},
        {"cells": ["420A", "0 utilizzi", "disattivato", "\u270e \u2715"],
         "kind": "zebra"},
        {"cells": ["Fercal", "2 utilizzi", "attivo", "\u270e \u2715"],
         "kind": ""},
    ]
    table(pg, X, Y + 66, [200, 160, 160, 120],
          ["Codice portainnesto", "Utilizzi", "Stato", ""], rows, row_h=32,
          head_h=32, align=["left", "left", "left", "center"],
          fs=10)
    pg.text(X, Y + 66 + 32 + 6 * 32 + 14, W, 44,
            "Il codice portainnesto \u00e8 la chiave di raggruppamento di "
            "tutti e tre i riepiloghi. Un codice disattivato sparisce dai "
            "select di inserimento ma resta visibile nei report storici con "
            "il chip \u00abinattivo\u00bb.", fs=9, fc=INK300, valign="top")


def page06():
    pg = Page("p06", "06 \u00b7 Import e anagrafiche", 2600, 1860)
    page_title(pg, "Import Excel e anagrafiche",
               "Import in quattro passi con validazione obbligatoria; "
               "anagrafiche come unico vocabolario di variet\u00e0, cloni e "
               "portainnesti.")
    desktop(pg, 80, 130, 1180, 740, "/dati/import", "Importa Excel",
            "Dati / Importa Excel", "AMMINISTRATORE", 2, s15_content)
    desktop(pg, 1340, 130, 1180, 740, "/anagrafiche/vite",
            "Anagrafica vite", "Anagrafiche / Vite", "AMMINISTRATORE", 3,
            s16_content)
    desktop(pg, 80, 980, 1180, 740, "/anagrafiche/portainnesti",
            "Anagrafica portainnesto", "Anagrafiche / Portainnesti",
            "AMMINISTRATORE", 3, s17_content)
    caption(pg, 80, 900, 1180, "S-15", "Import Excel (PC)",
            "Passi 1\u20134 con stepper \u00b7 nessuna scrittura prima della "
            "conferma \u00b7 errori per riga/colonna/valore/motivo, "
            "esportabili in CSV \u00b7 avanti bloccato finch\u00e9 restano "
            "errori \u00b7 campi obbligatori per tabella da \u00a73.4")
    caption(pg, 1340, 900, 1180, "S-16", "Anagrafica vite (PC)",
            "Una riga per coppia variet\u00e0+clone \u00b7 raggruppamento "
            "visivo per variet\u00e0 \u00b7 aggiunta in blocco \u00b7 "
            "duplicati rifiutati lato client (manca il vincolo UNIQUE nel DB)")
    caption(pg, 80, 1750, 1180, "S-17", "Anagrafica portainnesto (PC)",
            "Solo codice \u00b7 coppie usate non cancellabili, solo "
            "disattivabili \u00b7 il codice \u00e8 la chiave di "
            "raggruppamento dei riepiloghi")
    return pg


# ==========================================================================
# PAGE 07 - administration
# ==========================================================================
S18_FIELDS = [
    ("Anno di conferimento", "Selezione anno", "obbligatorio"),
    ("Produttore", "Selezione", "obbligatorio"),
    ("Tipologia", "Selezione (4 valori)", "obbligatorio"),
    ("Produzione", "Selezione (3 valori)", "obbligatorio"),
    ("Codice variet\u00e0", "Selezione ricercabile", "obbligatorio"),
    ("Codice clone", "Selezione \u00b7 dipende da variet\u00e0", "obbligatorio"),
    ("Codice portainnesto", "Selezione", "obbligatorio"),
    ("Quantit\u00e0", "Numero intero", "obbligatorio"),
    ("Note", "Testo lungo", "facoltativo"),
]


def s18_content(pg, X, Y, W, H):
    left = 250
    right = 330
    centre = W - left - right - 24
    pg.box(X, Y, left, H - 20, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.text(X + 12, Y + 8, left - 24, 20, "Schermate", fs=11, fc=INK900,
            bold=True)
    for i, (name, state, fill, fc) in enumerate([
            ("Lotti magazzino", "pubblicata", B50, B600),
            ("Ordini e impegni", "bozza", WARN50, WARN)]):
        yy = Y + 36 + i * 62
        pg.box(X + 10, yy, left - 20, 54,
               fill=(B50 if i == 0 else SURF), stroke=LINE, sw=1, rnd=True)
        pg.text(X + 20, yy + 6, left - 40, 18, name, fs=10,
                fc=(B600 if i == 0 else INK900), bold=True)
        pg.pill(X + 20, yy + 28, 74, 18, state, fill=fill, fc=fc, fs=8)
    pg.box(X + 10, Y + H - 76, left - 20, 34, fill=SURF, stroke=INK300, sw=1,
           text="+ Nuova schermata", fs=10, fc=INK700, bold=True, rnd=True)

    cx = X + left + 12
    pg.box(cx, Y, 90, 30, fill=SURF, stroke=INK300, sw=1, text="Anteprima",
           fs=9, fc=INK700, rnd=True)
    pg.box(cx + 98, Y, 96, 30, fill=SURF, stroke=B600, sw=1,
           text="Salva bozza", fs=9, fc=B600, bold=True, rnd=True)
    pg.box(cx + centre - 96, Y, 96, 30, fill=B600, stroke=NONE, text="Pubblica",
           fs=9, fc="#FFFFFF", bold=True, rnd=True)
    fy = Y + 42
    pg.text(cx, fy, centre, 16, "DATI DEL LOTTO", fs=9, fc=INK500, bold=True)
    fy += 20
    for label, kind, req in S18_FIELDS:
        pg.box(cx, fy, centre, 40, fill=SURF, stroke=LINE, sw=1, rnd=True)
        pg.text(cx + 8, fy, 16, 40, "\u28ff", fs=11, fc=INK300,
                align="center")
        pg.text(cx + 28, fy, 200, 40, label, fs=10, fc=INK900, bold=True)
        pg.pill(cx + 236, fy + 10, 130, 20, kind, fill=CANVAS, fc=INK500,
                fs=8)
        pg.pill(cx + centre - 92, fy + 10, 84, 20, req,
                fill=(WARN50 if req == "obbligatorio" else CANVAS),
                fc=(WARN if req == "obbligatorio" else INK500), fs=8)
        fy += 44

    rx = X + W - right
    pg.box(rx, Y, right, H - 20, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.text(rx + 12, Y + 8, right - 24, 20, "Trascina un nuovo campo",
            fs=10, fc=INK500, bold=True)
    pal = ["Testo", "Numero", "Anno", "Selezione", "Selezione ricercabile",
           "Casella", "Testo lungo", "Sezione"]
    for i, name in enumerate(pal):
        cw2 = (right - 36) / 2.0
        px = rx + 12 + (i % 2) * (cw2 + 12)
        py = Y + 34 + (i // 2) * 42
        pg.box(px, py, cw2, 34, fill=CANVAS, stroke=INK300, sw=1, text=name,
               fs=9, fc=INK700, rnd=True)
    py = Y + 34 + 4 * 42 + 12
    pg.text(rx + 12, py, right - 24, 20, "Propriet\u00e0 \u00b7 Codice clone",
            fs=10, fc=INK900, bold=True)
    py += 24
    props = [("Etichetta", "Codice clone"),
             ("Nome campo (API)", "codice_clone"),
             ("Origine dati", "anagrafica_vite.cloni"),
             ("Dipende da", "Codice variet\u00e0 (F-V2)"),
             ("Obbligatorio", "s\u00ec \u00b7 campo di sistema \U0001F512"),
             ("Visibile ai ruoli", "Admin, Amministrazione")]
    for label, value in props:
        pg.text(rx + 12, py, right - 24, 12, label, fs=8, fc=INK500)
        pg.box(rx + 12, py + 13, right - 24, 26, fill=(CANVAS if "sistema" in
                                                      value else SURF),
               stroke=LINE, sw=1, text=value, fs=9,
               fc=(INK500 if "sistema" in value else INK700), align="left",
               extra="spacingLeft=8", rnd=True)
        py += 44
    pg.text(rx + 12, Y + H - 66, right - 24, 48,
            "I campi di sistema (anno, variet\u00e0, clone, portainnesto, "
            "quantit\u00e0) non sono eliminabili n\u00e9 facoltativi: la "
            "validazione dipende da loro.", fs=8, fc=INK300, valign="top")


def s19_content(pg, X, Y, W, H):
    pg.box(X, Y, 200, 34, fill=SURF, stroke=INK300, sw=1,
           text="\U0001F50D  Cerca utente", fs=10, fc=INK500, align="left",
           extra="spacingLeft=10", rnd=True)
    pg.box(X + W - 160, Y, 160, 34, fill=B600, stroke=NONE,
           text="+ Nuovo utente", fs=10, fc="#FFFFFF", bold=True, rnd=True)
    users = [
        {"cells": ["Marco Rossi", "marco@vivaio.it", "Produttore",
                   "Mori Marco", "attivo", "12 min fa"], "kind": "zebra"},
        {"cells": ["Giulia Bianchi", "giulia@vivaio.it", "Vendite", "\u2014",
                   "attivo", "2 h fa"], "kind": ""},
        {"cells": ["Anna Verdi", "anna@vivaio.it", "Amministrazione", "\u2014",
                   "attivo", "ieri"], "kind": "zebra"},
        {"cells": ["Paolo Neri", "paolo@vivaio.it", "Amministratore", "\u2014",
                   "attivo", "3 g fa"], "kind": ""},
        {"cells": ["Luca Gialli", "luca@vivaio.it", "Produttore", "Donati",
                   "disattivato", "3 mesi fa"], "kind": "zebra"},
    ]
    table(pg, X, Y + 46, [160, 190, 130, 140, 110, 90],
          ["Nome", "Email", "Ruolo", "Produttore collegato", "Stato",
           "Ultimo accesso"], users, row_h=32, head_h=32,
          align=["left", "left", "left", "left", "left", "right"], fs=9)

    my = Y + 46 + 32 + 5 * 32 + 24
    pg.text(X, my, W, 20, "Matrice dei permessi applicata (sola lettura)",
            fs=11, fc=INK900, bold=True)
    perms = ["Riepilogo disponibilit\u00e0", "Riepilogo per produttore",
             "Indisponibilit\u00e0", "Lotti e ordini", "Form builder"]
    mat = []
    for p in perms:
        marks = {"Riepilogo disponibilit\u00e0": ["R", "R", "R", "R"],
                 "Riepilogo per produttore": ["R", "R", "\u2014", "\u2014"],
                 "Indisponibilit\u00e0": ["R", "R", "R", "\u2014"],
                 "Lotti e ordini": ["E", "E", "\u2014", "\u2014"],
                 "Form builder": ["E", "\u2014", "\u2014", "\u2014"]}[p]
        mat.append({"cells": [p] + marks, "kind": ""})
    table(pg, X, my + 26, [280, 130, 130, 130, 130],
          ["Capacit\u00e0", "Amministratore", "Amministrazione", "Produttore",
           "Vendite"], mat, row_h=28, head_h=28,
          align=["left", "center", "center", "center", "center"], fs=9)
    pg.text(X, my + 26 + 28 + 5 * 28 + 12, W, 32,
            "Gli utenti \u00abProduttore\u00bb sono collegati 1:1 a un "
            "produttore dell'elenco chiuso. L'ultimo amministratore non pu\u00f2 "
            "essere disattivato.", fs=9, fc=INK300, valign="top")


def page07():
    pg = Page("p07", "07 \u00b7 Amministrazione", 1620, 1940)
    page_title(pg, "Amministrazione \u00b7 form builder e utenti",
               "Solo Amministratore. Il form builder modifica le schermate di "
               "inserimento senza un deploy; i campi di sistema restano "
               "protetti.")
    desktop(pg, 80, 130, 1400, 800, "/config/form", "Form builder",
            "Configurazione / Form builder", "AMMINISTRATORE", 4, s18_content)
    desktop(pg, 80, 1030, 1180, 780, "/config/utenti", "Utenti e ruoli",
            "Configurazione / Utenti e ruoli", "AMMINISTRATORE", 4,
            s19_content)
    caption(pg, 80, 940, 1400, "S-18", "Form builder (PC)",
            "Tre pannelli: schermate \u00b7 canvas dei campi con riordino \u00b7 "
            "palette e propriet\u00e0. Pubblica genera una versione "
            "ripristinabile; le bozze non sono mai visibili in inserimento.")
    caption(pg, 80, 1820, 1180, "S-19", "Utenti e ruoli (PC)",
            "Quattro ruoli \u00b7 utente Produttore collegato a un produttore "
            "\u00b7 reset password via link \u00b7 matrice dei permessi "
            "mostrata in sola lettura, identica ai guard di rotta")
    return pg


# ==========================================================================
# PAGE 08 - overlays and states
# ==========================================================================
def m01_sheet(pg, X, Y, W):
    pg.box(X, Y, W, 26, fill=NONE, stroke=NONE, text="\u26a0", fs=14, fc=D600,
           align="left")
    pg.text(X + 24, Y, W - 24, 26, "Eliminare il lotto?", fs=13, fc=INK900,
            bold=True)
    pg.box(X, Y + 34, W, 56, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(X + 10, Y + 40, W - 20, 44,
            "2026 \u00b7 Donati \u00b7 CH-01 \u00b7 CL-3 \u00b7 1103P\n"
            "Quantit\u00e0 1.250 piante", fs=10, fc=INK700, valign="top")
    pg.box(X, Y + 100, W, 58, fill=D50, stroke=D600, sw=1, rnd=True)
    pg.text(X + 10, Y + 106, W - 20, 46,
            "Referenziato da 3 impegni. Verr\u00e0 rimosso dai riepiloghi: la "
            "disponibilit\u00e0 cambier\u00e0.", fs=9, fc=D700, valign="top")
    pg.text(X, Y + 168, W, 14, "Scrivi CL-3 per confermare", fs=9, fc=INK700,
            bold=True)
    pg.box(X, Y + 184, W, 34, fill=SURF, stroke=D600, sw=1.5, text="",
           rnd=True)
    pg.box(X, Y + 232, W / 2 - 6, 42, fill=SURF, stroke=LINE, sw=1,
           text="Annulla", fs=11, fc=INK700, rnd=True)
    pg.box(X + W / 2 + 6, Y + 232, W / 2 - 6, 42, fill="#CBD5E1", stroke=NONE,
           text="Elimina", fs=11, fc="#64748B", bold=True, rnd=True)
    pg.text(X, Y + 284, W, 16, "il pulsante distruttivo non ha mai il focus "
            "iniziale", fs=8, fc=INK300, align="center")


def m03_content(pg, X, Y, W):
    pg.text(X, Y, W, 18, "Codice variet\u00e0", fs=17, fc=INK900, bold=True)
    pg.text(X + W - 62, Y, 62, 18, "Annulla", fs=10, fc=INK500, align="right")
    pg.box(X, Y + 30, W, 44, fill=SURF, stroke=B600, sw=1.5,
           text="\U0001F50D  c", fs=13, fc=INK900, align="left",
           extra="spacingLeft=12", rnd=True)
    pg.text(X, Y + 84, W, 14, "RECENTI", fs=8, fc=INK500, bold=True)
    ry = Y + 102
    for code, note in [("CH-01", "usata 2 giorni fa")]:
        pg.box(X, ry, W, 46, fill=B50, stroke=LINE, sw=1, rnd=True)
        pg.text(X + 12, ry, 80, 46, code, fs=12, fc=INK900, bold=True,
                mono=True)
        pg.text(X + 96, ry, W - 110, 46, note, fs=9, fc=INK500)
        ry += 46
    pg.text(X, ry + 6, W, 14, "RISULTATI (5)", fs=8, fc=INK500, bold=True)
    ry += 24
    for code, desc in [("CH-01", "Chardonnay \u00b7 2 cloni"),
                       ("CH-02", "Chardonnay 96 \u00b7 2 cloni"),
                       ("CH-03", "Chardonnay bianco \u00b7 1 clone"),
                       ("CH-10", "Chardonnay musqu\u00e9 \u00b7 1 clone")]:
        pg.box(X, ry, W, 46, fill=SURF, stroke=LINE, sw=1)
        pg.text(X + 12, ry, 80, 46, code, fs=11, fc=INK900, bold=True,
                mono=True)
        pg.text(X + 96, ry, W - 110, 46, desc, fs=9, fc=INK700)
        ry += 46
    pg.text(X, ry + 8, W, 30, "La tastiera si apre subito; la ricerca filtra "
            "codice e descrizione senza distinzione di maiuscole o accenti.",
            fs=8, fc=INK300, valign="top")


def m05_content(pg, X, Y, W):
    pg.box(X, Y + 200, W, 260, fill=SURF, stroke=LINE, sw=1.5, rnd=True)
    pg.box(X + W / 2 - 24, Y + 220, 48, 48, fill=D50, stroke=NONE, rnd=True,
           text="\U0001F512", fs=20, fc=D600)
    pg.text(X + 16, Y + 276, W - 32, 40, "Non hai i permessi per questa "
            "sezione", fs=14, fc=INK900, bold=True, align="center")
    pg.text(X + 24, Y + 316, W - 48, 52,
            "Il profilo Vendite pu\u00f2 consultare solo il riepilogo "
            "disponibilit\u00e0.", fs=10, fc=INK500, align="center",
            valign="top")
    pg.box(X + 24, Y + 386, W - 48, 44, fill=B600, stroke=NONE,
           text="Torna alla home", fs=11, fc="#FFFFFF", bold=True, rnd=True)
    pg.text(X, Y + 476, W, 40, "Mai una tabella vuota al posto di un "
            "permesso negato: la rotta \u00e8 bloccata e lo dice.", fs=9,
            fc=INK300, align="center", valign="top")


def state_card(pg, x, y, w, h, title, kind):
    pg.box(x, y, w, h, fill=SURF, stroke=LINE, sw=1, rnd=True)
    pg.box(x, y, w, 30, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(x + 12, y, w - 24, 30, title, fs=10, fc=INK900, bold=True)
    ix = x + 12
    iw = w - 24
    if kind == "empty":
        pg.box(ix, y + 42, iw, 62, fill=OK50, stroke=OK, sw=1, rnd=True)
        pg.text(ix + 8, y + 46, iw - 16, 54,
                "\u2713 Nessuna indisponibilit\u00e0 con i filtri attuali\n"
                "Magazzino \u2265 ordinato su tutti i portainnesti", fs=9,
                fc="#15803D", valign="top")
        pg.text(ix, y + 116, iw, 30, "\u00abVuoto\u00bb non \u00e8 un errore: "
                "ha un'icona, una spiegazione e un'azione.", fs=8, fc=INK300,
                valign="top")
    elif kind == "negative":
        pg.box(ix, y + 42, iw, 74, fill=D50, stroke=LINE, sw=1, rnd=True)
        pg.box(ix, y + 42, 3, 74, fill=D600, stroke=NONE)
        pg.text(ix + 10, y + 46, iw - 20, 18, "\u26a0 CH-01 \u00b7 CL-1", fs=11,
                fc=D700, bold=True)
        pg.text(ix + 10, y + 64, iw - 20, 16, "1103P \u00b7 8.240 totale",
                fs=9, fc=INK500)
        pg.text(ix + 10, y + 84, iw - 20, 24, "\u22121.200", fs=15, fc=D700,
                bold=True)
        pg.text(ix, y + 126, iw, 40, "Rosso = solo sovra-impegnato. Grassetto "
                "+ icona + bordo: mai il colore da solo.", fs=8, fc=INK300,
                valign="top")
    elif kind == "offline":
        pg.box(ix, y + 42, iw, 40, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
        pg.text(ix + 8, y + 46, iw - 16, 32,
                "\u26a0 Offline \u2014 dati al 14:32", fs=9, fc=INK700,
                valign="top")
        pg.box(ix, y + 90, iw, 44, fill=ZEBRA, stroke=LINE, sw=1)
        pg.text(ix + 8, y + 94, iw - 16, 20, "Disponibilit\u00e0 totale · "
                "12.340 (cache)", fs=9, fc=INK300)
        pg.text(ix, y + 146, iw, 44, "I riepiloghi restano leggibili; "
                "l'inserimento \u00e8 disabilitato con il motivo.", fs=8,
                fc=INK300, valign="top")
    else:
        pg.box(ix, y + 42, iw, 70, fill=D50, stroke=D600, sw=1, rnd=True)
        pg.text(ix + 8, y + 46, iw - 16, 62,
                "Impossibile caricare il riepilogo\nid: 7f3c-91ab", fs=9,
                fc=D700, valign="top")
        pg.box(ix, y + 118, 90, 30, fill=SURF, stroke=D600, sw=1,
               text="Riprova", fs=9, fc=D600, bold=True, rnd=True)
        pg.text(ix, y + 158, iw, 32, "Errore in linea nella sezione colpita; "
                "il resto della schermata resta usabile.", fs=8, fc=INK300,
                valign="top")


def page08():
    pg = Page("p08", "08 \u00b7 Overlay e stati", 1930, 1500)
    page_title(pg, "Overlay, conferme e stati",
               "M-01 conferma distruttiva \u00b7 M-03 selettore variet\u00e0 a "
               "schermo intero \u00b7 M-05 accesso negato \u00b7 i quattro "
               "stati di dato che ogni schermata deve gestire.")
    phone(pg, 80, 130, "M-01", "Lotti magazzino", "AMMINISTRAT.", TABS_4, 3,
          lambda p, X, Y, W: s13_content_stub(p, X, Y, W))
    sheet(pg, 80, 130, 300, "M-01", "Elimina lotto", m01_sheet, 440)
    phone(pg, 540, 130, "M-03", "Filtri", "PRODUTTORE", [], 0, m03_content)
    phone(pg, 1000, 130, "M-05", "Indisponibilit\u00e0", "VENDITE", TABS_3, 1,
          m05_content)
    caption(pg, 80, 990, 390, "M-01", "Conferma eliminazione",
            "\u00b7 nome del record e conseguenza\n"
            "\u00b7 type-to-confirm quando il lotto \u00e8 referenziato\n"
            "\u00b7 pulsante distruttivo mai in focus")
    caption(pg, 540, 990, 390, "M-03", "Selettore variet\u00e0",
            "\u00b7 schermo intero, tastiera subito pronta\n"
            "\u00b7 recenti in cima, ricerca su codice e descrizione\n"
            "\u00b7 nessun risultato con azione di azzeramento")
    caption(pg, 1000, 990, 390, "M-05", "Accesso negato",
            "\u00b7 rotta bloccata, non tabella vuota\n"
            "\u00b7 nomina il ruolo e cosa pu\u00f2 fare\n"
            "\u00b7 tornare alla home in un tap")

    titles = [("Stato vuoto (esito positivo)", "empty"),
              ("Riga negativa", "negative"),
              ("Offline con cache", "offline"),
              ("Errore con correlazione", "error")]
    for i, (title, kind) in enumerate(titles):
        state_card(pg, 80 + i * 460, 1090, 430, 210, title, kind)
    return pg


def s13_content_stub(pg, X, Y, W):
    pg.text(X, Y, W, 18, "Dati", fs=17, fc=INK900, bold=True)
    pg.text(X, Y + 30, W, 60,
            "Lo sfondo \u00e8 l'elenco lotti, non una pagina nuova: "
            "l'overlay \u00e8 un livello sopra il contesto.", fs=10, fc=INK300,
            valign="top")
    for i in range(4):
        pg.box(X, Y + 100 + i * 54, W, 46, fill=ZEBRA, stroke=LINE, sw=1,
               text="2026 \u00b7 Donati \u00b7 CH-01 \u00b7 CL-3 \u00b7 1.250",
               fs=9, fc=INK300, align="left", extra="spacingLeft=10")


# ==========================================================================
# PAGE 09 - design system
# ==========================================================================
TOKENS = [
    ("ink-900", INK900, "testi, intestazioni"),
    ("ink-700", INK700, "testo tabella"),
    ("ink-500", INK500, "etichette"),
    ("ink-300", INK300, "disabilitato"),
    ("line", LINE, "bordi, griglia"),
    ("canvas", CANVAS, "sfondo pagina"),
    ("surface", SURF, "card, sheet"),
    ("brand-700", B700, "barra superiore"),
    ("brand-600", B600, "azioni primarie"),
    ("brand-500", B500, "accenti"),
    ("brand-50", B50, "selezione, subtotali"),
    ("success-600", OK, "confermato"),
    ("warn-600", WARN, "avvisi, bozza"),
    ("danger-700", D700, "disponibilit\u00e0 negativa"),
    ("danger-600", D600, "distruttivo"),
    ("danger-50", D50, "fondo riga negativa"),
    ("info-600", INFO, "banner informativo"),
    ("zebra", ZEBRA, "righe alternate"),
]


def page09():
    pg = Page("p09", "09 \u00b7 Design system", 1700, 1340)
    page_title(pg, "Design system \u00b7 token e componenti",
               "Gli stessi token sono usati dalla specifica (\u00a76) e da "
               "ogni frame del mockup: nessun colore cablato nei componenti.")

    pg.text(40, 116, 600, 22, "Colori e token semantici", fs=14, fc=INK900,
            bold=True)
    for i, (name, hexv, use) in enumerate(TOKENS):
        col = i % 6
        row = i // 6
        x = 40 + col * 270
        y = 146 + row * 76
        pg.box(x, y, 254, 64, fill=SURF, stroke=LINE, sw=1, rnd=True)
        pg.box(x + 10, y + 12, 40, 40, fill=hexv, stroke=LINE, sw=0.5,
               rnd=True)
        pg.text(x + 58, y + 10, 186, 16, name, fs=10, fc=INK900, bold=True,
                mono=True)
        pg.text(x + 58, y + 26, 186, 14, hexv, fs=8, fc=INK500, mono=True)
        pg.text(x + 58, y + 40, 186, 16, use, fs=8, fc=INK700)

    pg.text(40, 396, 600, 22, "Tipografia \u00b7 scala e uso", fs=14,
            fc=INK900, bold=True)
    scale = [("display", 26, True, "titolo riepilogo (xs)"),
             ("h1", 20, True, "titolo pagina (md+)"),
             ("h2", 16, True, "intestazione card / gruppo"),
             ("body", 15, False, "testo corrente"),
             ("body-strong", 15, True, "codice clone"),
             ("label", 13, True, "etichette, chip, tab"),
             ("caption", 12, False, "metadati, \u00abaggiornato 14:32\u00bb"),
             ("num-strong", 15, True, "subtotali e valori negativi"),
             ("table", 13, False, "griglia dati (md+)")]
    for i, (name, size, bold, use) in enumerate(scale):
        y = 426 + i * 30
        pg.text(40, y, 140, 26, name, fs=9, fc=INK500, mono=True)
        pg.text(180, y, 420, 26, "Disponibilit\u00e0 1.250 \u00b7 \u2212450",
                fs=size, fc=INK900, bold=bold)
        pg.text(620, y, 60, 26, str(size) + " px", fs=9, fc=INK500)
        pg.text(700, y, 560, 26, use, fs=9, fc=INK500)
    pg.text(40, 700, 1200, 20, "Numeri sempre tabular-nums, allineati a "
            "destra. Formato italiano: 1.250 (nessun decimale: quantita \u00e8 "
            "integer).", fs=9, fc=INK300)

    pg.text(40, 736, 600, 22, "Componenti chiave", fs=14, fc=INK900, bold=True)
    pg.box(40, 766, 380, 250, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(52, 774, 356, 18, "Card di gruppo (xs) \u00b7 C-08/C-11", fs=9,
            fc=INK500, bold=True)
    group_card(pg, 52, 796, 356, "1103P", "8.240", S04_GROUPS[0][2][:2])

    pg.box(444, 766, 640, 250, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(456, 774, 600, 18, "Righe di griglia (md+) \u00b7 C-10/C-11/C-12",
            fs=9, fc=INK500, bold=True)
    sample = [
        {"cells": ["CL-1", "1103P", "2.400", "3.600", "\u22121.200"],
         "kind": "negative"},
        {"cells": ["CL-2", "1103P", "3.200", "1.800", "1.400"], "kind": ""},
        {"cells": ["Totale portainnesto", "1103P", "8.240", "7.000", "1.240"],
         "kind": "subtotal"},
    ]
    table(pg, 456, 796, [190, 130, 100, 100, 120],
          ["Codice clone", "Portainnesto", "Magazzino", "Ordinato",
           "Disponibilit\u00e0"], sample, row_h=34, head_h=32,
          align=["left", "left", "right", "right", "right"])
    pg.text(456, 940, 610, 60,
            "Negativo: fondo danger-50 + testo danger-700 in grassetto + "
            "bordo sinistro 3 dp + icona \u26a0.\nSubtotale: fondo brand-50, "
            "grassetto, bordo superiore \u2192 \u00abTotale portainnesto\u00bb "
            "+ codice.", fs=9, fc=INK700, valign="top")

    pg.box(1108, 766, 552, 250, fill=CANVAS, stroke=LINE, sw=1, rnd=True)
    pg.text(1120, 774, 520, 18, "Controlli \u00b7 C-06/C-07/C-13/C-17",
            fs=9, fc=INK500, bold=True)
    pg.box(1120, 796, 160, 40, fill=B600, stroke=NONE, text="Salva", fs=11,
           fc="#FFFFFF", bold=True, rnd=True)
    pg.box(1292, 796, 160, 40, fill=SURF, stroke=B600, sw=1,
           text="Annulla", fs=11, fc=B600, bold=True, rnd=True)
    pg.box(1464, 796, 160, 40, fill=D600, stroke=NONE, text="Elimina", fs=11,
           fc="#FFFFFF", bold=True, rnd=True)
    pg.box(1120, 848, 250, 36, fill=SURF, stroke=INK300, sw=1,
           text="Tipologia \u25be", fs=10, fc=INK700, align="left",
           extra="spacingLeft=10", rnd=True)
    pg.box(1382, 848, 242, 36, fill=CANVAS, stroke=LINE, sw=1,
           text="Codice clone (disabilitato)", fs=10, fc=INK300, align="left",
           extra="spacingLeft=10", rnd=True)
    pg.pill(1120, 896, 104, 24, "Totale", fill=B50, fc=B600, fs=9)
    pg.pill(1232, 896, 116, 24, "\u22121.200", fill=D50, fc=D700, fs=9)
    pg.pill(1356, 896, 96, 24, "bozza", fill=WARN50, fc=WARN, fs=9)
    pg.pill(1460, 896, 106, 24, "spedito", fill=INFO50, fc=INFO, fs=9)
    pg.text(1120, 934, 520, 66,
            "Target minimi 44 \u00d7 44 dp con 8 dp di distanza. Anello di "
            "focus brand-600 2 dp con offset 2 dp. Il colore non \u00e8 mai "
            "l'unico portatore di significato: sempre icona o etichetta "
            "accanto.", fs=9, fc=INK700, valign="top")
    return pg


# ==========================================================================
# build
# ==========================================================================
def build():
    pages = [page00(), page01(), page02(), page03(), page04(), page05(),
             page06(), page07(), page08(), page09()]
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<mxfile host="app.diagrams.net" agent="fede-spec-generator" '
           'version="24.7.17" type="device">']
    for pg in pages:
        out.append(pg.xml())
    out.append("</mxfile>")
    xml = "\n".join(out)
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "fede-magazzino-mockup.drawio")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(xml)
    cells = sum(len(p.cells) for p in pages)
    print("wrote %s" % path)
    print("pages: %d  cells: %d  size: %.1f KB" %
          (len(pages), cells, len(xml.encode("utf-8")) / 1024.0))
    return path


if __name__ == "__main__":
    import xml.etree.ElementTree as ET
    path = build()
    ET.parse(path)
    print("XML parse: OK")
