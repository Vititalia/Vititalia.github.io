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
export const isSupabase = () => backend() === 'supabase';
