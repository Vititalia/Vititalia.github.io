# Database migrations

Applied to the `Vignero` Supabase project (`aewavfybbvksxscpfxbt`).

| # | File | What it does |
|---|---|---|
| 001 | `001_rls_profiles.sql` | Revokes everything from `anon` (this closed a real exposure: the report views returned production quantities to anyone holding the publishable key), adds `profiles` + `auth_role()` / `is_staff()` helpers + the `on_auth_user_created` trigger, enables RLS on the four data tables with staff-only policies, and re-creates the report views with the role filter embedded (`vendite` excluded from the shortage view). |
| 002 | `002_harden_validation_trigger.sql` | Makes `valida_varieta_clone()` `security definer`: without it the trigger's master-data lookup is filtered by the caller's RLS, so non-staff got "il portainnesto non esiste" instead of the real permission error. |

## Permission model (verified per role)

| | admin | ufficio | produttore | vendite |
|---|---|---|---|---|
| `lotti_magazzino` / `ordini_impegni` / anagrafiche | read + write | read + write | — | — |
| `riepilogo_disponibilita` | ✓ | ✓ | ✓ | ✓ |
| `vista_disponibilita_negative` | ✓ | ✓ | ✓ | — |
| `vista_lotti_senza_produttore` (no producer column) | ✓ | ✓ | ✓ | ✓ |
| `profiles` | all rows, assign roles | all rows, assign roles | own row | own row |

A signed-up user with no `profiles` row (`role IS NULL`) sees **nothing** — checked.

## Still to do (needs dashboard/PAT or the secret key)

1. Create the four users (Auth → Users, *Auto Confirm*), then set their role:
   `update public.profiles set role = 'admin' where email = '…';`
2. Auth → Sign In / Providers → Email: **turn sign-ups off** after the four exist.
3. Auth → URL Configuration: Site URL `https://gabriele-scivoletto-1992.github.io/Vignero/` + same in redirect URLs.
