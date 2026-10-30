# Database migrations

Applied to the `Vignero` Supabase project (`aewavfybbvksxscpfxbt`).

| # | File | What it does |
|---|---|---|
| 001 | `001_rls_profiles.sql` | Revokes everything from `anon` (this closed a real exposure: the report views returned production quantities to anyone holding the publishable key), adds `profiles` + `auth_role()` / `is_staff()` helpers + the `on_auth_user_created` trigger, enables RLS on the four data tables with staff-only policies, and re-creates the report views with the role filter embedded (`vendite` excluded from the shortage view). |
| 003 | `003_report_views_for_rls.sql` | Adds `riepilogo_per_produttore` and `vista_da_spedire` (staff-only): with RLS on, those two reports can no longer be computed in the browser. |
| 002 | `002_harden_validation_trigger.sql` | Makes `valida_varieta_clone()` `security definer`: without it the trigger's master-data lookup is filtered by the caller's RLS, so non-staff got "il portainnesto non esiste" instead of the real permission error. |
| 004 | `004_user_admin_rpc.sql` | Adds the three staff-only `SECURITY DEFINER` functions the *Utenti* screen needs — `create_user(p_email, p_nome, p_role, p_grower)` (returns a one-time temporary password), `reset_user_password(p_email)` and `delete_user(p_email)` — with the caller's role checked inside; `anon` and non-admins are refused (`Non autorizzato`). Accounts are created in `auth.users` with the token columns initialised to `''` (a NULL token column makes GoTrue answer `500 unexpected_failure`), and the `on_auth_user_created` trigger fills `profiles`. |
| 005 | `005_vista_messo_a_disposizione.sql` | Adds `vista_messo_a_disposizione`: the «Messo a disposizione» report of a producer — their own lots with the commitments recorded on them (magazzino, ordinato, di cui spedito, disponibilità). The view filters by `auth_grower()` inside the definition, so it can never return another producer's rows; `anon` is revoked, `authenticated` keeps `select`. |
| 006 | `006_set_user_password.sql` | Adds `set_user_password(p_email, p_password)`: staff sets a password of their choosing for another account (8–72 characters, not the e-mail address). `is_staff()` decides inside the function, only an administrator may touch an administrator, and the hash is written with `crypt`/`gen_salt` exactly like the generated passwords. Self-service password changes need no SQL: GoTrue's `updateUser` is used after the current password has been verified. |
| 007 | `007_vista_produzioni_alternative.sql` | Adds `vista_produzioni_alternative`: the available quantity of the other produzioni (**Ripiantato**, **Frigoconservato**) joined on the lot reference of a «Nuova produzione» lot — tipologia, codice varietà, codice clone, codice portainnesto, produttore, anno di conferimento — with the commitments subtracted. Visible to all four roles (`auth_role() is not null`), since the availability report is visible to all. |

## Permission model (verified per role)

| | admin | ufficio | produttore | vendite |
|---|---|---|---|---|
| `lotti_magazzino` / `ordini_impegni` / anagrafiche | read + write | read + write | — | — |
| `riepilogo_disponibilita` | ✓ | ✓ | ✓ | ✓ |
| `vista_messo_a_disposizione` (own rows only) | — | — | ✓ | — |
| `vista_produzioni_alternative` | ✓ | ✓ | ✓ | ✓ |
| `vista_disponibilita_negative` | ✓ | ✓ | ✓ | — |
| `vista_lotti_senza_produttore` (no producer column) | ✓ | ✓ | ✓ | ✓ |
| `profiles` | all rows, assign roles | all rows, assign roles | own row | own row |

A signed-up user with no `profiles` row (`role IS NULL`) sees **nothing** — checked.
The three user-admin functions in 004 are **admin-and-ufficio** callable for creation/reset
(checked by role inside the function) and admin-only for deletion; `set_user_password`
(006) follows the same rule, and an administrator's password can only be changed by
another administrator.

## Still to do (needs dashboard/PAT or the secret key)

1. Auth → Sign In / Providers → Email: **turn sign-ups off** — accounts are now created by an administrator from the *Utenti* screen (004).
2. Auth → URL Configuration: Site URL `https://vititalia.github.io/` + same in redirect URLs.
3. Configure a custom SMTP provider if the «Invia email» action is to be used: the built-in mailer allows only a couple of messages per hour.
