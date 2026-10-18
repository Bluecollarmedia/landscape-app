-- 048: make sure the public "media" photo bucket and its rules exist.
-- Needs: nothing. Safe to run any number of times; it changes nothing that is already correct.
-- Why: these were created only at the end of supabase/schema.sql. A database built mostly from the numbered updates
--   can be missing them, and every profile / project / maintenance / issue photo upload then fails
--   with "Bucket not found" or a row-level-security error.
-- What it sets up (the same rules as schema.sql):
--   * bucket "media" (public, so photo links open in the app)
--   * anyone can view; any signed-in person can upload; only the uploader can delete their own file.
-- It does NOT touch the private "snow-media" bucket (that is update 022) and sets no size limit.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists media_authenticated_upload on storage.objects;
create policy media_authenticated_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'media');

drop policy if exists media_owner_delete on storage.objects;
create policy media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and owner = auth.uid());
