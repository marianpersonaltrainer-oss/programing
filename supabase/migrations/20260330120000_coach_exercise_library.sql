-- Biblioteca de ejercicios EVO (Documento Maestro) + URL de vídeo opcional.
-- Idempotente: seguro si la tabla o columnas ya existen en el proyecto.

create table if not exists public.coach_exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in (
    'bisagra','squat','empuje_horizontal','empuje_vertical',
    'jalon','rotacion','metabolico','core','olimpico','landmine'
  )),
  classes text[] not null default '{}',
  level text not null check (level in ('basico','intermedio','avanzado')),
  notes text,
  is_new boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.coach_exercise_library
  add column if not exists video_url text;

comment on column public.coach_exercise_library.video_url is
  'URL directa del vídeo (YouTube, Instagram, etc.). Opcional.';

alter table public.coach_exercise_library enable row level security;

drop policy if exists "Allow select exercises" on public.coach_exercise_library;
create policy "Allow select exercises"
  on public.coach_exercise_library for select
  using (true);

-- Escritura desde el cliente anónimo: denegada por defecto (solo service role / API).
