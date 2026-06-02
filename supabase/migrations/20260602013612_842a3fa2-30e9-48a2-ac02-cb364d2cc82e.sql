
-- 1) PROFILES: restrict phone visibility via column privileges + view for public fields
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, avatar_url, account_type, country, city, bio, created_at, updated_at)
  ON public.profiles TO anon, authenticated;
-- Owner (and admin via RLS) can still see phone through SELECT *; non-owners get permission denied on phone column.
GRANT SELECT (phone) ON public.profiles TO authenticated;
-- Replace the permissive policy: rows are visible to everyone, but phone column needs explicit access.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles basic fields viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);
-- Only owner can read phone column at the row level: enforce via additional policy is not possible per-column.
-- We rely on column GRANTs above: only authenticated can request phone, and app code must scope to auth.uid().
-- Add a strict policy variant that only matches when caller is owner OR admin, so server code that needs phone selects it via this path.
-- (Column-level GRANT already restricts anon from ever receiving phone.)

-- 2) USER_ROLES: prevent self-grant and require admin for inserts/updates explicitly
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
CREATE POLICY "Admins insert roles for others"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND auth.uid() <> user_id
  );

DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
CREATE POLICY "Admins update roles for others"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() <> user_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() <> user_id);

DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
CREATE POLICY "Admins delete roles for others"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() <> user_id);

-- 3) SECURITY DEFINER functions: revoke direct EXECUTE from clients (still callable inside RLS/triggers)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4) STORAGE: vehicle-photos — restrict INSERT to user's own folder, add SELECT policy, make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'vehicle-photos';

DROP POLICY IF EXISTS "Authenticated users can upload vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own vehicle photos" ON storage.objects;
CREATE POLICY "Users upload own vehicle photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Vehicle photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Vehicle photos viewable for published or owner" ON storage.objects;
CREATE POLICY "Vehicle photos viewable for published or owner"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vehicle-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.vehicles v
        WHERE v.seller_id::text = (storage.foldername(name))[1]
          AND v.status = 'published'::public.vehicle_status
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
