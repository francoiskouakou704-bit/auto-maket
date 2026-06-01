CREATE TABLE public.admin_notification_preferences (
  user_id uuid PRIMARY KEY,
  email_enabled boolean NOT NULL DEFAULT true,
  slack_enabled boolean NOT NULL DEFAULT true,
  severities text[] NOT NULL DEFAULT ARRAY['critical']::text[],
  notify_on_resolved boolean NOT NULL DEFAULT true,
  email_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notification_preferences TO authenticated;
GRANT ALL ON public.admin_notification_preferences TO service_role;

ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own notif prefs"
  ON public.admin_notification_preferences
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admins insert own notif prefs"
  ON public.admin_notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admins update own notif prefs"
  ON public.admin_notification_preferences
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admins delete own notif prefs"
  ON public.admin_notification_preferences
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE TRIGGER admin_notif_prefs_set_updated_at
  BEFORE UPDATE ON public.admin_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();