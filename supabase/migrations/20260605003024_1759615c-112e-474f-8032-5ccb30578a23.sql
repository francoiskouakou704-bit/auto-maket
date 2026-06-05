CREATE TABLE public.export_sandbox_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  failures integer NOT NULL DEFAULT 0,
  successes integer NOT NULL DEFAULT 0,
  replays integer NOT NULL DEFAULT 0,
  spread_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_sandbox_presets TO authenticated;
GRANT ALL ON public.export_sandbox_presets TO service_role;

ALTER TABLE public.export_sandbox_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own sandbox presets" ON public.export_sandbox_presets
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = owner_id);

CREATE POLICY "Admins insert own sandbox presets" ON public.export_sandbox_presets
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = owner_id);

CREATE POLICY "Admins update own sandbox presets" ON public.export_sandbox_presets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = owner_id);

CREATE POLICY "Admins delete own sandbox presets" ON public.export_sandbox_presets
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = owner_id);

CREATE TRIGGER set_export_sandbox_presets_updated_at
  BEFORE UPDATE ON public.export_sandbox_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();