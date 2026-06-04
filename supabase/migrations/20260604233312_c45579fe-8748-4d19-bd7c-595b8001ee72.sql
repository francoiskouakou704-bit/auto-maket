
CREATE TABLE public.export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  history_id uuid,
  format text NOT NULL CHECK (format IN ('pdf','docx')),
  nonce text NOT NULL,
  query text,
  ip text,
  user_agent text,
  success boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX export_logs_user_nonce_idx ON public.export_logs(user_id, nonce);
CREATE INDEX export_logs_user_created_idx ON public.export_logs(user_id, created_at DESC);

GRANT SELECT ON public.export_logs TO authenticated;
GRANT ALL ON public.export_logs TO service_role;

ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own export logs"
  ON public.export_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all export logs"
  ON public.export_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
