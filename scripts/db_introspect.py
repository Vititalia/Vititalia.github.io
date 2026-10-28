#!/usr/bin/env python3
"""Read-only introspection of the Fede DB (via the IPv4 pooler)."""
import json, psycopg2

cfg = {}
for line in open("../db_access", encoding="utf-8"):
    line = line.strip().replace("\r", "")
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); cfg[k.strip().lower()] = v.strip()

REF = cfg["host"].split(".")[1]
USER = "%s.%s" % (cfg["user"], REF)   # Supavisor requires the tenant-qualified user
conn = psycopg2.connect(host="aws-0-eu-west-1.pooler.supabase.com", port=5432,
                        dbname=cfg["database"], user=USER,
                        password=cfg["password"], connect_timeout=10,
                        sslmode="require")
cur = conn.cursor()

print("=== relations in public ===")
cur.execute("""select table_name, table_type from information_schema.tables
               where table_schema='public' order by table_type, table_name""")
rels = cur.fetchall()
for name, typ in rels:
    cur.execute('select count(*) from public."%s"' % name)
    print("%-34s %-12s rows=%s" % (name, typ, cur.fetchone()[0]))

print("\n=== columns ===")
cur.execute("""select table_name, column_name, data_type, is_nullable, column_default
               from information_schema.columns where table_schema='public'
               order by table_name, ordinal_position""")
for t, c, d, n, de in cur.fetchall():
    print("%-26s %-22s %-26s null=%-3s default=%s" % (t, c, d, n, (de or "")[:40]))

print("\n=== constraints ===")
cur.execute("""select tc.table_name, tc.constraint_type, tc.constraint_name,
                      kcu.column_name
               from information_schema.table_constraints tc
               left join information_schema.key_column_usage kcu
                 on tc.constraint_name=kcu.constraint_name
                and tc.table_schema=kcu.table_schema
               where tc.table_schema='public'
               order by tc.table_name, tc.constraint_type""")
for r in cur.fetchall():
    print("  %-24s %-12s %-40s %s" % r)

print("\n=== distinct dimension values ===")
for tbl, col in [("lotti_magazzino","tipologia"),("lotti_magazzino","produzione"),
                 ("lotti_magazzino","produttore"),("ordini_impegni","tipologia"),
                 ("ordini_impegni","produzione"),("lotti_magazzino","anno_conferimento")]:
    cur.execute('select %s, count(*) from public.%s group by 1 order by 1 nulls first' % (col, tbl))
    print("  %s.%s -> %s" % (tbl, col, cur.fetchall()))
cur.execute("select count(*), count(distinct codice_varieta), count(distinct codice_clone) from anagrafica_vite")
print("  anagrafica_vite rows/varieta/cloni:", cur.fetchone())
cur.execute("select count(*), count(*) filter (where spedito) from ordini_impegni")
print("  ordini total/spediti:", cur.fetchone())
cur.execute("select count(*) from ordini_impegni where id_magazzino is null")
print("  ordini senza id_magazzino:", cur.fetchone())

print("\n=== anagrafica_vite sample ===")
cur.execute("select codice_varieta, codice_clone from anagrafica_vite order by 1,2 limit 12")
print(" ", cur.fetchall())
print("\n=== portainnesti ===")
cur.execute("select codice_portainnesto from anagrafica_portainnesto order by 1")
print(" ", [r[0] for r in cur.fetchall()])
print("\n=== lotti sample ===")
cur.execute("""select anno_conferimento, produttore, tipologia, produzione,
                      codice_varieta, codice_clone, codice_portainnesto, quantita
               from lotti_magazzino order by created_at desc limit 5""")
for r in cur.fetchall(): print("  ", r)
print("\n=== ordini sample ===")
cur.execute("""select id_magazzino is not null, tipologia, produzione, codice_varieta,
                      codice_clone, codice_portainnesto, quantita, spedito
               from ordini_impegni order by created_at desc limit 5""")
for r in cur.fetchall(): print("  ", r)
conn.close()
