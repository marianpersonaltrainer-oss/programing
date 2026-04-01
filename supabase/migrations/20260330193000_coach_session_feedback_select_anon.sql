-- Permitir que la app coach (rol anon) lea feedback de la semana para pase de turno.
-- El insert ya funciona vía RLS existente; esta política añade solo SELECT.

DO $$
BEGIN
  IF to_regclass('public.coach_session_feedback') IS NULL THEN
    RAISE NOTICE 'coach_session_feedback: tabla no existe, se omite migración.';
    RETURN;
  END IF;

  ALTER TABLE public.coach_session_feedback ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS coach_session_feedback_select_coach_app ON public.coach_session_feedback;
  CREATE POLICY coach_session_feedback_select_coach_app
    ON public.coach_session_feedback
    FOR SELECT
    TO anon
    USING (true);
END $$;
