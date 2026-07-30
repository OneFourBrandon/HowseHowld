-- Run once after deploying push-dispatch. Replace the placeholders before
-- executing in the Supabase SQL editor. Secrets remain encrypted in Vault.
select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('PUBLISHABLE_KEY', 'publishable_key');
select vault.create_secret('LONG_RANDOM_DISPATCH_SECRET', 'dispatch_secret');

select cron.schedule(
  'howsehowld-dispatch-web-push',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/push-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'X-Dispatch-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_secret')
      ),
      body := '{}'::jsonb
    );
  $$
)
where not exists (
  select 1 from cron.job where jobname = 'howsehowld-dispatch-web-push'
);
