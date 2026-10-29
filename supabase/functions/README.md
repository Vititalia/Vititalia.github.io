# Edge Function `send-credentials`

Creates (or resets) a Vignero account **and e-mails the one-time password** to the
person, so an administrator no longer has to copy it by hand.

The static app on GitHub Pages cannot send mail itself: it only has the
`sb_publishable_…` key, and the GoTrue endpoints that send arbitrary mail
(`inviteUserByEmail`, `generateLink`) need the **secret** key, which must never
reach the browser. This function is the missing server piece.

## What it does not do

- It does **not** hold a service-role key for the data work: it calls the same
  `create_user` / `reset_user_password` RPCs the browser calls, authenticated with
  the **caller's own JWT**, so `is_staff()` / `auth_role()` still decide inside the
  database who may do what.
- It never logs the password, and the mail-provider key lives in a function
  secret, not in the bundle.

## Deploy (dashboard, no CLI needed)

1. Supabase → **Edge Functions** → *Create a new function* → name it exactly
   **`send-credentials`**.
2. Replace the generated code with the contents of
   `supabase/functions/send-credentials/index.ts` and press **Deploy**.
3. Leave **“Enforce JWT verification” ON** (the default): the function checks the
   caller itself, and the RPCs refuse anyone who is not staff.
4. **Edge Functions → Secrets** (or Project Settings → Edge Functions → Secrets),
   add one provider:

   | Secret | Value |
   |---|---|
   | `RESEND_API_KEY` | API key from [resend.com](https://resend.com) (free tier: 100 e-mails/day, 3 000/month) |
   | `MAIL_FROM` | `Vignero <noreply@tuodominio.it>` — with Resend the domain must be verified; for a first test `Vignero <onboarding@resend.dev>` works and delivers only to your own address |

   or, instead of Resend:

   | Secret | Value |
   |---|---|
   | `BREVO_API_KEY` | API key from [brevo.com](https://brevo.com) (free tier: 300 e-mails/day) |
   | `MAIL_FROM` | `noreply@tuodominio.it` (must be a verified sender in Brevo) |

   Optional: `SITE_URL` — the link printed in the e-mail (defaults to the request's
   origin, then to `https://vititalia.github.io/`).

5. Reload the app and sign in as an administrator: **Utenti → + Nuovo utente**
   now shows the option *“Invia la password all'indirizzo indicato”* (checked by
   default). The password panel reports whether the e-mail went out.

Nothing else changes: with the function missing — or with no provider secret — the
screen behaves exactly as before (password shown once, `Copia` button, and
`Invia email` sending Supabase's “set your own password” link).

## CLI deploy (alternative)

```bash
supabase functions deploy send-credentials --project-ref aewavfybbvksxscpfxbt
supabase secrets set RESEND_API_KEY=re_… MAIL_FROM="Vignero <noreply@dominio.it>"
```

## Requests it accepts

All calls are `POST` with the user's `Authorization: Bearer <access_token>`.

| `action` | Body | Effect |
|---|---|---|
| `probe` | — | `{ ok, probe: true, mail_ready }` — used by the screen to know whether to offer the option |
| `create` | `email`, `name`, `role`, `grower` | creates the account (**staff only**) and e-mails the password |
| `reset` | `email` | issues a new password (**staff only**) and e-mails it; the old one stops working |
| `resend` | `email`, `name`, `role`, `password` | re-sends a password already on screen (staff check via `profiles`), no new password |

Response (200): `{ email, password, email_sent, provider, mail_error }` — the
password is returned so the panel can still show it as a reminder; it is not
included in the e-mail body when `action = resend`.

Errors: `400` invalid input, `401` missing session, `403` caller not staff,
`404` function not deployed (the client then falls back), `500` no password.

## Testing by hand

```bash
curl -i -X POST "https://aewavfybbvksxscpfxbt.supabase.co/functions/v1/send-credentials" \
  -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" -d '{"action":"probe"}'
```

`mail_ready: false` means the provider secret is missing (deploy the function but
no key set) — the screen then still offers the option, and the panel reports that
the e-mail could not be sent.

## Limits worth knowing

- Resend's free tier delivers only to your own address until a domain is
  verified — for real invitations verify the domain (SPF/DKIM records).
- The function is stateless; there is no retry queue. A failed send is reported in
  the panel, and `Reinvia email` retries.
- Supabase's own mailer (used by the “set your own password” link) stays capped at
  a couple of messages per hour: with this function deployed you rarely need it.
