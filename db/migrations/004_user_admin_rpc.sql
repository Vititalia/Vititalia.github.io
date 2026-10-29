-- Vignero · 004 — create users from the web GUI, without the service key
--
-- The browser holds only the publishable key, so it cannot call GoTrue's admin
-- API. These SECURITY DEFINER functions run as their owner, verify the CALLER is
-- staff through auth_role(), and are executable by `authenticated` only. The
-- generated password is returned once to the administrator who created the user.
begin;

create or replace function public.create_user(
  p_email  text,
  p_nome   text,
  p_role   text,
  p_grower text default null
) returns table (email text, temp_password text)
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_caller text := public.auth_role();
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_id     uuid := gen_random_uuid();
  v_pwd    text;
begin
  if not public.is_staff() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email non valida';
  end if;
  if coalesce(p_role, '') not in ('admin','ufficio','produttore','vendite') then
    raise exception 'Ruolo non valido';
  end if;
  -- only an administrator may create (or later promote to) an administrator
  if p_role = 'admin' and v_caller <> 'admin' then
    raise exception 'Solo un amministratore può creare un altro amministratore' using errcode = '42501';
  end if;
  if p_role = 'produttore' and coalesce(trim(p_grower), '') = '' then
    raise exception 'Per un produttore indica il produttore collegato';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Esiste già un utente con questa email';
  end if;

  v_pwd := 'Vg' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) || '!7';

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token, email_change,
                          email_change_token_new, email_change_token_current,
                          phone_change, phone_change_token, reauthentication_token,
                          is_super_admin)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
          v_email, crypt(v_pwd, gen_salt('bf')), now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('nome', coalesce(nullif(trim(p_nome), ''), v_email)),
          '', '', '', '', '', '', '', '', false);

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());

  -- the on_auth_user_created trigger already inserted the profile row
  update public.profiles
     set role = p_role,
         nome = coalesce(nullif(trim(p_nome), ''), v_email),
         grower = case when p_role = 'produttore' then trim(p_grower) else null end,
         attivo = true
   where user_id = v_id;

  return query select v_email, v_pwd;
end $$;

create or replace function public.reset_user_password(p_email text)
returns table (email text, temp_password text)
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_caller text := public.auth_role();
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_target text;
  v_pwd    text;
begin
  if not public.is_staff() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  select p.role into v_target from public.profiles p where lower(p.email) = v_email;
  if v_target is null then
    raise exception 'Utente non trovato';
  end if;
  if v_target = 'admin' and v_caller <> 'admin' then
    raise exception 'Solo un amministratore può reimpostare la password di un amministratore' using errcode = '42501';
  end if;

  v_pwd := 'Vg' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) || '!7';
  -- qualify the column: `email` is also an OUT parameter of this function
  update auth.users u
     set encrypted_password = crypt(v_pwd, gen_salt('bf')), updated_at = now()
   where lower(u.email) = v_email;

  return query select v_email, v_pwd;
end $$;

create or replace function public.delete_user(p_email text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_caller text := public.auth_role();
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_target text;
begin
  if v_caller <> 'admin' then
    raise exception 'Solo un amministratore può eliminare un utente' using errcode = '42501';
  end if;
  select p.role into v_target from public.profiles p where lower(p.email) = v_email;
  if v_target is null then raise exception 'Utente non trovato'; end if;
  if v_target = 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Deve restare almeno un amministratore';
  end if;
  delete from auth.users where lower(email) = v_email;   -- cascades to profiles
end $$;

revoke all on function public.create_user(text,text,text,text) from public, anon;
revoke all on function public.reset_user_password(text) from public, anon;
revoke all on function public.delete_user(text) from public, anon;
grant execute on function public.create_user(text,text,text,text) to authenticated;
grant execute on function public.reset_user_password(text) to authenticated;
grant execute on function public.delete_user(text) to authenticated;

commit;
