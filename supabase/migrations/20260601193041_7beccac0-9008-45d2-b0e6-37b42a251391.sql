CREATE TABLE IF NOT EXISTS public.payment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  details jsonb,
  status text NOT NULL DEFAULT 'open',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_alerts_payment_idx ON public.payment_alerts(payment_id);
CREATE INDEX IF NOT EXISTS payment_alerts_status_idx ON public.payment_alerts(status);

GRANT SELECT, UPDATE, DELETE ON public.payment_alerts TO authenticated;
GRANT ALL ON public.payment_alerts TO service_role;

ALTER TABLE public.payment_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view payment alerts"
  ON public.payment_alerts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update payment alerts"
  ON public.payment_alerts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete payment alerts"
  ON public.payment_alerts FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER payment_alerts_updated_at
  BEFORE UPDATE ON public.payment_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
