-- Vignero · 002 — the master-data validation trigger must not depend on the caller's RLS
--
-- valida_varieta_clone() reads anagrafica_portainnesto / anagrafica_vite. Without
-- SECURITY DEFINER those reads are filtered by the caller's row policies, so for a
-- produttore the lookup finds nothing and the trigger raises
-- "Il portainnesto … non esiste in anagrafica!" instead of letting row-level
-- security reject the write with the correct error.
begin;
alter function public.valida_varieta_clone() security definer;
alter function public.valida_varieta_clone() set search_path = public, pg_temp;
revoke all on function public.valida_varieta_clone() from anon, public;
commit;
