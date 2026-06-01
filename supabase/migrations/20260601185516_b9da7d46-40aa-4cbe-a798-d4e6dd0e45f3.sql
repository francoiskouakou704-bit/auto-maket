
-- REPORTS
CREATE TYPE report_status AS ENUM ('pending','reviewing','resolved','dismissed');
CREATE TYPE report_reason AS ENUM ('fraud','duplicate','inappropriate','wrong_info','sold','other');

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason report_reason NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users view own reports" ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update reports" ON public.reports FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete reports" ON public.reports FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYMENTS
CREATE TYPE payment_status AS ENUM ('pending','succeeded','failed','refunded');
CREATE TYPE payment_kind AS ENUM ('boost','featured','subscription','other');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid,
  kind payment_kind NOT NULL DEFAULT 'boost',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status payment_status NOT NULL DEFAULT 'pending',
  provider text,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update payments" ON public.payments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ADMIN POLICIES on existing tables
CREATE POLICY "Admins view all profiles updates" ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete profiles" ON public.profiles FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE POLICY "Admins view all vehicles" ON public.vehicles FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update any vehicle" ON public.vehicles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete any vehicle" ON public.vehicles FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Allow admins to manage user_roles
CREATE POLICY "Admins insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));
