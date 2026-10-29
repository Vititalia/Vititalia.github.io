-- Vignero · 001 — close the public leak, add profiles and RLS
--
-- Design note: the report views stay DEFINER-owned (they aggregate across rows the
-- caller must not read individually: a produttore sees totals, not other growers'
-- lots). Role filtering is therefore expressed INSIDE each view with auth_role(),
-- and the publishable/anon role is granted nothing at all.

begin;

-- ---------------------------------------------------------------------------
-- 1. anon gets nothing (this is what closes the public exposure)
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- 2. profiles: one row per auth user, role is the single source of permission
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  role       text check (role in ('admin','ufficio','produttore','vendite')),
  grower     text,
  attivo     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- helpers: security definer so policies can read profiles without recursion
create or replace function public.auth_role() returns text
  language sql stable security definer set search_path = public, auth as $$
    select p.role from public.profiles p
     where p.user_id = (select auth.uid()) and p.attivo
     limit 1
$$;

create or replace function public.auth_grower() returns text
  language sql stable security definer set search_path = public, auth as $$
    select p.grower from public.profiles p
     where p.user_id = (select auth.uid()) and p.attivo
     limit 1
$$;

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public, auth as $$
    select coalesce(public.auth_role() in ('admin','ufficio'), false)
$$;

revoke all on function public.auth_role() from anon, public;
revoke all on function public.auth_grower() from anon, public;
revoke all on function public.is_staff() from anon, public;
grant execute on function public.auth_role(), public.auth_grower(), public.is_staff() to authenticated;

-- new signup → empty profile (role NULL = no access until an admin assigns one)
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (user_id, email, nome)
  values (new.id, new.email, nullif(new.raw_user_meta_data->>'nome',''))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. RLS on the four data tables: staff only
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['lotti_magazzino','ordini_impegni','anagrafica_vite','anagrafica_portainnesto']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_read on public.%I', t);
    execute format('drop policy if exists staff_write on public.%I', t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('create policy staff_write on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- profiles: everyone reads their own row, staff read all and assign roles
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy profiles_update on public.profiles
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.lotti_magazzino, public.ordini_impegni,
      public.anagrafica_vite, public.anagrafica_portainnesto to authenticated;
grant select, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 4. report views: definer-owned, role filter embedded, nothing for anon
-- ---------------------------------------------------------------------------
create or replace view public.riepilogo_disponibilita as
select r.*
from (
  select l.tipologia, l.produzione, l.codice_varieta, l.codice_clone, l.codice_portainnesto,
         sum(l.quantita_magazzino) as giacenza_magazzino,
         sum(l.quantita_ordinata)  as totale_ordinato,
         sum(l.quantita_spedita)   as di_cui_spedite,
         sum(l.quantita_ordinata) - sum(l.quantita_spedita) as quantita_da_spedire,
         sum(l.quantita_magazzino) - sum(l.quantita_ordinata) as disponibilita_residua
  from (
    select tipologia, produzione, codice_varieta, codice_clone, codice_portainnesto,
           quantita as quantita_magazzino, 0 as quantita_ordinata, 0 as quantita_spedita
      from public.lotti_magazzino
    union all
    select tipologia, produzione, codice_varieta, codice_clone, codice_portainnesto,
           0, quantita, case when spedito then quantita else 0 end
      from public.ordini_impegni
  ) l
  group by 1,2,3,4,5
) r
where public.auth_role() is not null;          -- any of the four roles

create or replace view public.vista_riepilogo_disponibilita as
  select * from public.riepilogo_disponibilita;

create or replace view public.vista_disponibilita_negative as
select (codice_varieta || '_' || codice_clone || '_' || codice_portainnesto) as id,
       codice_varieta, codice_clone, codice_portainnesto, tipologia, produzione,
       giacenza_magazzino as quantita_magazzino,
       totale_ordinato    as quantita_impegnata,
       disponibilita_residua as disponibilita_effettiva
from public.riepilogo_disponibilita
where disponibilita_residua < 0
  and public.auth_role() in ('admin','ufficio','produttore');   -- vendite excluded

-- lots without the producer column, for the produttore/vendite home screen
create or replace view public.vista_lotti_senza_produttore as
select id, anno_conferimento, tipologia, produzione, codice_varieta, codice_clone,
       codice_portainnesto, quantita, created_at
from public.lotti_magazzino
where public.auth_role() is not null;

revoke all on public.riepilogo_disponibilita, public.vista_riepilogo_disponibilita,
              public.vista_disponibilita_negative, public.vista_lotti_senza_produttore from anon;
grant select on public.riepilogo_disponibilita, public.vista_riepilogo_disponibilita,
      public.vista_disponibilita_negative, public.vista_lotti_senza_produttore to authenticated;

commit;
