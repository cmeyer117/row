-- ============================================================
-- progress-photos bucket: public -> private, add owner select policy
-- 2026-08-14 audit finding: the bucket was public:true, so anyone who
-- guessed/found a filename could view Carl's physique progress photos
-- with no auth check -- UUID filenames were obscurity, not access
-- control. Making the bucket private closes that; a matching
-- authenticated+owner SELECT policy is required so gym-weight-photos.js
-- can still mint signed URLs for itself via createSignedUrl (which
-- checks storage.objects SELECT permission even for the owner).
-- ============================================================

update storage.buckets set public = false where name = 'progress-photos';

create policy "owner read progress-photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and public.coaching_is_owner());
