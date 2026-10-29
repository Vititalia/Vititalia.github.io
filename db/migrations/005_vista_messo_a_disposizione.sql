-- Vignero · 005 — «Messo a disposizione»: what one producer has in stock
--
-- A produttore cannot read lotti_magazzino / ordini_impegni (RLS), and the
-- per-grower report is staff-only, so the screen that answers "what did *I*
-- put in the warehouse, and what is still committed against it?" has to be
-- aggregated server-side. The view carries the identity check inside the
-- definition: it returns the rows of `auth_grower()` and nothing else, so the
-- same request from a different producer (or from a staff account, whose
-- auth_grower() is null) yields no rows.
begin;

create or replace view public.vista_messo_a_disposizione as
with mag as (
  select tipologia, produzione, codice_varieta, codice_clone, codice_portainnesto,
         sum(quantita)::bigint as quantita_magazzino
  from public.lotti_magazzino
  where produttore = public.auth_grower()
  group by 1,2,3,4,5
), ord as (
  select o.tipologia, o.produzione, o.codice_varieta, o.codice_clone, o.codice_portainnesto,
         sum(o.quantita)::bigint as quantita_ordinata,
         sum(case when o.spedito then o.quantita else 0 end)::bigint as quantita_spedita
  from public.ordini_impegni o
  join public.lotti_magazzino l on l.id = o.id_magazzino
  where l.produttore = public.auth_grower()
  group by 1,2,3,4,5
)
select coalesce(m.tipologia, o.tipologia)                   as tipologia,
       coalesce(m.produzione, o.produzione)                 as produzione,
       coalesce(m.codice_varieta, o.codice_varieta)         as codice_varieta,
       coalesce(m.codice_clone, o.codice_clone)             as codice_clone,
       coalesce(m.codice_portainnesto, o.codice_portainnesto) as codice_portainnesto,
       coalesce(m.quantita_magazzino, 0)                    as quantita_magazzino,
       coalesce(o.quantita_ordinata, 0)                     as quantita_ordinata,
       coalesce(o.quantita_spedita, 0)                      as quantita_spedita,
       coalesce(m.quantita_magazzino, 0) - coalesce(o.quantita_ordinata, 0) as disponibilita
from mag m
full outer join ord o
  on  o.tipologia = m.tipologia and o.produzione = m.produzione
  and o.codice_varieta = m.codice_varieta and o.codice_clone = m.codice_clone
  and o.codice_portainnesto = m.codice_portainnesto
where public.auth_grower() is not null;

revoke all on public.vista_messo_a_disposizione from anon;
grant select on public.vista_messo_a_disposizione to authenticated;

commit;
