// Vignero · Edge Function `send-credentials`
//
// Creates (or resets) an account and e-mails the one-time password to the
// person, so the administrator does not have to copy it by hand.
//
// Security model (nothing new is trusted here):
//   * the function never holds the service-role key for the data work — it
//     calls the same SECURITY DEFINER RPCs the browser calls, **with the
//     caller's own JWT**, so `is_staff()` / `auth_role()` decide inside the
//     database whether the request may proceed;
//   * the mail provider key lives in a function secret, never in the bundle;
//   * the password is returned to the caller too (the caller is the staff user
//     who would have read it in the panel anyway) but it is never logged.
//
// Deploy: see supabase/functions/README.md in this repository.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const ROLE_LABEL: Record<string, string> = {
  admin: 'Amministratore',
  ufficio: 'Amministrazione',
  produttore: 'Produttore',
  vendite: 'Vendite',
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function siteUrl(req: Request): string {
  const configured = Deno.env.get('SITE_URL');
  if (configured) return configured.replace(/\/+$/, '') + '/';
  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/+$/, '') + '/';
  return 'https://gabriele-scivoletto-1992.github.io/Vignero/';
}

type Mail = { to: string; subject: string; text: string; html: string };

/** First configured provider wins; both are plain HTTP APIs (no SMTP dependency). */
async function sendMail(mail: Mail): Promise<{ ok: boolean; provider?: string; error?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const brevoKey = Deno.env.get('BREVO_API_KEY');
  const from = Deno.env.get('MAIL_FROM') || 'Vignero <no-reply@example.com>';
  const fromName = Deno.env.get('MAIL_FROM_NAME') || 'Vignero';
  const fromEmail = (from.match(/<([^>]+)>/)?.[1] || from).trim();

  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) return { ok: false, provider: 'resend', error: `resend ${res.status}: ${await res.text()}` };
    return { ok: true, provider: 'resend' };
  }
  if (brevoKey) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
      }),
    });
    if (!res.ok) return { ok: false, provider: 'brevo', error: `brevo ${res.status}: ${await res.text()}` };
    return { ok: true, provider: 'brevo' };
  }
  return { ok: false, error: 'Nessun provider e-mail configurato (RESEND_API_KEY o BREVO_API_KEY)' };
}

function compose(o: {
  name: string; email: string; role: string; password: string; url: string; created: boolean;
}): Mail {
  const who = o.name || o.email;
  const roleLabel = ROLE_LABEL[o.role] || o.role || 'utente';
  const intro = o.created
    ? 'È stato creato per te un accesso a Vignero, l\'applicazione di magazzino di Fede Magazzino.'
    : 'La password del tuo accesso a Vignero, l\'applicazione di magazzino di Fede Magazzino, è stata reimpostata.';
  const text = [
    `Ciao ${who},`, '', intro, '',
    `Indirizzo: ${o.url}`,
    `Email: ${o.email}`,
    `Password temporanea: ${o.password}`,
    `Profilo: ${roleLabel}`,
    '',
    'La password è temporanea e serve solo al primo accesso: dopo averla usata,',
    'chiedi all\'amministratore di reimpostarla, oppure usala per entrare e',
    'segnalare subito eventuali problemi di accesso.',
    '',
    'Se non hai richiesto questo accesso, ignora questo messaggio.',
    '',
    '— Fede Magazzino · Vignero',
  ].join('\n');

  const html = `<!doctype html>
<html lang="it"><body style="margin:0;padding:24px;background:#f4f6f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2a24">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #dfe6e2;border-radius:14px;overflow:hidden">
    <div style="padding:20px 24px;background:#175E43;color:#fff">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">Fede Magazzino</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">Vignero · accesso</div>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 12px">Ciao <b>${escapeHtml(who)}</b>,</p>
      <p style="margin:0 0 16px;line-height:1.5">${escapeHtml(intro)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#5b6b64">Indirizzo</td>
            <td style="padding:6px 0"><a href="${escapeHtml(o.url)}" style="color:#175E43">${escapeHtml(o.url)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#5b6b64">Email</td>
            <td style="padding:6px 0"><b>${escapeHtml(o.email)}</b></td></tr>
        <tr><td style="padding:6px 0;color:#5b6b64">Profilo</td>
            <td style="padding:6px 0">${escapeHtml(roleLabel)}</td></tr>
      </table>
      <div style="margin:18px 0;padding:14px 16px;background:#e9f5ef;border-radius:10px">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5b6b64;margin-bottom:6px">Password temporanea</div>
        <div style="font-size:20px;font-weight:700;letter-spacing:.04em">${escapeHtml(o.password)}</div>
      </div>
      <p style="margin:0 0 8px;line-height:1.5;font-size:13px;color:#5b6b64">
        La password è temporanea e serve solo al primo accesso. Se non hai richiesto
        questo accesso, ignora questo messaggio.
      </p>
      <a href="${escapeHtml(o.url)}" style="display:inline-block;margin-top:8px;padding:11px 18px;background:#175E43;color:#fff;text-decoration:none;border-radius:9px;font-weight:700;font-size:14px">Apri Vignero</a>
    </div>
    <div style="padding:14px 24px;border-top:1px solid #eef2f0;font-size:11px;color:#8a9992">
      Messaggio automatico di Vignero — non rispondere a questo indirizzo.
    </div>
  </div>
</body></html>`;

  return { to: o.email, subject: o.created ? 'Vignero · il tuo accesso' : 'Vignero · nuova password', text, html };
}

function escapeHtml(v: string): string {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Metodo non consentito' });

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return reply(401, { error: 'Sessione mancante' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Richiesta non valida' });
  }

  // capability probe: the Utenti screen uses it to decide whether to offer the
  // «invia la password per email» option — it never touches an account
  if (body.action === 'probe') {
    const mailReady = !!(Deno.env.get('RESEND_API_KEY') || Deno.env.get('BREVO_API_KEY'));
    return reply(200, { ok: true, probe: true, mail_ready: mailReady });
  }

  const raw = String(body.action || 'create');
  const action = raw === 'reset' ? 'reset' : raw === 'resend' ? 'resend' : 'create';
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return reply(400, { error: 'Email non valida' });
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const role = typeof body.role === 'string' ? body.role : '';
  const grower = typeof body.grower === 'string' && body.grower ? body.grower : null;

  // same RPCs the browser uses, authenticated with the CALLER's token: the
  // database decides whether this user is staff (Non autorizzato otherwise)
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );

  // 'resend' does not touch the account: it only re-sends a password the
  // administrator is already looking at, after checking the caller is staff
  if (action === 'resend') {
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[\x21-\x7e]{6,64}$/.test(password)) return reply(400, { error: 'Password non valida' });
    const me = await supa.auth.getUser();
    const uid = me.data?.user?.id;
    if (!uid) return reply(401, { error: 'Sessione non valida' });
    const prof = await supa.from('profiles').select('role,attivo').eq('user_id', uid).maybeSingle();
    const caller = prof.data;
    if (!caller || caller.attivo === false || !['admin', 'ufficio'].includes(caller.role)) {
      return reply(403, { error: 'Non autorizzato' });
    }
    let resent: { ok: boolean; provider?: string; error?: string };
    try {
      resent = await sendMail(compose({
        name: name || email, email, role, password, url: siteUrl(req), created: false,
      }));
    } catch (e) {
      resent = { ok: false, error: String((e as Error)?.message || e) };
    }
    return reply(200, {
      email, email_sent: resent.ok, provider: resent.provider ?? null,
      mail_error: resent.ok ? null : (resent.error ?? 'invio non riuscito'),
    });
  }

  const { data, error } = action === 'create'
    ? await supa.rpc('create_user', {
      p_email: email, p_nome: name || null, p_role: role || 'vendite', p_grower: grower,
    })
    : await supa.rpc('reset_user_password', { p_email: email });

  if (error) {
    const denied = /non autorizzato|solo un amministratore/i.test(error.message);
    return reply(denied ? 403 : 400, { error: error.message });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const password = row?.temp_password;
  if (!password) return reply(500, { error: 'Password temporanea non disponibile' });

  let mail: { ok: boolean; provider?: string; error?: string };
  try {
    mail = await sendMail(compose({
      name, email, role, password, url: siteUrl(req), created: action === 'create',
    }));
  } catch (e) {
    mail = { ok: false, error: String((e as Error)?.message || e) };
  }

  return reply(200, {
    email,
    password,
    email_sent: mail.ok,
    provider: mail.provider ?? null,
    mail_error: mail.ok ? null : (mail.error ?? 'invio non riuscito'),
  });
});
