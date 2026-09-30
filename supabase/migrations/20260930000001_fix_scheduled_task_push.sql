-- The test button uses the authenticated client. Cron calls the same function
-- through pg_net and must also present the project's API key to the gateway.
create or replace function private.dispatch_scheduled_push()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  project_url text;
  dispatch_secret text;
  publishable_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='project_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets where name='dispatch_secret';
  select decrypted_secret into publishable_key from vault.decrypted_secrets where name='publishable_key';
  if project_url is null or dispatch_secret is null or publishable_key is null then
    raise exception 'Push scheduler needs project_url, dispatch_secret and publishable_key in Vault';
  end if;
  return net.http_post(url := rtrim(project_url, '/') || '/functions/v1/push-dispatch',
    headers := jsonb_build_object('Content-Type','application/json',
      'apikey',publishable_key,'X-Dispatch-Secret',dispatch_secret),
    body := '{}'::jsonb, timeout_milliseconds := 10000);
end $$;
revoke all on function private.dispatch_scheduled_push() from public,anon,authenticated;

select cron.schedule('howsehowld-dispatch-web-push','* * * * *',
  'select private.dispatch_scheduled_push()')
where not exists (select 1 from cron.job where jobname='howsehowld-dispatch-web-push');
