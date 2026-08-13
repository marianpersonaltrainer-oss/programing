-- Fase 0: evita que RLS quede debilitada por grants DDL heredados.
-- Aplicado primero en programing-evo-staging el 2026-08-12.
-- Incluye el cierre DML validado primero en staging. No ejecutar en producción
-- hasta completar el smoke test del Preview canónico contra staging.

revoke truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

revoke update
  on all sequences in schema public
  from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Reconciliación aditiva: estas tablas existen en producción pero faltaban en
-- staging. Se crean vacías, con RLS cerrada y uso exclusivo vía service_role.
create table if not exists public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid references public.published_weeks(id) on delete set null,
  coach_name text,
  started_at timestamptz default now(),
  last_activity timestamptz default now()
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.coach_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.coach_sessions enable row level security;
alter table public.coach_messages enable row level security;
revoke all on public.coach_sessions, public.coach_messages from public, anon, authenticated;
grant all on public.coach_sessions, public.coach_messages to service_role;

-- Las lecturas públicas siguientes son parte explícita del producto. Todo el
-- resto de la superficie operativa se consume a través de endpoints de
-- servidor o de una sesión Supabase autenticada.
do $f0$
declare
  table_name text;
begin
  foreach table_name in array array[
    'api_usage_log',
    'assistant_question_history',
    'assistant_week_context',
    'coach_handover_reads',
    'coach_messages',
    'coach_session_feedback',
    'coach_sessions',
    'daily_handoffs',
    'ejercicios_sin_video',
    'feedback_signals',
    'method_rules',
    'pe2_block_items',
    'pe2_blocks',
    'pe2_class_types',
    'pe2_exercises',
    'pe2_programmer_state',
    'pe2_sessions',
    'pe2_weeks',
    'rate_limit_buckets',
    'support_question_log',
    'weekly_checkins'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all on table public.%I from public, anon', table_name);
    end if;
  end loop;

  foreach table_name in array array[
    'coach_exercise_library',
    'coach_guide_settings',
    'programming_reference_context',
    'published_weeks'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all on table public.%I from public, anon', table_name);
      execute format('grant select on table public.%I to anon', table_name);
    end if;
  end loop;
end
$f0$;

do $f0$
begin
  if to_regclass('public.assistant_week_context') is not null then
    drop policy if exists assistant_week_context_select_anon on public.assistant_week_context;
    drop policy if exists assistant_week_context_upsert_anon on public.assistant_week_context;
  end if;
  if to_regclass('public.assistant_question_history') is not null then
    drop policy if exists assistant_question_history_select_anon on public.assistant_question_history;
    drop policy if exists assistant_question_history_insert_anon on public.assistant_question_history;
  end if;
  if to_regclass('public.coach_session_feedback') is not null then
    drop policy if exists coach_session_feedback_insert_anon on public.coach_session_feedback;
    drop policy if exists coach_session_feedback_select_coach_app on public.coach_session_feedback;
    drop policy if exists "Allow insert feedback" on public.coach_session_feedback;
    drop policy if exists "Allow select feedback" on public.coach_session_feedback;
  end if;
  if to_regclass('public.coach_sessions') is not null then
    drop policy if exists "allow all" on public.coach_sessions;
  end if;
  if to_regclass('public.coach_messages') is not null then
    drop policy if exists "allow all" on public.coach_messages;
  end if;
  if to_regclass('public.daily_handoffs') is not null then
    drop policy if exists daily_handoffs_insert_anon on public.daily_handoffs;
    drop policy if exists daily_handoffs_select_anon on public.daily_handoffs;
  end if;
  if to_regclass('public.ejercicios_sin_video') is not null then
    drop policy if exists ejercicios_sin_video_insert_anon on public.ejercicios_sin_video;
    drop policy if exists ejercicios_sin_video_select_anon on public.ejercicios_sin_video;
    drop policy if exists ejercicios_sin_video_update_anon on public.ejercicios_sin_video;
  end if;
  if to_regclass('public.pe2_weeks') is not null then
    drop policy if exists pe2_weeks_insert_anon on public.pe2_weeks;
    drop policy if exists pe2_weeks_select_anon on public.pe2_weeks;
    drop policy if exists pe2_weeks_update_anon on public.pe2_weeks;
  end if;
  if to_regclass('public.weekly_checkins') is not null then
    drop policy if exists weekly_checkins_insert_anon on public.weekly_checkins;
    drop policy if exists weekly_checkins_select_anon on public.weekly_checkins;
    drop policy if exists weekly_checkins_update_anon on public.weekly_checkins;
  end if;
end
$f0$;

do $f0$
begin
  if to_regprocedure('public.coach_has_read_handover(uuid,text)') is not null then
    revoke all on function public.coach_has_read_handover(uuid, text)
      from public, anon, authenticated;
    grant execute on function public.coach_has_read_handover(uuid, text)
      to service_role;
  end if;
  if to_regprocedure('public.record_coach_handover_read(uuid,text)') is not null then
    revoke all on function public.record_coach_handover_read(uuid, text)
      from public, anon, authenticated;
    grant execute on function public.record_coach_handover_read(uuid, text)
      to service_role;
  end if;
end
$f0$;
