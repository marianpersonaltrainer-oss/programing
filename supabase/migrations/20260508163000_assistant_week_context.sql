create table if not exists public.assistant_week_context (
  id uuid primary key default gen_random_uuid(),
  mesociclo text not null,
  semana integer not null,
  global_notes text,
  qa_pairs jsonb not null default '[]'::jsonb,
  adaptations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (mesociclo, semana)
);

create table if not exists public.assistant_question_history (
  id uuid primary key default gen_random_uuid(),
  week_id uuid references public.published_weeks(id) on delete set null,
  mesociclo text,
  semana integer,
  day_key text,
  class_label text,
  coach_name text,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_question_history_week_idx
  on public.assistant_question_history (mesociclo, semana, created_at desc);

alter table public.assistant_week_context enable row level security;
alter table public.assistant_question_history enable row level security;

drop policy if exists assistant_week_context_select_anon on public.assistant_week_context;
create policy assistant_week_context_select_anon
  on public.assistant_week_context
  for select
  to anon
  using (true);

drop policy if exists assistant_week_context_upsert_anon on public.assistant_week_context;
create policy assistant_week_context_upsert_anon
  on public.assistant_week_context
  for all
  to anon
  using (true)
  with check (mesociclo is not null and semana is not null);

drop policy if exists assistant_question_history_select_anon on public.assistant_question_history;
create policy assistant_question_history_select_anon
  on public.assistant_question_history
  for select
  to anon
  using (true);

drop policy if exists assistant_question_history_insert_anon on public.assistant_question_history;
create policy assistant_question_history_insert_anon
  on public.assistant_question_history
  for insert
  to anon
  with check (length(trim(question)) > 0 and length(trim(answer)) > 0);

