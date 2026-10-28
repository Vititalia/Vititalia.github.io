/* Vignero · auth.js — demo authentication (one account per profile)
 *
 * ⚠️  DEMO ONLY. This is client-side authentication against a static file: it
 *     demonstrates the login flow, the session and the role that follows from
 *     it — it provides NO security. Anyone can read this file or set the
 *     session themselves. A real deployment must authenticate against a
 *     server (POST /auth/login) and receive a signed token.
 *
 * The credentials below are also shown on the login screen so the demo is
 * usable; they are intentionally not secrets.
 */

export const SESSION_KEY = 'vignero.session.v1';
const SESSION_HOURS = 8;

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

/** Case-insensitive e-mail, exact password. Returns {ok, user} | {ok:false, error}. */
export function authenticate(email, password) {
  const mail = String(email || '').trim().toLowerCase();
  const pwd = String(password || '');
  if (!mail || !pwd) return { ok: false, error: 'Inserisci email e password.' };
  const user = USERS.find((u) => u.email.toLowerCase() === mail);
  if (!user || user.password !== pwd) {
    // never reveal which of the two was wrong
    return { ok: false, error: 'Email o password non corretti.' };
  }
  return { ok: true, user };
}

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
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* private mode */ }
  return { ...s, user };
}

/** Returns the stored session if it is still valid, otherwise null. */
export function getSession() {
  let raw;
  try { raw = localStorage.getItem(SESSION_KEY); } catch { return null; }
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch { return null; }
  if (!s || !s.userId || !s.role || !s.exp || s.exp < Date.now()) {
    clearSession();
    return null;
  }
  const user = USERS.find((u) => u.id === s.userId);
  if (!user) { clearSession(); return null; }
  return { ...s, user };
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function minutesLeft(session) {
  if (!session || !session.exp) return 0;
  return Math.max(0, Math.round((session.exp - Date.now()) / 60000));
}
