-- Programación V2 — borradores de semana (carriles aislados del Hub Coach).
-- No modifica published_weeks ni tablas coach_*.
-- Ejecutar solo tras revisión; aplicar con el flujo habitual de migraciones Supabase.

create table if not exists public.pe2_weeks (
  id uuid primary key default gen_random_uuid(),

  -- Misma convención de slot que published_weeks (mesociclo + semana).
  mesociclo text not null,
  semana integer not null check (semana >= 1),
  phase text,

  -- Título de cabecera (paralelo a published_weeks.titulo).
  titulo text not null default '',

  -- draft | generating | ready | archived  (archivar = UPDATE status='archived'; sin DELETE)
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'archived')),

  -- Borrador principal del slot (independiente de status=ready; como máximo uno por mesociclo+semana).
  is_primary boolean not null default false,

  -- Documento semanal compatible con published_weeks.data (titulo, resumen, dias[], …).
  data jsonb not null default '{}'::jsonb,

  -- Propuesta de briefing (título, narrativa, foco) antes de generar.
  proposal jsonb,

  -- Cache del paquete briefing (texto); opcional.
  briefing_pack text,

  -- Trazas de generación IA embebidas [{ at, step, day, ok, error, … }].
  generation_log jsonb not null default '[]'::jsonb,

  -- Enlace al Hub solo tras publicación manual (Fase 2). NULL mientras es borrador V2.
  published_week_id uuid references public.published_weeks (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pe2_weeks is
  'Borradores Programación V2. Varios por mesociclo/semana; archivar con status=archived (sin DELETE). Publicación al Coach vía published_week_id.';

comment on column public.pe2_weeks.status is
  'draft | generating | ready | archived. Retirar un borrador: UPDATE a archived (no DELETE).';

comment on column public.pe2_weeks.is_primary is
  'Borrador principal del slot (independiente de ready). Como máximo uno activo por (mesociclo, semana).';

comment on column public.pe2_weeks.data is
  'JSON semanal compatible con published_weeks.data (dias con evofuncional, evofit, feedbacks, etc.).';

comment on column public.pe2_weeks.published_week_id is
  'FK al Hub (published_weeks) cuando el programador pulse Publicar al Coach; nunca automático.';

-- Un solo borrador principal por slot (excluye archivados).
create unique index if not exists pe2_weeks_one_primary_per_slot
  on public.pe2_weeks (mesociclo, semana)
  where is_primary = true and status <> 'archived';

-- Un solo borrador en estado ready por slot.
create unique index if not exists pe2_weeks_one_ready_per_slot
  on public.pe2_weeks (mesociclo, semana)
  where status = 'ready';

create index if not exists pe2_weeks_mesociclo_semana_idx
  on public.pe2_weeks (mesociclo, semana, updated_at desc);

create index if not exists pe2_weeks_status_idx
  on public.pe2_weeks (status);

-- updated_at automático
create or replace function public.pe2_weeks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pe2_weeks_set_updated_at on public.pe2_weeks;
create trigger pe2_weeks_set_updated_at
  before update on public.pe2_weeks
  for each row
  execute function public.pe2_weeks_set_updated_at();

-- RLS: app V2 usa anon (mismo patrón que ejercicios_sin_video / assistant_week_context).
-- Coach no necesita leer esta tabla; no hay políticas coach_*.
alter table public.pe2_weeks enable row level security;

drop policy if exists pe2_weeks_select_anon on public.pe2_weeks;
create policy pe2_weeks_select_anon
  on public.pe2_weeks
  for select
  to anon, authenticated
  using (true);

drop policy if exists pe2_weeks_insert_anon on public.pe2_weeks;
create policy pe2_weeks_insert_anon
  on public.pe2_weeks
  for insert
  to anon, authenticated
  with check (
    length(trim(mesociclo)) > 0
    and semana >= 1
  );

drop policy if exists pe2_weeks_update_anon on public.pe2_weeks;
create policy pe2_weeks_update_anon
  on public.pe2_weeks
  for update
  to anon, authenticated
  using (true)
  with check (
    length(trim(mesociclo)) > 0
    and semana >= 1
  );

-- Sin política DELETE: anon/authenticated no pueden borrar filas (usar status='archived').
drop policy if exists pe2_weeks_delete_anon on public.pe2_weeks;
