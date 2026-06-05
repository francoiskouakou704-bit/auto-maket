CREATE OR REPLACE FUNCTION public.simulate_export_abuse(
  _caller uuid,
  _failures integer DEFAULT 12,
  _replays integer DEFAULT 6,
  _successes integer DEFAULT 0,
  _spread_minutes integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sandbox boolean;
  i int;
  v_spread int := GREATEST(COALESCE(_spread_minutes, 0), 0);
  v_ts timestamptz;
  v_target_rate numeric;
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT sandbox_mode INTO v_sandbox FROM public.export_system_state WHERE id = true;
  IF NOT COALESCE(v_sandbox, false) THEN
    RAISE EXCEPTION 'sandbox_disabled';
  END IF;

  FOR i IN 1.._failures LOOP
    v_ts := CASE WHEN v_spread > 0
                 THEN now() - (random() * (v_spread || ' minutes')::interval)
                 ELSE now() END;
    INSERT INTO public.export_logs(
      user_id, format, nonce, query, ip, user_agent, success, error, created_at
    ) VALUES (
      _caller, 'pdf',
      'sandbox-fail-' || gen_random_uuid()::text,
      '[SANDBOX] synthetic failure',
      '127.0.0.1', 'sandbox-simulator', false, 'sandbox_simulated', v_ts
    );
  END LOOP;

  FOR i IN 1.._successes LOOP
    v_ts := CASE WHEN v_spread > 0
                 THEN now() - (random() * (v_spread || ' minutes')::interval)
                 ELSE now() END;
    INSERT INTO public.export_logs(
      user_id, format, nonce, query, ip, user_agent, success, error, created_at
    ) VALUES (
      _caller, 'pdf',
      'sandbox-ok-' || gen_random_uuid()::text,
      '[SANDBOX] synthetic success',
      '127.0.0.1', 'sandbox-simulator', true, NULL, v_ts
    );
  END LOOP;

  FOR i IN 1.._replays LOOP
    v_ts := CASE WHEN v_spread > 0
                 THEN now() - (random() * (v_spread || ' minutes')::interval)
                 ELSE now() END;
    INSERT INTO public.export_replay_attempts(user_id, nonce, ip, user_agent, created_at)
    VALUES (_caller, 'sandbox-replay-' || gen_random_uuid()::text,
            '127.0.0.1', 'sandbox-simulator', v_ts);
  END LOOP;

  PERFORM public.check_export_alerts();

  v_target_rate := CASE WHEN (_failures + _successes) > 0
                        THEN _failures::numeric / (_failures + _successes)::numeric
                        ELSE NULL END;

  RETURN jsonb_build_object(
    'ok', true,
    'failures', _failures,
    'successes', _successes,
    'replays', _replays,
    'spread_minutes', v_spread,
    'target_failure_rate', v_target_rate
  );
END;
$function$;

-- Also clean synthetic successes
CREATE OR REPLACE FUNCTION public.clear_sandbox_data(_caller uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    WHERE nonce LIKE 'sandbox-fail-%'
       OR nonce LIKE 'sandbox-ok-%'
       OR error = 'sandbox_simulated'
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