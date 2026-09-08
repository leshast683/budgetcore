-- BudgetCore — welcome email trigger
-- Calls api/send-welcome-email.js (Resend) the moment a new auth.users row is
-- inserted, via pg_net (async HTTP from Postgres). Bypasses the Dashboard's
-- Database Webhooks UI, which hit a "schema supabase_functions does not exist"
-- error on this project.

create extension if not exists pg_net with schema extensions;

create function public.notify_welcome_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://www.budgetcore.net/api/send-welcome-email',
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', new.id,
        'email', new.email,
        'raw_user_meta_data', new.raw_user_meta_data
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- Must match WELCOME_EMAIL_SECRET in Vercel's env vars.
      'Authorization', 'Bearer f719181d140a8b72e989947563b1040c054f86a6f6cd7deb104ff9371fe03458'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created_send_welcome_email
  after insert on auth.users
  for each row execute function public.notify_welcome_email();
