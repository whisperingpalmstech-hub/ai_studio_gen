-- Fix: Drop old policies that used auth.role() and recreate with current_setting('role')
-- auth.role() may not work consistently. current_setting('role') is the PostgreSQL-level check.

-- Drop old policies (IF EXISTS to avoid errors)
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access on jobs" ON public.jobs;
DROP POLICY IF EXISTS "Service role full access on assets" ON public.assets;
DROP POLICY IF EXISTS "Service role full access on models" ON public.models;
DROP POLICY IF EXISTS "Service role full access on workflows" ON public.workflows;
DROP POLICY IF EXISTS "Service role full access on teams" ON public.teams;
DROP POLICY IF EXISTS "Service role full access on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Service role full access on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role full access on credit_transactions" ON public.credit_transactions;

-- Recreate with current_setting('role') which correctly reads the PostgreSQL role
CREATE POLICY "Service role full access on profiles"
  ON public.profiles FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');

CREATE POLICY "Service role full access on jobs"
  ON public.jobs FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');

CREATE POLICY "Service role full access on assets"
  ON public.assets FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');

CREATE POLICY "Service role full access on models"
  ON public.models FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');

CREATE POLICY "Service role full access on workflows"
  ON public.workflows FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');

CREATE POLICY "Service role full access on teams"
  ON public.teams FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');

CREATE POLICY "Service role full access on team_members"
  ON public.team_members FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');

CREATE POLICY "Service role full access on subscriptions"
  ON public.subscriptions FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');

CREATE POLICY "Service role full access on credit_transactions"
  ON public.credit_transactions FOR ALL
  USING ((SELECT current_setting('role')) = 'service_role')
  WITH CHECK ((SELECT current_setting('role')) = 'service_role');
