create table if not exists public.ejercicios_sin_video (
  id uuid primary key default gen_random_uuid(),
  mesociclo text not null,
  semana integer not null,
  day_key text not null,
  day_name text,
  class_label text not null,
  exercise_name text not null,
  exercise_norm text not null,
  suggested_url text,
  notes text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ejercicios_sin_video_unique_key
  on public.ejercicios_sin_video (mesociclo, semana, day_key, class_label, exercise_norm);

alter table public.ejercicios_sin_video enable row level security;

drop policy if exists ejercicios_sin_video_select_anon on public.ejercicios_sin_video;
create policy ejercicios_sin_video_select_anon
  on public.ejercicios_sin_video
  for select
  to anon
  using (true);

drop policy if exists ejercicios_sin_video_insert_anon on public.ejercicios_sin_video;
create policy ejercicios_sin_video_insert_anon
  on public.ejercicios_sin_video
  for insert
  to anon
  with check (length(trim(exercise_name)) > 0 and length(trim(class_label)) > 0);

drop policy if exists ejercicios_sin_video_update_anon on public.ejercicios_sin_video;
create policy ejercicios_sin_video_update_anon
  on public.ejercicios_sin_video
  for update
  to anon
  using (true)
  with check (length(trim(exercise_name)) > 0 and length(trim(class_label)) > 0);

