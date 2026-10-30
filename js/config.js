/* Vignero · config.js — where the app gets its data
 *
 * The URL and the PUBLISHABLE key are public by design (they ship to every
 * browser); what protects the data is row-level security in the database, not
 * the secrecy of this file. Never put the secret/service key here.
 */
export const SUPABASE_URL = 'https://aewavfybbvksxscpfxbt.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_HX4U18dkxzv086nAe9t-hg_EDSuEocp';

/** Backend selection: 'supabase' when configured, otherwise the local demo.
 *  A stored override ('vignero.backend' = 'demo' | 'supabase') wins, which is how
 *  the test suites keep running without a network. */
export function backend() {
  try {
    const forced = localStorage.getItem('vignero.backend');
    if (forced === 'demo' || forced === 'supabase') return forced;
  } catch { /* private mode */ }
  return (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) ? 'supabase' : 'demo';
}
/** The released version, shown in the app (Profilo, login) and exposed as
 *  `window.__VIGNERO_VERSION` so a deployment can be checked from the console. */
export const APP_VERSION = '1.0.4';

export const isSupabase = () => backend() === 'supabase';

/**
 * Set to `true` **after** deploying the `send-credentials` Edge Function (see
 * supabase/functions/README.md): the Utenti screen then offers to e-mail the
 * one-time password. Keeping it a flag avoids a probe request to a function that
 * is not there yet — the browser would log a CORS error on every screen visit.
 * With the flag on and the function missing, the screen says so in the panel and
 * falls back to the local password.
 */
export const EMAIL_CREDENTIALS = false;
