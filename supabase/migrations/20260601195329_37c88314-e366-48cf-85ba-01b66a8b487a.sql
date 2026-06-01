-- Extend payment_alerts for triage workflow
ALTER TABLE public.payment_alerts
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_comment text,
  ADD COLUMN IF NOT EXISTS proof_refund_ref text,
  ADD COLUMN IF NOT EXISTS proof_screenshot_url text,
  ADD COLUMN IF NOT EXISTS proof_payload jsonb;

CREATE INDEX IF NOT EXISTS payment_alerts_assigned_to_idx ON public.payment_alerts(assigned_to);
CREATE INDEX IF NOT EXISTS payment_alerts_status_severity_idx ON public.payment_alerts(status, severity);

-- Private bucket for proof screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('alert-proofs', 'alert-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can read/write proof files
DROP POLICY IF EXISTS "Admins read alert proofs" ON storage.objects;
CREATE POLICY "Admins read alert proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'alert-proofs' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins upload alert proofs" ON storage.objects;
CREATE POLICY "Admins upload alert proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'alert-proofs' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update alert proofs" ON storage.objects;
CREATE POLICY "Admins update alert proofs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'alert-proofs' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete alert proofs" ON storage.objects;
CREATE POLICY "Admins delete alert proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'alert-proofs' AND public.has_role(auth.uid(), 'admin'));