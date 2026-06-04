
-- System state (single row)
CREATE TABLE public.export_system_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  auto_mitigation_enabled boolean NOT NULL DEFAULT true,
  base_rate_limit_per_min int NOT NULL DEFAULT 10,
  degraded_rate_limit_per_min int NOT NULL DEFAULT 3,
  degraded_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.export_system_state TO authenticated;
GRANT ALL ON public.export_system_state TO service_role;
ALTER TABLE public.export_system_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view export state"
  ON public.export_system_state FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update export state"
  ON public.export_system_state FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
INSERT INTO public.export_system_state(id) VALUES (true);

-- User blocks
CREATE TABLE public.export_user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  blocked_until timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.export_user_blocks TO authenticated;
GRANT ALL ON public.export_user_blocks TO service_role;
ALTER TABLE public.export_user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view user blocks"
  ON public.export_user_blocks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update user blocks"
  ON public.export_user_blocks FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete user blocks"
  ON public.export_user_blocks FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_export_user_blocks_user_active
  ON public.export_user_blocks(user_id, blocked_until DESC);

-- Track mitigation on alerts
ALTER TABLE public.export_alerts ADD COLUMN mitigation jsonb;

-- Replace evaluator with auto-mitigation logic
CREATE OR REPLACE FUNCTION public.check_export_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window interval := interval '15 minutes';
  v_min_attempts int := 10;
  v_fail_threshold numeric := 0.30;
  v_replay_threshold int := 5;
  v_dedup interval := interval '30 minutes';
  v_block_duration interval := interval '1 hour';
  v_degrade_duration interval := interval '30 minutes';
  v_per_user_replay_min int := 3;
  v_total int;
  v_failed int;
  v_rate numeric;
  v_replays int;
  v_auto boolean;
  v_blocked int := 0;
  v_mitigation jsonb;
BEGIN
  SELECT auto_mitigation_enabled INTO v_auto
    FROM public.export_system_state WHERE id = true;

  -- Failure rate
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
        v_mitigation := NULL;
        IF v_auto THEN
          UPDATE public.export_system_state
            SET degraded_until = now() + v_degrade_duration, updated_at = now()
            WHERE id = true;
          v_mitigation := jsonb_build_object(
            'action','degraded_mode',
            'duration_min', EXTRACT(EPOCH FROM v_degrade_duration)/60,
            'until', (now() + v_degrade_duration)
          );
        END IF;
        INSERT INTO public.export_alerts(kind, severity, message, details, mitigation)
        VALUES (
          'failure_rate',
          CASE WHEN v_rate >= 0.6 THEN 'critical' ELSE 'warning' END,
          format('Taux d''échec exports: %s%% (%s/%s) sur 15 min',
                 round(v_rate*100,1), v_failed, v_total),
          jsonb_build_object('window_min',15,'total',v_total,'failed',v_failed,'rate',v_rate,'threshold',v_fail_threshold),
          v_mitigation
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
      v_mitigation := NULL;
      IF v_auto THEN
        WITH offenders AS (
          SELECT user_id, count(*) AS cnt
          FROM public.export_replay_attempts
          WHERE created_at >= now() - v_window AND user_id IS NOT NULL
          GROUP BY user_id
          HAVING count(*) >= v_per_user_replay_min
        )
        INSERT INTO public.export_user_blocks(user_id, reason, blocked_until)
        SELECT o.user_id,
               format('Auto: %s replays de nonce en 15 min', o.cnt),
               now() + v_block_duration
        FROM offenders o;
        GET DIAGNOSTICS v_blocked = ROW_COUNT;
        v_mitigation := jsonb_build_object(
          'action','user_blocks',
          'blocked_users', v_blocked,
          'duration_min', EXTRACT(EPOCH FROM v_block_duration)/60
        );
      END IF;
      INSERT INTO public.export_alerts(kind, severity, message, details, mitigation)
      VALUES (
        'replay_spike',
        CASE WHEN v_replays >= 20 THEN 'critical' ELSE 'warning' END,
        format('Pic de tentatives de replay (nonce): %s sur 15 min', v_replays),
        jsonb_build_object('window_min',15,'replays',v_replays,'threshold',v_replay_threshold),
        v_mitigation
      );
    END IF;
  END IF;
END;
$$;
