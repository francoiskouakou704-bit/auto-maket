
-- 1. Table for replay attempt logging (cannot use export_logs due to unique (user_id, nonce))
CREATE TABLE public.export_replay_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  nonce text NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.export_replay_attempts TO authenticated;
GRANT ALL ON public.export_replay_attempts TO service_role;
ALTER TABLE public.export_replay_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view replay attempts"
  ON public.export_replay_attempts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_export_replay_created ON public.export_replay_attempts(created_at DESC);

-- 2. Alerts table
CREATE TABLE public.export_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- 'failure_rate' | 'replay_spike'
  severity text NOT NULL DEFAULT 'warning', -- 'warning' | 'critical'
  message text NOT NULL,
  details jsonb,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'acknowledged' | 'resolved'
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.export_alerts TO authenticated;
GRANT ALL ON public.export_alerts TO service_role;
ALTER TABLE public.export_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view export alerts"
  ON public.export_alerts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update export alerts"
  ON public.export_alerts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_export_alerts_updated
  BEFORE UPDATE ON public.export_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_export_alerts_open ON public.export_alerts(created_at DESC) WHERE status = 'open';

-- 3. Evaluation function: thresholds hardcoded but easy to tune
CREATE OR REPLACE FUNCTION public.check_export_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window interval := interval '15 minutes';
  v_min_attempts int := 10;
  v_fail_threshold numeric := 0.30; -- 30%
  v_replay_threshold int := 5;
  v_dedup interval := interval '30 minutes';
  v_total int;
  v_failed int;
  v_rate numeric;
  v_replays int;
BEGIN
  -- Failure rate (latest row per nonce, only non-pending)
  SELECT count(*), count(*) FILTER (WHERE success = false AND COALESCE(error,'') <> 'pending')
    INTO v_total, v_failed
  FROM public.export_logs
  WHERE created_at >= now() - v_window
    AND COALESCE(error,'') <> 'pending';

  IF v_total >= v_min_attempts THEN
    v_rate := v_failed::numeric / v_total::numeric;
    IF v_rate >= v_fail_threshold THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.export_alerts
        WHERE kind = 'failure_rate' AND status = 'open'
          AND created_at >= now() - v_dedup
      ) THEN
        INSERT INTO public.export_alerts(kind, severity, message, details)
        VALUES (
          'failure_rate',
          CASE WHEN v_rate >= 0.6 THEN 'critical' ELSE 'warning' END,
          format('Taux d''échec exports: %s%% (%s/%s) sur 15 min',
                 round(v_rate*100,1), v_failed, v_total),
          jsonb_build_object('window_min',15,'total',v_total,'failed',v_failed,'rate',v_rate,'threshold',v_fail_threshold)
        );
      END IF;
    END IF;
  END IF;

  -- Replay spike
  SELECT count(*) INTO v_replays
  FROM public.export_replay_attempts
  WHERE created_at >= now() - v_window;

  IF v_replays >= v_replay_threshold THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.export_alerts
      WHERE kind = 'replay_spike' AND status = 'open'
        AND created_at >= now() - v_dedup
    ) THEN
      INSERT INTO public.export_alerts(kind, severity, message, details)
      VALUES (
        'replay_spike',
        CASE WHEN v_replays >= 20 THEN 'critical' ELSE 'warning' END,
        format('Pic de tentatives de replay (nonce): %s sur 15 min', v_replays),
        jsonb_build_object('window_min',15,'replays',v_replays,'threshold',v_replay_threshold)
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_export_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_export_alerts() TO service_role;

-- 4. Schedule via pg_cron every 5 min
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'check-export-alerts',
  '*/5 * * * *',
  $cron$ SELECT public.check_export_alerts(); $cron$
);
