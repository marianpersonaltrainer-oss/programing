-- Sprint 1 — Ampliación aditiva de method_rules (dimensiones separadas).
-- NO ejecutar en producción sin aprobación explícita.
--
-- Tras aplicar:
--   1) Todas las filas existentes quedan en rule_status = legacy_unreviewed.
--   2) El Context Compiler solo incluye rule_status = active.
--   3) Nuevas correcciones entran como pending_review hasta aprobación manual.

-- ── Dimensiones independientes ───────────────────────────────────────────────

alter table public.method_rules add column if not exists rule_status text;
alter table public.method_rules add column if not exists rule_validity text;
alter table public.method_rules add column if not exists rule_strength text;
alter table public.method_rules add column if not exists rule_origin text;

alter table public.method_rules drop constraint if exists method_rules_rule_status_check;
alter table public.method_rules add constraint method_rules_rule_status_check
  check (rule_status is null or rule_status in (
    'legacy_unreviewed',
    'pending_review',
    'active',
    'rejected',
    'archived',
    'superseded'
  ));

alter table public.method_rules drop constraint if exists method_rules_rule_validity_check;
alter table public.method_rules add constraint method_rules_rule_validity_check
  check (rule_validity is null or rule_validity in (
    'permanent',
    'temporary',
    'weekly_exception'
  ));

alter table public.method_rules drop constraint if exists method_rules_rule_strength_check;
alter table public.method_rules add constraint method_rules_rule_strength_check
  check (rule_strength is null or rule_strength in (
    'required',
    'preferred',
    'avoid',
    'prohibited'
  ));

alter table public.method_rules drop constraint if exists method_rules_rule_origin_check;
alter table public.method_rules add constraint method_rules_rule_origin_check
  check (rule_origin is null or rule_origin in (
    'manual',
    'correction',
    'system_prompt',
    'method_panel',
    'migrated',
    'coach_feedback'
  ));

-- ── Clave temática estable ───────────────────────────────────────────────────

alter table public.method_rules add column if not exists rule_key text;

create index if not exists idx_method_rules_rule_key
  on public.method_rules (rule_key)
  where rule_key is not null;

-- ── Alcance ──────────────────────────────────────────────────────────────────

alter table public.method_rules add column if not exists org_id uuid references public.organizations(id);
alter table public.method_rules add column if not exists season_key text;
alter table public.method_rules add column if not exists mesocycle_key text;
alter table public.method_rules add column if not exists week_number int;
alter table public.method_rules add column if not exists valid_from date;
alter table public.method_rules add column if not exists valid_to date;
alter table public.method_rules add column if not exists day_of_week smallint[];
alter table public.method_rules add column if not exists class_types text[];
alter table public.method_rules add column if not exists room_key text;
alter table public.method_rules add column if not exists time_slot text;

-- ── Versionado y trazabilidad ────────────────────────────────────────────────

alter table public.method_rules add column if not exists priority int not null default 100;
alter table public.method_rules add column if not exists version int not null default 1;
alter table public.method_rules add column if not exists supersedes_id bigint references public.method_rules(id) on delete set null;
alter table public.method_rules add column if not exists origin_detail text;
alter table public.method_rules add column if not exists change_reason text;
alter table public.method_rules add column if not exists created_by uuid references auth.users(id);
alter table public.method_rules add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ── Integridad de reglas estructuradas ───────────────────────────────────────

alter table public.method_rules drop constraint if exists method_rules_active_complete_check;
alter table public.method_rules add constraint method_rules_active_complete_check
  check (
    rule_status <> 'active'
    or (
      rule_key is not null
      and btrim(rule_key) <> ''
      and rule_validity is not null
      and rule_strength is not null
      and rule_origin is not null
    )
  );

alter table public.method_rules drop constraint if exists method_rules_valid_dates_check;
alter table public.method_rules add constraint method_rules_valid_dates_check
  check (valid_from is null or valid_to is null or valid_from <= valid_to);

alter table public.method_rules drop constraint if exists method_rules_temporary_window_check;
alter table public.method_rules add constraint method_rules_temporary_window_check
  check (rule_validity <> 'temporary' or valid_from is not null or valid_to is not null);

alter table public.method_rules drop constraint if exists method_rules_weekly_scope_check;
alter table public.method_rules add constraint method_rules_weekly_scope_check
  check (
    rule_validity <> 'weekly_exception'
    or week_number is not null
    or (valid_from is not null and valid_to is not null)
  );

alter table public.method_rules drop constraint if exists method_rules_week_number_check;
alter table public.method_rules add constraint method_rules_week_number_check
  check (week_number is null or week_number > 0);

alter table public.method_rules drop constraint if exists method_rules_day_of_week_check;
alter table public.method_rules add constraint method_rules_day_of_week_check
  check (
    day_of_week is null
    or day_of_week <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  );

-- ── Índices para el compilador ───────────────────────────────────────────────

create index if not exists idx_method_rules_compiler
  on public.method_rules (org_id, rule_status, rule_key);

create index if not exists idx_method_rules_scope
  on public.method_rules (org_id, mesocycle_key, week_number);

create index if not exists idx_method_rules_validity_dates
  on public.method_rules (valid_from, valid_to);

create index if not exists idx_method_rules_supersedes
  on public.method_rules (supersedes_id)
  where supersedes_id is not null;

-- ── Backfill filas existentes (53 legacy) ────────────────────────────────────
-- Sin DEFAULT global 'active' ni 'permanent': solo UPDATE explícito.

update public.method_rules
set
  rule_status = 'legacy_unreviewed',
  rule_origin = case
    when source = 'manual_edit' then 'manual'
    when source = 'coach_feedback' then 'coach_feedback'
    when source = 'admin' then 'manual'
    else null
  end
where rule_status is null;

-- Las filas legacy mantienen rule_validity, rule_strength y rule_key en NULL
-- hasta revisión humana. No se promueven automáticamente.

-- ── RLS preparado (aplicar en sprint posterior con org EVO backfill) ───────────
-- Documentado en docs/CONTEXT_COMPILER.md; no se altera aquí la policy activa
-- para no romper entornos que aún no hayan corrido este script.

comment on column public.method_rules.rule_status is
  'Estado: legacy_unreviewed | pending_review | active | rejected | archived | superseded';
comment on column public.method_rules.rule_validity is
  'Vigencia: permanent | temporary | weekly_exception';
comment on column public.method_rules.rule_strength is
  'Fuerza: required | preferred | avoid | prohibited';
comment on column public.method_rules.rule_origin is
  'Origen: manual | correction | system_prompt | method_panel | migrated | coach_feedback';
comment on column public.method_rules.rule_key is
  'Clave temática estable (warmup_visibility, landmine_frequency, …). Obligatoria en reglas active nuevas.';
