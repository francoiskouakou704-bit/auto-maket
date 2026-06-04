
-- Plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'premium');

-- Subscriptions: one row per user (upserted)
CREATE TABLE public.subscriptions (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own subscription" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subscription" ON public.subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update any subscription" ON public.subscriptions
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Search history
CREATE TABLE public.search_history (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  synthesis TEXT,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX search_history_user_created_idx ON public.search_history(user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.search_history TO authenticated;
GRANT ALL ON public.search_history TO service_role;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own history" ON public.search_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own history" ON public.search_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own history" ON public.search_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Helper to check effective plan
CREATE OR REPLACE FUNCTION public.get_user_plan(_uid UUID)
RETURNS public.subscription_plan
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
     WHERE user_id = _uid
       AND plan = 'premium'
       AND (expires_at IS NULL OR expires_at > now())
     LIMIT 1),
    'free'::public.subscription_plan
  )
$$;

-- Count today's searches (for quota)
CREATE OR REPLACE FUNCTION public.count_searches_today(_uid UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.search_history
  WHERE user_id = _uid AND created_at >= date_trunc('day', now())
$$;
