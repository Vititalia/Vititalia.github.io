#!/usr/bin/env python3
"""Build the publishable snapshot: real structure, synthetic quantities.

The repo is published through GitHub Pages, so exact commercial figures are
never shipped. Variety/clone/rootstock codes (public ampelography) and the
member-grower names stay, because they are the vocabulary of the UI; only the
quantities are perturbed. Deterministic: same input -> same output.
"""
import json, hashlib, random

SRC = "../.local/snapshot.real.json"
DST = "data/snapshot.json"
OUTLIER_BUMP = 500

def factor(*parts, lo=0.86, hi=1.14):
    h = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    r = int(h[:8], 16) / 0xFFFFFFFF
    return lo + (hi - lo) * r

def q(v, f):
    if not v:
        return 0
    return max(50, int(round(v * f / 50.0)) * 50)

real = json.load(open(SRC, encoding="utf-8"))
lotti = []
for (anno, prod, tipo, prodn, var, clone, root, quant, note) in real["lotti"]:
    f = factor(var, clone, root, prod, "lotto")
    lotti.append([anno, prod, tipo, prodn, var, clone, root, q(quant, f),
                  note or None])

# Every commitment is placed against a warehouse lot (business rule: an order
# always has a producer — a member or "Esterno"). In the source data every order
# has id_magazzino = NULL, so the demo snapshot links each order to the first lot
# with the same dimensions; the store assigns ids 'lot-<n>' by array position.
lot_index = {}
for idx, lot in enumerate(lotti, start=1):
    k = (lot[2], lot[3], lot[4], lot[5], lot[6])
    lot_index.setdefault(k, idx)

ordini = []
linked = 0
for i, (oid, idmag, tipo, prodn, var, clone, root, quant, spedito, note) in enumerate(real["ordini"]):
    f = factor(var, clone, root, str(i), "ordine")
    target = lot_index.get((tipo, prodn, var, clone, root))
    if target:
        linked += 1
    ordini.append(["ord-%04d" % (i + 1),
                   ("lot-%04d" % target) if target else None,
                   tipo, prodn, var, clone, root,
                   q(quant, f), bool(spedito), note or None])

def aggregate(lotti, ordini):
    acc = {}
    for r in lotti:
        k = (r[2], r[3], r[4], r[5], r[6])
        acc.setdefault(k, {"mag": 0, "ord": 0})["mag"] += r[7]
    for r in ordini:
        k = (r[2], r[3], r[4], r[5], r[6])
        acc.setdefault(k, {"mag": 0, "ord": 0})["ord"] += r[7]
    return acc

FIXTURES = "../.local/views.json"
import os as _os
real_neg = set()
if _os.path.exists(FIXTURES):
    real_neg = {(r[0], r[1], r[2], r[3], r[4]) for r in
                json.load(open(FIXTURES, encoding="utf-8"))["negative"]}
key_of_neg = lambda neg: (neg[3], neg[4], neg[0], neg[1], neg[2])  # tipo,prod,var,clone,root

# Guarantee that the published data still demonstrates shortages.
acc = aggregate(lotti, ordini)
for neg in [key_of_neg(n) for n in real_neg]:
    k = neg
    if k not in acc:
        continue
    cur = acc[k]["mag"] - acc[k]["ord"]
    if cur >= 0:
        need = cur + OUTLIER_BUMP
        for o in ordini:
            if (o[2], o[3], o[4], o[5], o[6]) == k:
                o[7] += int(round(need / 50.0) * 50)
                break
        else:
            ordini.append(["ord-x%02d" % len(ordini), None, k[0], k[1], k[2],
                           k[3], k[4], int(round(need / 50.0) * 50), False, None])

snap = {
    "meta": {
        "app": "Vignero \u00b7 Fede Magazzino",
        "demo": True,
        "data_note": ("Struttura e anagrafiche reali; quantit\u00e0 sintetiche "
                      "(nessun dato commerciale pubblicato)."),
        "generated_at": "2026-10-02",
        "tipologie": real["meta"]["tipologie"],
        "produzioni": real["meta"]["produzioni"],
        "produttori": real["meta"]["produttori"],
        "counts": {},
    },
    "viti": real["viti"],
    "portainnesti": real["portainnesti"],
    "lotti": lotti,
    "ordini": ordini,
}
snap["meta"]["counts"] = {"viti": len(lotti and snap["viti"]),
                          "portainnesti": len(snap["portainnesti"]),
                          "lotti": len(lotti), "ordini": len(ordini)}
json.dump(snap, open(DST, "w", encoding="utf-8"), ensure_ascii=False,
          separators=(",", ":"))

acc = aggregate(lotti, ordini)
neg = [k for k, v in acc.items() if v["mag"] - v["ord"] < 0]
keys = len({(r[2], r[3], r[4], r[5], r[6]) for r in lotti} |
           {(r[2], r[3], r[4], r[5], r[6]) for r in ordini})
print("orders linked to a lot: %d/%d" % (linked, len(ordini)))
print("published: viti=%d portainnesti=%d lotti=%d ordini=%d keys=%d negatives=%d"
      % (len(snap["viti"]), len(snap["portainnesti"]), len(lotti),
         len(ordini), keys, len(neg)))
