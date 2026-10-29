-- Vignero · 003 — the two reports the client can no longer compute itself
--
-- With RLS on, a produttore/vendite cannot read the raw tables, so the per-grower
-- report and the «da spedire» report have to be aggregated server-side. Both views
-- are staff-only and carry the role check inside the definition.
begin;

-- per-grower availability: one row per (dimension key, produttore)
create or replace view public.riepilogo_per_produttore as
with mag as (
  select tipologia, produzione, codice_varieta, codice_clone, codice_portainnesto,
         coalesce(produttore, 'Esterno') as produttore,
         sum(quantita)::bigint as quantita_magazzino
  from public.lotti_magazzino
  group by 1,2,3,4,5,6
), ord as (
  select o.tipologia, o.produzione, o.codice_varieta, o.codice_clone, o.codice_portainnesto,
         coalesce(l.produttore, 'Esterno') as produttore,
         sum(o.quantita)::bigint as quantita_ordinata,
         sum(case when o.spedito then o.quantita else 0 end)::bigint as quantita_spedita
  from public.ordini_impegni o
  left join public.lotti_magazzino l on l.id = o.id_magazzino
  group by 1,2,3,4,5,6
)
select coalesce(m.tipologia, o.tipologia)               as tipologia,
       coalesce(m.produzione, o.produzione)             as produzione,
       coalesce(m.codice_varieta, o.codice_varieta)     as codice_varieta,
       coalesce(m.codice_clone, o.codice_clone)         as codice_clone,
       coalesce(m.codice_portainnesto, o.codice_portainnesto) as codice_portainnesto,
       coalesce(m.produttore, o.produttore)             as produttore,
       coalesce(m.quantita_magazzino, 0)                as quantita_magazzino,
       coalesce(o.quantita_ordinata, 0)                 as quantita_ordinata,
       coalesce(o.quantita_spedita, 0)                  as quantita_spedita,
       coalesce(m.quantita_magazzino, 0) - coalesce(o.quantita_ordinata, 0) as disponibilita
from mag m
full outer join ord o
  on  o.tipologia = m.tipologia and o.produzione = m.produzione
  and o.codice_varieta = m.codice_varieta and o.codice_clone = m.codice_clone
  and o.codice_portainnesto = m.codice_portainnesto and o.produttore = m.produttore
where public.is_staff();

-- commitments still to ship, with the lot's producer
create or replace view public.vista_da_spedire as
select o.id, o.tipologia, o.produzione, o.codice_varieta, o.codice_clone, o.codice_portainnesto,
       o.quantita, o.note, o.created_at,
       o.id_magazzino, l.produttore, l.anno_conferimento
from public.ordini_impegni o
left join public.lotti_magazzino l on l.id = o.id_magazzino
where not o.spedito
  and public.is_staff();

revoke all on public.riepilogo_per_produttore, public.vista_da_spedire from anon;
grant select on public.riepilogo_per_produttore, public.vista_da_spedire to authenticated;

commit;
