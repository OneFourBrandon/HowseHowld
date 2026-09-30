-- Cron and the Edge Function share the encrypted Vault credential. Only the
-- server's service role can validate it; no client can read or test secrets.
create function private.verify_push_dispatch_secret_impl(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(char_length(p_secret) >= 32 and exists (
    select 1 from vault.decrypted_secrets
    where name = 'dispatch_secret' and decrypted_secret = p_secret
  ), false)
$$;
revoke all on function private.verify_push_dispatch_secret_impl(text) from public, anon, authenticated;
grant execute on function private.verify_push_dispatch_secret_impl(text) to service_role;

create function public.verify_push_dispatch_secret(p_secret text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.verify_push_dispatch_secret_impl(p_secret)
$$;
revoke all on function public.verify_push_dispatch_secret(text) from public, anon, authenticated;
grant execute on function public.verify_push_dispatch_secret(text) to service_role;
