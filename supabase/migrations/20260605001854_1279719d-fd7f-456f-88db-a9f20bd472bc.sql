
ALTER TABLE public.export_system_state
  ADD COLUMN IF NOT EXISTS sandbox_mode boolean NOT NULL DEFAULT false;

-- Recreate alert check with sandbox awareness
CREATE OR REPLACE FUNCTION public.check_export_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
  v_sandbox boolean;
  v_blocked int := 0;
  v_mitigation jsonb;
BEGIN
  SELECT auto_mitigation_enabled, sandbox_mode
    INTO v_auto, v_sandbox
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
          IF v_sandbox THEN
            v_mitigation := jsonb_build_object(
              'action','degraded_mode',
              'simulated', true,
              'duration_min', EXTRACT(EPOCH FROM v_degrade_duration)/60,
              'until', (now() + v_degrade_duration)
            );
          ELSE
            UPDATE public.export_system_state
              SET degraded_until = now() + v_degrade_duration, updated_at = now()
              WHERE id = true;
            v_mitigation := jsonb_build_object(
              'action','degraded_mode',
              'simulated', false,
              'duration_min', EXTRACT(EPOCH FROM v_degrade_duration)/60,
              'until', (now() + v_degrade_duration)
            );
          END IF;
        END IF;
        INSERT INTO public.export_alerts(kind, severity, message, details, mitigation)
        VALUES (
          'failure_rate',
          CASE WHEN v_rate >= 0.6 THEN 'critical' ELSE 'warning' END,
          CASE WHEN v_sandbox THEN '[SANDBOX] ' ELSE '' END ||
          format('Taux d''échec exports: %s%% (%s/%s) sur 15 min',
                 round(v_rate*100,1), v_failed, v_total),
          jsonb_build_object(
            'window_min',15,'total',v_total,'failed',v_failed,'rate',v_rate,
            'threshold',v_fail_threshold,'sandbox',v_sandbox
          ),
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
        IF v_sandbox THEN
          SELECT count(*) INTO v_blocked
          FROM (
            SELECT user_id
            FROM public.export_replay_attempts
            WHERE created_at >= now() - v_window AND user_id IS NOT NULL
            GROUP BY user_id
            HAVING count(*) >= v_per_user_replay_min
          ) s;
          v_mitigation := jsonb_build_object(
            'action','user_blocks',
            'simulated', true,
            'blocked_users', v_blocked,
            'duration_min', EXTRACT(EPOCH FROM v_block_duration)/60
          );
        ELSE
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
            'simulated', false,
            'blocked_users', v_blocked,
            'duration_min', EXTRACT(EPOCH FROM v_block_duration)/60
          );
        END IF;
      END IF;
      INSERT INTO public.export_alerts(kind, severity, message, details, mitigation)
      VALUES (
        'replay_spike',
        CASE WHEN v_replays >= 20 THEN 'critical' ELSE 'warning' END,
        CASE WHEN v_sandbox THEN '[SANDBOX] ' ELSE '' END ||
        format('Pic de tentatives de replay (nonce): %s sur 15 min', v_replays),
        jsonb_build_object('window_min',15,'replays',v_replays,'threshold',v_replay_threshold,'sandbox',v_sandbox),
        v_mitigation
      );
    END IF;
  END IF;
END;
$function$;

-- Simulate abuse by inserting synthetic, clearly-tagged rows
CREATE OR REPLACE FUNCTION public.simulate_export_abuse(
  _caller uuid,
  _failures int DEFAULT 12,
  _replays int DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sandbox boolean;
  i int;
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT sandbox_mode INTO v_sandbox FROM public.export_system_state WHERE id = true;
  IF NOT COALESCE(v_sandbox, false) THEN
    RAISE EXCEPTION 'sandbox_disabled';
  END IF;

  FOR i IN 1.._failures LOOP
    INSERT INTO public.export_logs(
      user_id, format, nonce, query, ip, user_agent, success, error
    ) VALUES (
      _caller, 'pdf',
      'sandbox-fail-' || gen_random_uuid()::text,
      '[SANDBOX] synthetic failure',
      '127.0.0.1', 'sandbox-simulator', false, 'sandbox_simulated'
    );
  END LOOP;

  FOR i IN 1.._replays LOOP
    INSERT INTO public.export_replay_attempts(user_id, nonce, ip, user_agent)
    VALUES (_caller, 'sandbox-replay-' || gen_random_uuid()::text,
            '127.0.0.1', 'sandbox-simulator');
  END LOOP;

  PERFORM public.check_export_alerts();
  RETURN jsonb_build_object('ok', true, 'failures', _failures, 'replays', _replays);
END;
$function$;

-- Cleanup helper: removes synthetic sandbox rows
CREATE OR REPLACE FUNCTION public.clear_sandbox_data(_caller uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_logs int;
  v_replays int;
  v_alerts int;
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH d AS (
    DELETE FROM public.export_logs
    WHERE nonce LIKE 'sandbox-fail-%' OR error = 'sandbox_simulated'
    RETURNING 1
  ) SELECT count(*) INTO v_logs FROM d;

  WITH d AS (
    DELETE FROM public.export_replay_attempts
    WHERE nonce LIKE 'sandbox-replay-%'
    RETURNING 1
  ) SELECT count(*) INTO v_replays FROM d;

  WITH d AS (
    DELETE FROM public.export_alerts
    WHERE (details->>'sandbox')::boolean IS TRUE
       OR message LIKE '[SANDBOX]%'
    RETURNING 1
  ) SELECT count(*) INTO v_alerts FROM d;

  RETURN jsonb_build_object('logs', v_logs, 'replays', v_replays, 'alerts', v_alerts);
END;
$function$;
