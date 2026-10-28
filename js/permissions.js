/* Vignero · permissions.js — the single permission matrix (spec §2.2) */

export const ROLES = [
  { key: 'admin', label: 'Amministratore', short: 'ADMIN',
    blurb: 'Configura schermate, anagrafiche e utenti. Inserisce lotti e ordini. Tutti i riepiloghi.' },
  { key: 'ufficio', label: 'Amministrazione', short: 'UFFICIO',
    blurb: 'Inserimento lotti e ordini (anche da file), import Excel/CSV, tutti i riepiloghi.' },
  { key: 'produttore', label: 'Produttore', short: 'PRODUTTORE',
    blurb: 'Sola lettura da smartphone: riepilogo disponibilità e indisponibilità.' },
  { key: 'vendite', label: 'Vendite', short: 'VENDITE',
    blurb: 'Sola lettura del solo riepilogo disponibilità: il modulo più ristretto.' },
];

/* E = enter/edit · R = read · — = hidden */
export const PERMS = {
  'admin':    ['E', 'E', 'R', 'R'],
  'ufficio':  ['E', 'E', 'R', 'R'],   // row order = ROWS below
  'produttore': ['—', '—', 'R', 'R'],
  'vendite':  ['—', '—', 'R', 'R'],
};

/** Capability rows for the matrix view (order matters for the legend). */
export const MATRIX = [
  { cap: 'Panoramica / Home',      v: { admin: 'R', ufficio: 'R', produttore: 'R', vendite: 'R' } },
  { cap: 'Riepilogo disponibilità', v: { admin: 'R', ufficio: 'R', produttore: 'R', vendite: 'R' } },
  { cap: 'Riepilogo per produttore', v: { admin: 'R', ufficio: 'R', produttore: '—', vendite: '—' } },
  { cap: 'Indisponibilità',        v: { admin: 'R', ufficio: 'R', produttore: 'R', vendite: '—' } },
  { cap: 'Lotti magazzino',        v: { admin: 'E', ufficio: 'E', produttore: '—', vendite: '—' } },
  { cap: 'Ordini e impegni',       v: { admin: 'E', ufficio: 'E', produttore: '—', vendite: '—' } },
  { cap: 'Import CSV/Excel',       v: { admin: 'E', ufficio: 'E', produttore: '—', vendite: '—' } },
  { cap: 'Anagrafica vite',        v: { admin: 'E', ufficio: 'R', produttore: '—', vendite: '—' } },
  { cap: 'Anagrafica portainnesto', v: { admin: 'E', ufficio: 'R', produttore: '—', vendite: '—' } },
];

/** Capability keys used by NAV and the router guards. */
export const CAPS = {
  home: { admin: 1, ufficio: 1, produttore: 1, vendite: 1 },
  'r.disponibilita': { admin: 1, ufficio: 1, produttore: 1, vendite: 1 },
  'r.produttore': { admin: 1, ufficio: 1 },
  'r.indisponibilita': { admin: 1, ufficio: 1, produttore: 1 },
  'dati.lotti': { admin: 1, ufficio: 1 },
  'dati.ordini': { admin: 1, ufficio: 1 },
  'dati.import': { admin: 1, ufficio: 1 },
  'anag.viti': { admin: 1, ufficio: 1 },
  'anag.portainnesti': { admin: 1, ufficio: 1 },
  'config.permessi': { admin: 1 },
  'profilo': { admin: 1, ufficio: 1, produttore: 1, vendite: 1 },
};

export function can(role, cap) {
  return !!(CAPS[cap] && CAPS[cap][role]);
}
export function roleLabel(role) {
  const r = ROLES.find((x) => x.key === role);
  return r ? r.label : role;
}
export function roleShort(role) {
  const r = ROLES.find((x) => x.key === role);
  return r ? r.short : String(role).toUpperCase();
}

/** Sections for the desktop rail; each item is filtered by can(). */
export const RAIL = [
  { group: null, items: [{ cap: 'home', label: 'Panoramica', href: '#/home' }] },
  { group: 'Riepiloghi', items: [
    { cap: 'r.disponibilita', label: 'Disponibilità', href: '#/r/disponibilita' },
    { cap: 'r.produttore', label: 'Per produttore', href: '#/r/produttore' },
    { cap: 'r.indisponibilita', label: 'Indisponibilità', href: '#/r/indisponibilita' },
  ] },
  { group: 'Dati', pcOnly: true, items: [
    { cap: 'dati.lotti', label: 'Lotti magazzino', href: '#/dati/lotti' },
    { cap: 'dati.ordini', label: 'Ordini e impegni', href: '#/dati/ordini' },
    { cap: 'dati.import', label: 'Import CSV', href: '#/dati/import' },
  ] },
  { group: 'Anagrafiche', items: [
    { cap: 'anag.viti', label: 'Vite', href: '#/anagrafiche/viti' },
    { cap: 'anag.portainnesti', label: 'Portainnesti', href: '#/anagrafiche/portainnesti' },
  ] },
  { group: 'Configurazione', items: [
    { cap: 'config.permessi', label: 'Ruoli e permessi', href: '#/config/permessi' },
  ] },
  { group: null, items: [{ cap: 'profilo', label: 'Profilo', href: '#/profilo' }] },
];

/** Mobile tab bar: max four destinations, role-filtered. */
export function tabsFor(role) {
  const t = [{ cap: 'home', label: 'Home', href: '#/home', icon: 'home' }];
  if (can(role, 'r.disponibilita')) {
    t.push({ cap: 'r.disponibilita', label: 'Riepiloghi', href: '#/r/disponibilita', icon: 'table' });
  }
  if (can(role, 'r.indisponibilita')) {
    t.push({ cap: 'r.indisponibilita', label: 'Deficit', href: '#/r/indisponibilita', icon: 'alert' });
  } else if (can(role, 'dati.lotti')) {
    t.push({ cap: 'dati.lotti', label: 'Dati', href: '#/dati/lotti', icon: 'edit' });
  }
  t.push({ cap: 'profilo', label: 'Profilo', href: '#/profilo', icon: 'user' });
  return t;
}
