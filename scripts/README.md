# Development scripts

These are optional tools used to build the demo data. They are **not** needed to run the app.

They expect the database credentials file at `../db_access` (outside this repository, never committed):

```
host=db.<project-ref>.supabase.co
port=5432
database=postgres
user=postgres
password=<secret>
```

Use `python3 -m venv .venv && .venv/bin/pip install psycopg2-binary`, then:

| Script | Purpose |
|---|---|
| `db_probe.py` | Finds a reachable Supabase pooler endpoint (IPv4) and verifies the login |
| `db_introspect.py` | Prints relations, columns, constraints and distinct dimension values |
| `export_snapshot.py` | Exports the real data to `../.local/snapshot.real.json` + the report views to `../.local/views.json` |
| `anonymize_snapshot.py` | Builds the published `data/snapshot.json`: real structure, synthetic quantities |

Note: `db.<ref>.supabase.co` is IPv6-only on current Supabase projects; the pooler host
`aws-0-<region>.pooler.supabase.com` (user `postgres.<ref>`) is the IPv4 path.
