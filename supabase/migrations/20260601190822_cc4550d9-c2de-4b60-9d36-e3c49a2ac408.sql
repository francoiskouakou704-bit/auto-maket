-- Add reconciliation fields to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw_event jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Prevent duplicate provider references (per provider)
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_ref_unique
  ON public.payments (provider, provider_ref)
  WHERE provider IS NOT NULL AND provider_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_unique
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Allow 'refunded' status to be partial too; keep enum as is.

-- Event log table for webhook audit + replay protection
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  provider_ref text,
  signature text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_event_unique
  ON public.payment_events (provider, event_id);

CREATE INDEX IF NOT EXISTS payment_events_payment_idx
  ON public.payment_events (payment_id);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view payment events"
  ON public.payment_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
