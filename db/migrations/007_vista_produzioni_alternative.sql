-- Vignero · 007 — Ripiantato / Frigoconservato available quantities
--
-- The availability report shows, next to the «Nuova produzione» numbers, how much
-- of the same lot reference is available as replanted or fridge-stored material.
-- The join follows the reference lot: tipologia, codice varietà, codice clone,
-- codice portainnesto, produttore and anno di conferimento of a «Nuova
-- produzione» lot; the quantity is the stock of that key with the other
-- produzione minus what has already been committed on it.
--
-- It has to be aggregated server-side because produttore/vendite cannot read the
-- tables (RLS). Roles: all four see the report, so the view filters on
-- `auth_role() is not null`, like `riepilogo_disponibilita`.
begin;

create or replace view public.vista_produzioni_alternative as
with riferimento as (
  -- one row per lot reference of «Nuova produzione» (deduplicated)
  select distinct l.tipologia,
                  l.codice_varieta, l.codice_clone, l.codice_portainnesto,
                  coalesce(l.produttore, '') as produttore,
                  l.anno_conferimento
  from public.lotti_magazzino l
  where l.produzione = 'Nuova produzione'
), mag as (
  select l.tipologia, l.produzione, l.codice_varieta, l.codice_clone, l.codice_portainnesto,
         coalesce(l.produttore, '') as produttore, l.anno_conferimento,
         sum(l.quantita)::bigint as quantita_magazzino
  from public.lotti_magazzino l
  where l.produzione in ('Ripiantato', 'Frigoconservato')
  group by 1,2,3,4,5,6,7
), ord as (
  -- the commitment belongs to the lot it was placed against
  select o.tipologia, o.produzione, o.codice_varieta, o.codice_clone, o.codice_portainnesto,
         coalesce(l.produttore, '') as produttore, l.anno_conferimento,
         sum(o.quantita)::bigint as quantita_ordinata
  from public.ordini_impegni o
  join public.lotti_magazzino l on l.id = o.id_magazzino
  where o.produzione in ('Ripiantato', 'Frigoconservato')
  group by 1,2,3,4,5,6,7
)
select r.tipologia,
       m.produzione,
       r.codice_varieta, r.codice_clone, r.codice_portainnesto,
       sum(coalesce(m.quantita_magazzino, 0) - coalesce(o.quantita_ordinata, 0))::bigint as disponibilita
from riferimento r
join mag m
  on  m.tipologia = r.tipologia
  and m.codice_varieta = r.codice_varieta and m.codice_clone = r.codice_clone
  and m.codice_portainnesto = r.codice_portainnesto
  and m.produttore = r.produttore and m.anno_conferimento = r.anno_conferimento
left join ord o
  on  o.tipologia = m.tipologia and o.produzione = m.produzione
  and o.codice_varieta = m.codice_varieta and o.codice_clone = m.codice_clone
  and o.codice_portainnesto = m.codice_portainnesto
  and o.produttore = m.produttore and o.anno_conferimento = m.anno_conferimento
where public.auth_role() is not null
group by 1,2,3,4,5;

revoke all on public.vista_produzioni_alternative from anon;
grant select on public.vista_produzioni_alternative to authenticated;

commit;
