-- Vignero · 006 — an administrator chooses (not just generates) a password
--
-- Resetting a password returns a generated one-time password, which is fine for
-- an invitation but wrong when the office wants to hand over a password the
-- person already knows (e.g. re-aligning a shared account). Setting an
-- arbitrary password for *another* user needs the Admin API, whose secret key
-- cannot reach the browser, so the operation lives in a SECURITY DEFINER
-- function with the same rules as reset_user_password.
begin;

create or replace function public.set_user_password(p_email text, p_password text)
returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_caller text := public.auth_role();
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_pwd    text := coalesce(p_password, '');
  v_target text;
begin
  if not public.is_staff() then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  if char_length(v_pwd) < 8 or char_length(v_pwd) > 72 then
    raise exception 'La password deve avere fra 8 e 72 caratteri';
  end if;
  if v_pwd = v_email then
    raise exception 'La password non può essere l''indirizzo email';
  end if;
  select p.role into v_target from public.profiles p where lower(p.email) = v_email;
  if v_target is null then
    raise exception 'Utente non trovato';
  end if;
  if v_target = 'admin' and v_caller <> 'admin' then
    raise exception 'Solo un amministratore può impostare la password di un amministratore'
      using errcode = '42501';
  end if;

  -- qualify the column: `email` would otherwise be ambiguous with the parameter
  update auth.users u
     set encrypted_password = crypt(v_pwd, gen_salt('bf')), updated_at = now()
   where lower(u.email) = v_email;
end $$;

revoke all on function public.set_user_password(text, text) from public, anon;
grant execute on function public.set_user_password(text, text) to authenticated;

commit;
