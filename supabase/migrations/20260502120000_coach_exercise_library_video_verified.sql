-- Solo enlaces de vídeo marcados como verificados se usan en Excel / coach (evita URLs rotas).
alter table public.coach_exercise_library
  add column if not exists video_url_verified boolean;

update public.coach_exercise_library
set video_url_verified = true
where video_url_verified is null;

alter table public.coach_exercise_library
  alter column video_url_verified set default false;

alter table public.coach_exercise_library
  alter column video_url_verified set not null;

comment on column public.coach_exercise_library.video_url_verified is
  'Si es false, no se usa video_url en hipervínculos hasta comprobar en admin. Tras migración, true en filas existentes con URL.';
