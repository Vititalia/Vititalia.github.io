#!/usr/bin/env python3
"""Probe Supabase pooler endpoints for the project in ../db_access (IPv4 path)."""
import sys, psycopg2

def load(path="db_access"):
    cfg = {}
    for line in open(path, encoding="utf-8"):
        line = line.strip().replace("\r", "")
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            cfg[k.strip().lower()] = v.strip()
    return cfg

cfg = load()
ref = cfg["host"].split(".")[1] if cfg["host"].startswith("db.") else None
cands = []
regions = ["eu-west-1", "eu-central-1", "eu-west-3", "eu-central-2",
           "eu-north-1", "eu-west-2", "us-east-1"]
for r in regions:
    for n in ("aws-0", "aws-1"):
        cands.append("%s-%s.pooler.supabase.com" % (n, r))

users = ["postgres.%s" % ref, "postgres"]
for host in cands:
    for user in users:
        for port in (5432, 6543):
            try:
                c = psycopg2.connect(host=host, port=port, dbname=cfg["database"],
                                     user=user, password=cfg["password"],
                                     connect_timeout=5, sslmode="require")
                cur = c.cursor()
                cur.execute("select current_user, current_database()")
                row = cur.fetchone()
                cur.execute("select count(*) from information_schema.tables "
                            "where table_schema='public'")
                ntab = cur.fetchone()[0]
                print("SUCCESS host=%s port=%s user=%s db=%s tables=%d"
                      % (host, port, row[0], row[1], ntab))
                c.close()
                sys.exit(0)
            except Exception as e:
                msg = str(e).strip().splitlines()[0][:90]
                print("  %-40s:%-4s %-28s %s" % (host, port, user, msg))
print("NO CANDIDATE WORKED")
sys.exit(1)
