-- Fase 1: elimina la resolución de objetos mediante un search_path mutable
-- en funciones trigger legacy que solo usan valores NEW/OLD y pg_catalog.now().

alter function public.pe2_sessions_set_updated_at()
  set search_path = '';

alter function public.pe2_weeks_set_updated_at()
  set search_path = '';
