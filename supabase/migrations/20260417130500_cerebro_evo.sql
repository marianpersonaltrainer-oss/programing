create table if not exists public.method_rules (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rule_type text not null check (rule_type in ('timing', 'load', 'exercise', 'format', 'rest')),
  trigger_context text,
  rule_text text not null,
  source text not null check (source in ('manual_edit', 'coach_feedback', 'admin')),
  confidence int not null default 50 check (confidence >= 0 and confidence <= 100),
  active boolean not null default true,
  week_id uuid references public.published_weeks(id) on delete set null
);

create table if not exists public.support_question_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  coach_name text,
  week_id uuid references public.published_weeks(id) on delete set null,
  day_slug text,
  class_slug text,
  question_text text not null,
  answer_text text,
  resolved_by text check (resolved_by in ('faq', 'cache', 'claude', 'pending')),
  tokens_used int not null default 0
);

create table if not exists public.feedback_signals (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  week_id uuid references public.published_weeks(id) on delete set null,
  day_slug text,
  class_slug text,
  signal_type text not null check (signal_type in ('too_long', 'too_short', 'load_high', 'load_low', 'exercise_misfit', 'timing_tight', 'rests_inflated')),
  signal_count int not null default 1,
  raw_feedback text,
  coach_name text
);

alter table public.method_rules enable row level security;
alter table public.support_question_log enable row level security;
alter table public.feedback_signals enable row level security;

drop policy if exists method_rules_insert_service_role on public.method_rules;
create policy method_rules_insert_service_role
  on public.method_rules
  for insert
  to service_role
  with check (true);

drop policy if exists method_rules_select_auth_service on public.method_rules;
create policy method_rules_select_auth_service
  on public.method_rules
  for select
  to authenticated, service_role
  using (true);

drop policy if exists support_question_log_insert_service_role on public.support_question_log;
create policy support_question_log_insert_service_role
  on public.support_question_log
  for insert
  to service_role
  with check (true);

drop policy if exists support_question_log_select_auth_service on public.support_question_log;
create policy support_question_log_select_auth_service
  on public.support_question_log
  for select
  to authenticated, service_role
  using (true);

drop policy if exists feedback_signals_insert_service_role on public.feedback_signals;
create policy feedback_signals_insert_service_role
  on public.feedback_signals
  for insert
  to service_role
  with check (true);

drop policy if exists feedback_signals_select_auth_service on public.feedback_signals;
create policy feedback_signals_select_auth_service
  on public.feedback_signals
  for select
  to authenticated, service_role
  using (true);
