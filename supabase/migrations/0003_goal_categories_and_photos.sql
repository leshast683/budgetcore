-- BudgetCore — goal categories + photo uploads
-- Adds a category tag to goals (used for the icon picker on the Goals page)
-- and a photo_url pointing at a file in the new "goal-photos" storage bucket.

alter table public.goals
  add column category text not null default 'other',
  add column photo_url text;

-- ── goal-photos storage bucket ─────────────────────────────────────────────
-- Public bucket (photos are just decorative goal art, not sensitive) so we
-- can read them back with a plain public URL. Writes are still owner-only,
-- enforced by keying every object's path to the uploader's user id:
-- goal-photos/<user_id>/<filename>.
insert into storage.buckets (id, name, public)
values ('goal-photos', 'goal-photos', true)
on conflict (id) do nothing;

create policy "goal photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'goal-photos');

create policy "goal photos are owner-only insert"
  on storage.objects for insert
  with check (bucket_id = 'goal-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "goal photos are owner-only update"
  on storage.objects for update
  using (bucket_id = 'goal-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "goal photos are owner-only delete"
  on storage.objects for delete
  using (bucket_id = 'goal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
