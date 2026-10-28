#!/usr/bin/env python3
"""Export a JSON snapshot of the Fede DB (read-only) plus report fixtures.

Writes:
  .local/snapshot.real.json   real data (never committed)
  tests/fixtures/views.json   the DB report views, for engine verification
"""
import json, os, psycopg2

cfg = {}
for line in open("../db_access", encoding="utf-8"):
    line = line.strip().replace("\r", "")
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); cfg[k.strip().lower()] = v.strip()
ref = cfg["host"].split(".")[1]
conn = psycopg2.connect(host="aws-0-eu-west-1.pooler.supabase.com", port=5432,
                        dbname=cfg["database"], user="%s.%s" % (cfg["user"], ref),
                        password=cfg["password"], connect_timeout=10,
                        sslmode="require")
cur = conn.cursor()

cur.execute("select codice_varieta, codice_clone from anagrafica_vite "
            "order by codice_varieta, codice_clone")
viti = [list(r) for r in cur.fetchall()]

cur.execute("select codice_portainnesto from anagrafica_portainnesto order by 1")
portainnesti = [r[0] for r in cur.fetchall()]

cur.execute("""select anno_conferimento, produttore, tipologia, produzione,
                      codice_varieta, codice_clone, codice_portainnesto,
                      quantita, note
               from lotti_magazzino order by created_at, id""")
lotti = [list(r) for r in cur.fetchall()]

cur.execute("""select id, id_magazzino, tipologia, produzione, codice_varieta,
                      codice_clone, codice_portainnesto, quantita, spedito, note
               from ordini_impegni order by created_at, id""")
ordini = [list(r) for r in cur.fetchall()]

cur.execute("""select tipologia, produzione, codice_varieta, codice_clone,
                      codice_portainnesto, giacenza_magazzino, totale_ordinato,
                      di_cui_spedite, quantita_da_spedire, disponibilita_residua
               from riepilogo_disponibilita
               order by codice_portainnesto, codice_clone""")
riepilogo = [list(r) for r in cur.fetchall()]

cur.execute("""select codice_varieta, codice_clone, codice_portainnesto,
                      tipologia, produzione, quantita_magazzino,
                      quantita_impegnata, disponibilita_effettiva
               from vista_disponibilita_negative
               order by codice_varieta, codice_portainnesto, codice_clone""")
negative = [list(r) for r in cur.fetchall()]

TIPOLOGIE = ["Barbatelle innestate", "Barbatelle selvatiche", "Vasetti", "Barbatelloni"]
PRODUZIONI = ["Nuova produzione", "Ripiantato", "Frigoconservato"]
PRODUTTORI = ["Mori Marco", "Donati", "Agriserv", "Vivai riuniti", "Bianchi",
              "Golferenzo", "Lorin", "Esterno"]

snap = {
    "meta": {
        "generated_from": "supabase postgres (public schema)",
        "tipologie": TIPOLOGIE,
        "produzioni": PRODUZIONI,
        "produttori": PRODUTTORI,
        "counts": {"viti": len(viti), "portainnesti": len(portainnesti),
                   "lotti": len(lotti), "ordini": len(ordini)},
    },
    "viti": viti,
    "portainnesti": portainnesti,
    "lotti": lotti,
    "ordini": ordini,
}

os.makedirs("../.local", exist_ok=True)
with open("../.local/snapshot.real.json", "w", encoding="utf-8") as fh:
    json.dump(snap, fh, ensure_ascii=False, separators=(",", ":"))
with open("../.local/views.json", "w", encoding="utf-8") as fh:
    json.dump({"riepilogo": riepilogo, "negative": negative}, fh,
              ensure_ascii=False, separators=(",", ":"))
conn.close()
print("viti=%d portainnesti=%d lotti=%d ordini=%d riepilogo=%d negative=%d"
      % (len(viti), len(portainnesti), len(lotti), len(ordini), len(riepilogo),
         len(negative)))
print("real snapshot bytes:", os.path.getsize("../.local/snapshot.real.json"))
