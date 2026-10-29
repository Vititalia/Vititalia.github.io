/* Vignero · auth.js — demo authentication and user registry
 *
 * ⚠️  DEMO ONLY. Credentials and the user registry live in the browser
 *     (localStorage): this demonstrates the login flow, the session, the role
 *     that follows from it and the user-management panel — it provides NO
 *     security. A real deployment authenticates on the server (POST /auth/login,
 *     POST /users/invite …) with hashed passwords and signed tokens.
 */

import { backend, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, EMAIL_CREDENTIALS } from './config.js';
export { backend };

export const SESSION_KEY = 'vignero.session.v1';
const USERS_KEY = 'vignero.users.v1';
const SESSION_HOURS = 8;

/** The four documented demo accounts; also the seed of the user registry. */
export const USERS = [
  { id: 'u-admin', email: 'admin@vignero.it', password: 'Admin#2026',
    name: 'Paola Neri', role: 'admin', grower: null },
  { id: 'u-ufficio', email: 'ufficio@vignero.it', password: 'Ufficio#2026',
    name: 'Anna Verdi', role: 'ufficio', grower: null },
  { id: 'u-produttore', email: 'produttore@vignero.it', password: 'Produttore#2026',
    name: 'Marco Rossi', role: 'produttore', grower: 'Mori Marco' },
  { id: 'u-vendite', email: 'vendite@vignero.it', password: 'Vendite#2026',
    name: 'Giulia Bianchi', role: 'vendite', grower: null },
];

const seedCopy = () => USERS.map((u) => ({ ...u, status: 'attivo', seed: true }));

/* ------------------------------------------------------------- registry */
function read() {
  let raw;
  try { raw = localStorage.getItem(USERS_KEY); } catch { return seedCopy(); }
  if (!raw) return seedCopy();
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? list : seedCopy();
  } catch { return seedCopy(); }
}

function write(list) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

function demoListUsers() {
  return read().map((u) => ({ ...u }));
}

function demoResetRegistry() {
  try { localStorage.removeItem(USERS_KEY); } catch { /* ignore */ }
}

function randomPassword() {
  const words = ['Vite', 'Lotto', 'Clone', 'Innesto', 'Fila', 'Gemma', 'Vaso', 'Tralcio'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}!`;
}

let counter = 0;
function newId() {
  counter += 1;
  return 'u-' + Date.now().toString(36) + counter.toString(36);
}

/** Invite a user: creates the account in state «invitato» with a temporary password. */
function demoInviteUser({ email, name, role, grower }) {
  const mail = String(email || '').trim().toLowerCase();
  const full = String(name || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { ok: false, error: 'Email non valida.' };
  if (!full) return { ok: false, error: 'Il nome è obbligatorio.' };
  if (!ROLE_KEYS.includes(role)) return { ok: false, error: 'Ruolo non valido.' };
  if (role === 'produttore' && !grower) return { ok: false, error: 'Per un produttore indica il produttore collegato.' };
  const list = read();
  if (list.some((u) => u.email.toLowerCase() === mail)) {
    return { ok: false, error: 'Esiste già un utente con questa email.' };
  }
  const password = randomPassword();
  const user = {
    id: newId(), email: mail, name: full, role,
    grower: role === 'produttore' ? grower : null,
    password, status: 'invitato', seed: false,
  };
  list.push(user);
  write(list);
  return { ok: true, user, password };
}

function demoSetRole(id, role) {
  if (!ROLE_KEYS.includes(role)) return { ok: false, error: 'Ruolo non valido.' };
  const list = read();
  const user = list.find((u) => u.id === id);
  if (!user) return { ok: false, error: 'Utente non trovato.' };
  if (user.role === 'admin' && role !== 'admin' && list.filter((u) => u.role === 'admin').length === 1) {
    return { ok: false, error: 'Deve restare almeno un amministratore.' };
  }
  user.role = role;
  if (role !== 'produttore') user.grower = null;
  if (user.status === 'invitato' && role) user.status = 'attivo';
  write(list);
  return { ok: true, user };
}

function demoSetGrower(id, grower) {
  const list = read();
  const user = list.find((u) => u.id === id);
  if (!user) return { ok: false, error: 'Utente non trovato.' };
  user.grower = grower || null;
  write(list);
  return { ok: true, user };
}

/** Block or unblock an account. */
function demoSetStatus(id, status) {
  const list = read();
  const user = list.find((u) => u.id === id);
  if (!user) return { ok: false, error: 'Utente non trovato.' };
  if (status === 'sospeso' && user.role === 'admin' &&
      list.filter((u) => u.role === 'admin' && u.status !== 'sospeso').length === 1) {
    return { ok: false, error: 'Non puoi sospendere l\'ultimo amministratore attivo.' };
  }
  user.status = status;
  write(list);
  return { ok: true, user };
}

const demoBlock = (id) => demoSetStatus(id, 'sospeso');
const demoUnblock = (id) => demoSetStatus(id, 'attivo');

/** The signed-in demo user changes their own password, giving the current one. */
function demoChangeOwnPassword({ email, currentPassword, newPassword }) {
  const list = read();
  const mail = String(email || '').trim().toLowerCase();
  const user = list.find((u) => u.email.toLowerCase() === mail);
  if (!user) return { ok: false, error: 'Utente non trovato.' };
  if (user.password !== String(currentPassword || '')) {
    return { ok: false, error: 'La password attuale non è corretta.' };
  }
  if (user.password === String(newPassword || '')) {
    return { ok: false, error: 'La nuova password deve essere diversa da quella attuale.' };
  }
  user.password = String(newPassword);
  if (user.status === 'invitato') user.status = 'attivo';
  write(list);
  return { ok: true };
}

/** Staff picks a password for someone else (no new password is generated). */
function demoSetUserPassword(id, password) {
  const list = read();
  const user = list.find((u) => u.id === id);
  if (!user) return { ok: false, error: 'Utente non trovato.' };
  user.password = String(password);
  if (user.status === 'invitato') user.status = 'attivo';
  write(list);
  return { ok: true, user };
}

/** Reset a password: returns the new temporary one (shown once). */
function demoResetPassword(id) {
  const list = read();
  const user = list.find((u) => u.id === id);
  if (!user) return { ok: false, error: 'Utente non trovato.' };
  const password = randomPassword();
  user.password = password;
  if (user.status === 'invitato') user.status = 'attivo';
  write(list);
  return { ok: true, password, user };
}



/* ------------------------------------------------------------ sign in */
function demoAuthenticate(email, password) {
  const mail = String(email || '').trim().toLowerCase();
  const pwd = String(password || '');
  if (!mail || !pwd) return { ok: false, error: 'Inserisci email e password.' };
  const user = read().find((u) => u.email.toLowerCase() === mail);
  if (!user || user.password !== pwd) {
    return { ok: false, error: 'Email o password non corretti.' };
  }
  if (user.status === 'sospeso') {
    return { ok: false, error: 'Utente sospeso: contatta l\'amministrazione.' };
  }
  if (user.status === 'invitato') user.status = 'attivo';
  setSession(user);                       // demo: persist the session locally
  return { ok: true, user };
}

/* ------------------------------------------------------------ session */
export function buildSession(user) {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    grower: user.grower || null,
    issuedAt: Date.now(),
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
  };
}

export function setSession(user) {
  const s = buildSession(user);
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  return { ...s, user };
}

function demoGetSession() {
  let raw;
  try { raw = localStorage.getItem(SESSION_KEY); } catch { return null; }
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch { return null; }
  if (!s || !s.userId || !s.role || !s.exp || s.exp < Date.now()) { clearSession(); return null; }
  const user = read().find((u) => u.id === s.userId);
  if (!user || user.status === 'sospeso') { clearSession(); return null; }
  // the registry is the source of truth for role and identity
  return { ...s, role: user.role, name: user.name, email: user.email,
           grower: user.grower || null, user };
}

function demoClearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function minutesLeft(session) {
  if (!session || !session.exp) return 0;
  return Math.max(0, Math.round((session.exp - Date.now()) / 60000));
}

export const ROLE_KEYS = ['admin', 'ufficio', 'produttore', 'vendite'];

/* ==========================================================================
 * Backend facade — the UI calls these names; they route to Supabase when
 * config.js is configured, otherwise to the local demo registry.
 * ========================================================================== */
let client = null;
async function sb() {
  if (!client) {
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    client = mod.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
export const supabaseClient = sb;

function italian(msg) {
  const m = String(msg || '');
  if (/invalid login credentials/i.test(m)) return 'Email o password non corretti.';
  if (/email not confirmed/i.test(m)) return 'Email non confermata.';
  if (/rate limit|too many/i.test(m)) return 'Troppi tentativi: riprova tra qualche istante.';
  return m;
}

async function profileOf(c, user) {
  const { data, error } = await c.from('profiles')
    .select('user_id,email,nome,role,grower,attivo').eq('user_id', user.id).maybeSingle();
  if (error) return null;
  return data;
}

/** Sign in. Demo: local registry. Supabase: signInWithPassword + profile lookup. */
export async function authenticate(email, password) {
  if (backend() === 'demo') return demoAuthenticate(email, password);
  const c = await sb();
  const { data, error } = await c.auth.signInWithPassword({ email: String(email || '').trim(), password: String(password || '') });
  if (error) return { ok: false, error: italian(error.message) };
  const p = await profileOf(c, data.user);
  if (!p || !p.role || p.attivo === false) {
    await c.auth.signOut();
    return { ok: false, error: 'Account senza un ruolo attivo: chiedi all\'amministrazione.' };
  }
  return {
    ok: true,
    user: { id: data.user.id, email: data.user.email, name: p.nome || data.user.email,
            role: p.role, grower: p.grower || null },
  };
}

/** The current session (validated against the backend) or null. */
export async function getSession() {
  if (backend() === 'demo') return demoGetSession();
  const c = await sb();
  const { data } = await c.auth.getSession();
  const s = data && data.session;
  if (!s || !s.user) return null;
  const p = await profileOf(c, s.user);
  if (!p || !p.role || p.attivo === false) { await c.auth.signOut(); return null; }
  return {
    userId: s.user.id, email: s.user.email, name: p.nome || s.user.email,
    role: p.role, grower: p.grower || null,
    issuedAt: (s.expires_at || 0) * 1000 - 8 * 3600 * 1000,
    exp: (s.expires_at || 0) * 1000,
    user: { id: s.user.id, email: s.user.email, name: p.nome || s.user.email,
            role: p.role, grower: p.grower || null },
  };
}

export async function logout() {
  if (backend() === 'demo') { demoClearSession(); return; }
  const c = await sb();
  await c.auth.signOut();
}

/* ---- user registry (the Utenti screen) ---- */
let usersCache = null;
export async function refreshUsers() {
  if (backend() === 'demo') { usersCache = demoListUsers(); return usersCache; }
  const c = await sb();
  const { data, error } = await c.from('profiles')
    .select('user_id,email,nome,role,grower,attivo').order('email');
  usersCache = error ? [] : (data || []).map((p) => ({
    id: p.user_id, email: p.email, name: p.nome || p.email, role: p.role,
    grower: p.grower, status: p.attivo === false ? 'sospeso' : (p.role ? 'attivo' : 'invitato'),
  }));
  return usersCache;
}
export function listUsers() {
  if (backend() === 'demo') return demoListUsers();
  return usersCache || [];
}

/** Role assignment. Demo: instant. Supabase: one UPDATE (allowed by RLS for staff). */
export async function setRole(id, role) {
  if (backend() === 'demo') return demoSetRole(id, role);
  const c = await sb();
  const { error } = await c.from('profiles').update({ role }).eq('user_id', id);
  if (error) return { ok: false, error: italian(error.message) };
  await refreshUsers();
  return { ok: true };
}
export async function setGrower(id, grower) {
  if (backend() === 'demo') return demoSetGrower(id, grower);
  const c = await sb();
  const { error } = await c.from('profiles').update({ grower: grower || null }).eq('user_id', id);
  if (error) return { ok: false, error: italian(error.message) };
  return { ok: true };
}

/* ---- optional e-mail delivery through the `send-credentials` Edge Function ----
 * The function calls the same SECURITY DEFINER RPCs **with the caller's token**, so
 * the role check stays in the database. When it is not deployed the client falls
 * back to the plain RPC and the administrator hands the password over by hand. */
let credentialsFnMissing = false;
const passwordLooksSafe = (pw) => typeof pw === 'string' && /^[\x21-\x7e]{6,64}$/.test(pw);

export const credentialsEmailAvailable = () =>
  backend() === 'supabase' && EMAIL_CREDENTIALS && !credentialsFnMissing;

/** Whether the Utenti screen should offer e-mail delivery (see EMAIL_CREDENTIALS). */
export async function ensureCredentialsEmail() {
  return credentialsEmailAvailable();
}

async function functionErrorMessage(error) {
  const ctx = error && error.context;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const body = await ctx.clone().json();
      if (body && body.error) return italian(String(body.error));
    } catch { /* not JSON */ }
  }
  return italian((error && error.message) || 'Funzione non disponibile');
}

/**
 * `action: 'create' | 'reset'` creates/resets the account and e-mails the one-time
 * password; `action: 'resend'` only re-sends a password already on screen.
 */
export async function emailCredentials({ action = 'create', email, name, role, grower, password }) {
  if (backend() === 'demo') {
    return { ok: false, notDeployed: true, error: 'Non disponibile in modalità dimostrativa.' };
  }
  const c = await sb();
  let data = null;
  let error = null;
  try {
    ({ data, error } = await c.functions.invoke('send-credentials', {
      body: { action, email, name, role, grower: grower || null, password: password || null },
    }));
  } catch {
    credentialsFnMissing = true;
    return { ok: false, notDeployed: true, error: 'Funzione e-mail non configurata.' };
  }
  if (error) {
    const status = (error.context && error.context.status) || error.status || 0;
    if (status === 404 || status === 0) {
      credentialsFnMissing = true;
      return { ok: false, notDeployed: true, error: 'Funzione e-mail non configurata.' };
    }
    return { ok: false, error: await functionErrorMessage(error) };
  }
  if (!data || data.error) {
    return { ok: false, error: italian((data && data.error) || 'Risposta non valida') };
  }
  return { ok: true, ...data };
}

/**
 * Create a user. Live: the `create_user` RPC (SECURITY DEFINER, staff-only) returns
 * a one-time temporary password; with `viaEmail` the Edge Function also mails it.
 * Demo: the local registry.
 */
export async function createUser({ email, name, role, grower, viaEmail = false }) {
  if (backend() === 'demo') {
    const res = demoInviteUser({ email, name, role, grower });
    return res.ok ? { ok: true, user: res.user, password: res.password } : res;
  }
  if (viaEmail && !credentialsFnMissing) {
    const res = await emailCredentials({ action: 'create', email, name, role, grower });
    if (res.ok) {
      await refreshUsers();
      return {
        ok: true, user: { email, role }, password: res.password,
        mail: { sent: !!res.email_sent, error: res.mail_error || null, provider: res.provider || null },
      };
    }
    if (!res.notDeployed) return res;          // real refusal (role, e-mail format, …)
  }
  const c = await sb();
  const { data, error } = await c.rpc('create_user', {
    p_email: email, p_nome: name, p_role: role, p_grower: grower || null,
  });
  if (error) return { ok: false, error: italian(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  await refreshUsers();
  return {
    ok: true, user: { email: row.email, role }, password: row.temp_password,
    mail: viaEmail ? { sent: false, error: 'Funzione e-mail non configurata sul progetto.' } : null,
  };
}

/** Reset a password: `user` is the row from listUsers(). */
export async function resetPassword(user, { viaEmail = false } = {}) {
  if (backend() === 'demo') return demoResetPassword(user.id);
  if (viaEmail && !credentialsFnMissing) {
    const res = await emailCredentials({ action: 'reset', email: user.email });
    if (res.ok) {
      return {
        ok: true, password: res.password, user,
        mail: { sent: !!res.email_sent, error: res.mail_error || null, provider: res.provider || null },
      };
    }
    if (!res.notDeployed) return res;
  }
  const c = await sb();
  const { data, error } = await c.rpc('reset_user_password', { p_email: user.email });
  if (error) return { ok: false, error: italian(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true, password: row.temp_password, user,
    mail: viaEmail ? { sent: false, error: 'Funzione e-mail non configurata sul progetto.' } : null,
  };
}

/** Re-send a password that is already on screen (no new password is issued). */
export async function resendCredentialsEmail({ email, name, role, password }) {
  if (!passwordLooksSafe(password)) return { ok: false, error: 'Password non valida.' };
  return emailCredentials({ action: 'resend', email, name, role, password });
}

/* ------------------------------------------------------------- passwords */
/** Italian messages for the rules both password forms share (8…72 chars). */
export function passwordIssues(password, { confirm, email } = {}) {
  const pw = String(password || '');
  const out = [];
  if (pw.length < 8) out.push('Almeno 8 caratteri.');
  if (pw.length > 72) out.push('Massimo 72 caratteri.');
  if (pw && email && pw.toLowerCase() === String(email).toLowerCase()) {
    out.push('La password non può essere l\'indirizzo email.');
  }
  if (confirm !== undefined && pw !== String(confirm || '')) {
    out.push('Le due password non coincidono.');
  }
  return out;
}

/**
 * Change your own password: the current one is verified against the backend
 * before the new one is stored (a session alone is not enough).
 */
export async function changeOwnPassword({ email, currentPassword, newPassword }) {
  const problems = passwordIssues(newPassword, { email });
  if (problems.length) return { ok: false, error: problems[0] };
  if (String(currentPassword || '') === String(newPassword || '')) {
    return { ok: false, error: 'La nuova password deve essere diversa da quella attuale.' };
  }
  if (backend() === 'demo') return demoChangeOwnPassword({ email, currentPassword, newPassword });
  const c = await sb();
  // prove the old password first: updateUser() alone would accept any session
  const { error: check } = await c.auth.signInWithPassword({
    email, password: String(currentPassword || ''),
  });
  if (check) return { ok: false, error: 'La password attuale non è corretta.' };
  const { error } = await c.auth.updateUser({ password: String(newPassword) });
  if (error) return { ok: false, error: italian(error.message) };
  return { ok: true };
}

/** Staff sets a password of their choosing for another user (RPC, staff-checked). */
export async function setUserPassword(user, password) {
  const problems = passwordIssues(password, { email: user && user.email });
  if (problems.length) return { ok: false, error: problems[0] };
  if (backend() === 'demo') return demoSetUserPassword(user.id, String(password));
  const c = await sb();
  const { error } = await c.rpc('set_user_password', {
    p_email: user.email, p_password: String(password),
  });
  if (error) return { ok: false, error: italian(error.message) };
  await refreshUsers();
  return { ok: true };
}

/** Remove an account (administrators only, enforced by the RPC). */
export async function deleteUser(user) {
  if (backend() === 'demo') {
    const list = read().filter((u) => u.id !== user.id);
    write(list);
    usersCache = null;
    return { ok: true };
  }
  const c = await sb();
  const { error } = await c.rpc('delete_user', { p_email: user.email });
  if (error) return { ok: false, error: italian(error.message) };
  await refreshUsers();
  return { ok: true };
}

/** Send the "set your password" e-mail through the public endpoint (no secret key). */
export async function sendRecoveryEmail(email) {
  if (backend() === 'demo') return { ok: false, error: 'Non disponibile in modalità dimostrativa.' };
  const c = await sb();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
  return error ? { ok: false, error: italian(error.message) } : { ok: true };
}
export async function blockUser(id) {
  if (backend() === 'demo') return demoBlock(id);
  const c = await sb();
  const { error } = await c.from('profiles').update({ attivo: false }).eq('user_id', id);
  if (error) return { ok: false, error: italian(error.message) };
  await refreshUsers();
  return { ok: true };
}
export async function unblockUser(id) {
  if (backend() === 'demo') return demoUnblock(id);
  const c = await sb();
  const { error } = await c.from('profiles').update({ attivo: true }).eq('user_id', id);
  if (error) return { ok: false, error: italian(error.message) };
  await refreshUsers();
  return { ok: true };
}
export async function resetRegistry() {
  if (backend() === 'demo') { demoResetRegistry(); usersCache = null; return; }
}
