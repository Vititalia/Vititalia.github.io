-- Vignero · 008 — alternative productions, reference or not
--
-- The availability report needs both halves of the «Ripiantato» /
-- «Frigoconservato» picture:
--   * the rows whose lot reference matches a «Nuova produzione» lot (attached to
--     the existing table rows, migration 007);
--   * the rows whose reference does *not* exist for «Nuova produzione»: they are
--     still real stock and the report shows them as extra rows (zeros in the
--     four main columns) when «Aggiungi altro» is pressed.
--
-- The view therefore stops inner-joining to the references and returns one row
-- per (tipologia, produzione, varietà, clone, portainnesto, produttore, anno)
-- with `ha_riferimento` telling which half it belongs to.
begin;

-- the column set changes, so the view is recreated (it holds no data)
drop view if exists public.vista_produzioni_alternative;

create view public.vista_produzioni_alternative as
with riferimento as (
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
select m.tipologia, m.produzione, m.codice_varieta, m.codice_clone, m.codice_portainnesto,
       m.produttore, m.anno_conferimento,
       (coalesce(m.quantita_magazzino, 0) - coalesce(o.quantita_ordinata, 0))::bigint as disponibilita,
       exists (
         select 1 from riferimento r
         where r.tipologia = m.tipologia
           and r.codice_varieta = m.codice_varieta and r.codice_clone = m.codice_clone
           and r.codice_portainnesto = m.codice_portainnesto
           and r.produttore = m.produttore and r.anno_conferimento = m.anno_conferimento
       ) as ha_riferimento
from mag m
left join ord o
  on  o.tipologia = m.tipologia and o.produzione = m.produzione
  and o.codice_varieta = m.codice_varieta and o.codice_clone = m.codice_clone
  and o.codice_portainnesto = m.codice_portainnesto
  and o.produttore = m.produttore and o.anno_conferimento = m.anno_conferimento
where public.auth_role() is not null;

revoke all on public.vista_produzioni_alternative from anon;
grant select on public.vista_produzioni_alternative to authenticated;

commit;
