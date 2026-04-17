-- La app ?coach usa el cliente Supabase con rol `anon` (sin auth.uid()).
-- Ajustamos RLS y unicidad para check-ins / handoffs como el resto de tablas coach (p. ej. coach_session_feedback).

-- ── weekly_checkins: una fila por semana ISO y nombre de coach (normalizado) ──
ALTER TABLE public.weekly_checkins DROP CONSTRAINT IF EXISTS weekly_checkins_coach_id_week_iso_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'weekly_checkins'
      AND column_name = 'coach_name_norm'
  ) THEN
    ALTER TABLE public.weekly_checkins
      ADD COLUMN coach_name_norm text GENERATED ALWAYS AS (lower(trim(coach_name))) STORED;
  END IF;
END $$;

DROP INDEX IF EXISTS weekly_checkins_week_coach_name_norm_uq;
CREATE UNIQUE INDEX weekly_checkins_week_coach_name_norm_uq
  ON public.weekly_checkins (week_iso, coach_name_norm);

DROP POLICY IF EXISTS weekly_checkins_insert_own ON public.weekly_checkins;
DROP POLICY IF EXISTS weekly_checkins_select_own ON public.weekly_checkins;
DROP POLICY IF EXISTS weekly_checkins_admin_read ON public.weekly_checkins;

CREATE POLICY weekly_checkins_insert_anon
  ON public.weekly_checkins
  FOR INSERT
  TO anon
  WITH CHECK (
    coach_id IS NULL
    AND length(trim(coach_name)) > 0
    AND mood_score BETWEEN 1 AND 5
  );

CREATE POLICY weekly_checkins_update_anon
  ON public.weekly_checkins
  FOR UPDATE
  TO anon
  USING (coach_id IS NULL)
  WITH CHECK (
    coach_id IS NULL
    AND length(trim(coach_name)) > 0
    AND mood_score BETWEEN 1 AND 5
  );

CREATE POLICY weekly_checkins_select_anon
  ON public.weekly_checkins
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY weekly_checkins_insert_authenticated
  ON public.weekly_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY weekly_checkins_select_authenticated_own
  ON public.weekly_checkins
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY weekly_checkins_admin_read
  ON public.weekly_checkins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── daily_handoffs: lectura/escritura con anon (misma app) ─────────────────────
DROP POLICY IF EXISTS coaches_see_today ON public.daily_handoffs;
DROP POLICY IF EXISTS coaches_insert_own ON public.daily_handoffs;
DROP POLICY IF EXISTS admins_see_all_handoffs ON public.daily_handoffs;

CREATE POLICY daily_handoffs_select_anon
  ON public.daily_handoffs
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY daily_handoffs_insert_anon
  ON public.daily_handoffs
  FOR INSERT
  TO anon
  WITH CHECK (coach_id IS NULL AND length(trim(coach_name)) > 0);

CREATE POLICY daily_handoffs_insert_authenticated
  ON public.daily_handoffs
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY daily_handoffs_select_auth_today
  ON public.daily_handoffs
  FOR SELECT
  TO authenticated
  USING (
    timezone('Europe/Madrid', created_at)::date = timezone('Europe/Madrid', now())::date
  );

CREATE POLICY daily_handoffs_select_admin
  ON public.daily_handoffs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );
