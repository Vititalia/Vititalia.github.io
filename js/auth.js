/* Vignero · auth.js — demo authentication and user registry
 *
 * ⚠️  DEMO ONLY. Credentials and the user registry live in the browser
 *     (localStorage): this demonstrates the login flow, the session, the role
 *     that follows from it and the user-management panel — it provides NO
 *     security. A real deployment authenticates on the server (POST /auth/login,
 *     POST /users/invite …) with hashed passwords and signed tokens.
 */

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

export function listUsers() {
  return read().map((u) => ({ ...u }));
}

export function resetRegistry() {
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
export function inviteUser({ email, name, role, grower }) {
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

export function setRole(id, role) {
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

export function setGrower(id, grower) {
  const list = read();
  const user = list.find((u) => u.id === id);
  if (!user) return { ok: false, error: 'Utente non trovato.' };
  user.grower = grower || null;
  write(list);
  return { ok: true, user };
}

/** Block or unblock an account. */
export function setStatus(id, status) {
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

export const blockUser = (id) => setStatus(id, 'sospeso');
export const unblockUser = (id) => setStatus(id, 'attivo');

/** Reset a password: returns the new temporary one (shown once). */
export function resetPassword(id) {
  const list = read();
  const user = list.find((u) => u.id === id);
  if (!user) return { ok: false, error: 'Utente non trovato.' };
  const password = randomPassword();
  user.password = password;
  if (user.status === 'invitato') user.status = 'attivo';
  write(list);
  return { ok: true, password, user };
}

export const ROLE_KEYS = ['admin', 'ufficio', 'produttore', 'vendite'];

/* ------------------------------------------------------------ sign in */
export function authenticate(email, password) {
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

export function getSession() {
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

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function minutesLeft(session) {
  if (!session || !session.exp) return 0;
  return Math.max(0, Math.round((session.exp - Date.now()) / 60000));
}
