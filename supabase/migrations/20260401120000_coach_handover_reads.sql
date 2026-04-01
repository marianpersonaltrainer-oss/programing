-- Lecturas explícitas del pase de turno (coach + semana). Visible en admin vía Table Editor o service role.

DO $$
BEGIN
  IF to_regclass('public.coach_handover_reads') IS NULL THEN
    CREATE TABLE public.coach_handover_reads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_name text NOT NULL,
      coach_name_norm text GENERATED ALWAYS AS (lower(trim(coach_name))) STORED,
      week_id uuid NOT NULL,
      read_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (week_id, coach_name_norm)
    );

    CREATE INDEX coach_handover_reads_week_id_idx ON public.coach_handover_reads (week_id);

    COMMENT ON TABLE public.coach_handover_reads IS
      'Confirmación «Leído» del pase de turno por coach y semana publicada (week_id = published_weeks.id).';

    ALTER TABLE public.coach_handover_reads ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Sin políticas para anon sobre la tabla: solo RPC SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.coach_has_read_handover(p_week_id uuid, p_coach_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_handover_reads r
    WHERE r.week_id = p_week_id
      AND r.coach_name_norm = lower(trim(COALESCE(p_coach_name, '')))
  );
$$;

CREATE OR REPLACE FUNCTION public.record_coach_handover_read(p_week_id uuid, p_coach_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(COALESCE(p_coach_name, ''));
BEGIN
  IF p_week_id IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'week_id y coach_name son obligatorios';
  END IF;
  INSERT INTO public.coach_handover_reads (coach_name, week_id, read_at)
  VALUES (v_name, p_week_id, now())
  ON CONFLICT (week_id, coach_name_norm)
  DO UPDATE SET read_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.coach_has_read_handover(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_coach_handover_read(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_has_read_handover(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_coach_handover_read(uuid, text) TO anon, authenticated, service_role;
