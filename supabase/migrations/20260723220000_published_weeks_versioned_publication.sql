-- Programming EVO · publicación versionada V2
--
-- Objetivos:
--   * conservar las filas ya publicadas como historial inmutable;
--   * mantener como máximo un borrador mutable por (mesociclo, semana);
--   * impedir escrituras directas de anon/authenticated;
--   * guardar borradores con control optimista de revisión;
--   * publicar una copia validada y activarla en una sola transacción.
--
-- La migración es aditiva. No elimina semanas ni contenido histórico.

alter table public.published_weeks
  add column if not exists cycle_id text,
  add column if not exists cycle_start_date date,
  add column if not exists week_start_date date,
  add column if not exists publication_status text,
  add column if not exists revision bigint,
  add column if not exists version_number bigint,
  add column if not exists source_week_id uuid,
  add column if not exists content_fingerprint text,
  add column if not exists validation_fingerprint text,
  add column if not exists validation_status text,
  add column if not exists validation_score integer,
  add column if not exists validation_blockers jsonb,
  add column if not exists validation_pending jsonb,
  add column if not exists validated_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists superseded_at timestamptz;

create or replace function public.published_week_try_date_v2(p_value text)
returns date
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
begin
  return p_value::date;
exception
  when others then
    return null;
end;
$$;
revoke all on function public.published_week_try_date_v2(text)
  from public, anon, authenticated;

-- Materializa la identidad temporal dentro de la tabla. Las filas legacy sin
-- fecha reciben un cycle_id único y nunca pueden confundirse con un ciclo real.
update public.published_weeks
set
  cycle_start_date = coalesce(
    cycle_start_date,
    public.published_week_try_date_v2(data ->> 'cycle_start_date')
  ),
  week_start_date = coalesce(
    week_start_date,
    public.published_week_try_date_v2(data ->> 'week_start_date')
  )
where (
    cycle_start_date is null
    and public.published_week_try_date_v2(data ->> 'cycle_start_date') is not null
  )
   or (
    week_start_date is null
    and public.published_week_try_date_v2(data ->> 'week_start_date') is not null
  );

-- Una fecha de ciclo conocida determina de forma única la fecha de cada semana.
-- No se conserva una week_start_date o un cycle_id declarados que contradigan
-- esa identidad.
update public.published_weeks
set week_start_date = cycle_start_date + ((semana - 1) * 7)
where cycle_start_date is not null
  and week_start_date is distinct from cycle_start_date + ((semana - 1) * 7);

update public.published_weeks
set cycle_id = case
  when cycle_start_date is not null
    then format('%s:%s', mesociclo, cycle_start_date)
  else format('legacy:%s', id)
end
where cycle_id is null
   or btrim(cycle_id) = ''
   or (
     cycle_start_date is not null
     and cycle_id is distinct from format('%s:%s', mesociclo, cycle_start_date)
   );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.published_weeks'::regclass
      and conname = 'published_weeks_source_week_id_fkey'
  ) then
    alter table public.published_weeks
      add constraint published_weeks_source_week_id_fkey
      foreign key (source_week_id)
      references public.published_weeks (id)
      on delete restrict;
  end if;
end;
$$;

-- Si por el flujo legacy hubiese más de una fila activa, se conserva únicamente
-- la publicación activa más reciente. Las demás siguen existiendo como historial.
with ranked_active as (
  select
    id,
    row_number() over (
      order by published_at desc nulls last, id desc
    ) as active_rank
  from public.published_weeks
  where is_active is true
)
update public.published_weeks as pw
set
  is_active = false,
  publication_status = 'superseded',
  superseded_at = coalesce(pw.superseded_at, now()),
  updated_at = coalesce(pw.updated_at, now())
from ranked_active as ranked
where pw.id = ranked.id
  and ranked.active_rank > 1;

-- Las filas legacy inactivas no permiten distinguir con fiabilidad entre una
-- publicación anterior y un borrador parcial. Solo una fila que fue activa es
-- evidencia de publicación; el resto queda en cuarentena y nunca entra en el
-- contexto automático ni en la lectura pública.
update public.published_weeks
set
  publication_status = 'published',
  superseded_at = null,
  updated_at = coalesce(updated_at, published_at, now())
where is_active is true
  and publication_status is null;

update public.published_weeks
set
  publication_status = 'legacy_unverified',
  updated_at = coalesce(updated_at, published_at, now())
where is_active is false
  and publication_status is null;

update public.published_weeks
set
  revision = coalesce(revision, 1),
  validation_status = coalesce(validation_status, 'pending'),
  validation_blockers = coalesce(validation_blockers, '[]'::jsonb),
  validation_pending = coalesce(validation_pending, '[]'::jsonb),
  updated_at = coalesce(updated_at, published_at, now())
where revision is null
   or validation_status is null
   or validation_blockers is null
   or validation_pending is null
   or updated_at is null;

-- Asigna una versión determinista a filas legacy. En re-ejecuciones solo rellena
-- NULL, por lo que nunca renumera versiones ya creadas.
with existing_max as (
  select mesociclo, semana, cycle_id, max(version_number) as max_version
  from public.published_weeks
  where version_number is not null
  group by mesociclo, semana, cycle_id
),
missing_versions as (
  select
    pw.id,
    coalesce(existing_max.max_version, 0)
      + row_number() over (
          partition by pw.mesociclo, pw.semana, pw.cycle_id
          order by pw.published_at asc nulls first, pw.id asc
        ) as assigned_version
  from public.published_weeks as pw
  left join existing_max
    on existing_max.mesociclo is not distinct from pw.mesociclo
   and existing_max.semana is not distinct from pw.semana
   and existing_max.cycle_id is not distinct from pw.cycle_id
  where pw.version_number is null
)
update public.published_weeks as pw
set version_number = missing_versions.assigned_version
from missing_versions
where pw.id = missing_versions.id;

alter table public.published_weeks
  alter column cycle_id set not null,
  alter column publication_status set default 'draft',
  alter column publication_status set not null,
  alter column revision set default 1,
  alter column revision set not null,
  alter column version_number set not null,
  alter column validation_status set default 'pending',
  alter column validation_status set not null,
  alter column validation_blockers set default '[]'::jsonb,
  alter column validation_blockers set not null,
  alter column validation_pending set default '[]'::jsonb,
  alter column validation_pending set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.published_weeks
  drop constraint if exists published_weeks_publication_status_check,
  add constraint published_weeks_publication_status_check
    check (
      publication_status in (
        'draft',
        'publishing',
        'published',
        'superseded',
        'consumed',
        'legacy_unverified'
      )
    ),
  drop constraint if exists published_weeks_revision_check,
  add constraint published_weeks_revision_check
    check (revision >= 1),
  drop constraint if exists published_weeks_version_number_check,
  add constraint published_weeks_version_number_check
    check (version_number >= 1),
  drop constraint if exists published_weeks_validation_status_check,
  add constraint published_weeks_validation_status_check
    check (validation_status in ('pending', 'approved', 'rejected')),
  drop constraint if exists published_weeks_validation_score_check,
  add constraint published_weeks_validation_score_check
    check (validation_score is null or validation_score between 0 and 100),
  drop constraint if exists published_weeks_validation_arrays_check,
  add constraint published_weeks_validation_arrays_check
    check (
      jsonb_typeof(validation_blockers) = 'array'
      and jsonb_typeof(validation_pending) = 'array'
    ),
  drop constraint if exists published_weeks_active_status_check,
  add constraint published_weeks_active_status_check
    check (is_active is false or publication_status = 'published'),
  drop constraint if exists published_weeks_cycle_identity_check,
  add constraint published_weeks_cycle_identity_check
    check (
      (
        cycle_start_date is null
        and week_start_date is null
        and cycle_id = format('legacy:%s', id)
      )
      or (
        cycle_start_date is not null
        and week_start_date = cycle_start_date + ((semana - 1) * 7)
        and cycle_id = format('%s:%s', mesociclo, cycle_start_date)
      )
    ),
  drop constraint if exists published_weeks_validated_publication_check,
  add constraint published_weeks_validated_publication_check
    check (
      publication_status <> 'published'
      or source_week_id is null
      or (
        validation_status = 'approved'
        and validation_score >= 80
        and content_fingerprint is not null
        and validation_fingerprint is not null
        and jsonb_array_length(validation_blockers) = 0
        and jsonb_array_length(validation_pending) = 0
        and validated_at is not null
      )
    );

create unique index if not exists published_weeks_one_active_idx
  on public.published_weeks (is_active)
  where is_active is true;

drop index if exists public.published_weeks_one_mutable_draft_per_slot_idx;
create unique index published_weeks_one_mutable_draft_per_slot_idx
  on public.published_weeks (mesociclo, semana, cycle_id)
  where publication_status in ('draft', 'publishing');

drop index if exists public.published_weeks_slot_version_idx;
create unique index published_weeks_slot_version_idx
  on public.published_weeks (mesociclo, semana, cycle_id, version_number);

create index if not exists published_weeks_source_week_idx
  on public.published_weeks (source_week_id)
  where source_week_id is not null;

create index if not exists published_weeks_cycle_lookup_idx
  on public.published_weeks (mesociclo, cycle_id, semana, published_at desc);

create or replace function public.published_weeks_v2_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists published_weeks_v2_set_updated_at
  on public.published_weeks;
create trigger published_weeks_v2_set_updated_at
  before update on public.published_weeks
  for each row
  execute function public.published_weeks_v2_set_updated_at();

-- Impide modificar o borrar contenido histórico incluso con una escritura SQL
-- accidental de service_role. La RPC de publicación solo puede cambiar los
-- metadatos de ciclo de vida necesarios para superseder una versión.
create or replace function public.published_weeks_v2_immutable_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  internal_publication boolean :=
    coalesce(current_setting('app.published_weeks_v2_internal', true), '') = 'on';
  immutable_old jsonb;
  immutable_new jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '55000',
      message = 'published_week_history_is_immutable';
  end if;

  if tg_op = 'INSERT' then
    if new.publication_status <> 'draft' and not internal_publication then
      raise exception using
        errcode = '42501',
        message = 'published_week_non_draft_insert_requires_rpc';
    end if;
    return new;
  end if;

  if old.publication_status in ('superseded', 'consumed', 'legacy_unverified') then
    raise exception using
      errcode = '55000',
      message = 'published_week_history_is_immutable';
  end if;

  if old.publication_status = 'published' then
    if not internal_publication
      or new.publication_status <> 'superseded'
      or new.is_active is true then
      raise exception using
        errcode = '55000',
        message = 'published_week_history_is_immutable';
    end if;

    immutable_old :=
      to_jsonb(old)
      - array['publication_status', 'is_active', 'superseded_at', 'updated_at'];
    immutable_new :=
      to_jsonb(new)
      - array['publication_status', 'is_active', 'superseded_at', 'updated_at'];

    if immutable_new is distinct from immutable_old then
      raise exception using
        errcode = '55000',
        message = 'published_week_content_is_immutable';
    end if;
    return new;
  end if;

  if old.publication_status in ('draft', 'publishing') then
    if new.publication_status = 'published' then
      raise exception using
        errcode = '55000',
        message = 'draft_must_be_published_as_new_version';
    end if;
    if new.publication_status in ('publishing', 'superseded', 'consumed')
      and not internal_publication then
      raise exception using
        errcode = '42501',
        message = 'draft_lifecycle_change_requires_rpc';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists published_weeks_v2_immutable_guard
  on public.published_weeks;
create trigger published_weeks_v2_immutable_guard
  before insert or update or delete on public.published_weeks
  for each row
  execute function public.published_weeks_v2_immutable_guard();

-- Fingerprint canónico del JSONB. MD5 se usa como identificador de igualdad,
-- no como firma de seguridad; jsonb::text tiene orden canónico de claves.
create or replace function public.published_week_content_fingerprint_v2(
  p_data jsonb
)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select md5(p_data::text);
$$;

revoke all on function public.published_week_content_fingerprint_v2(jsonb)
  from public, anon, authenticated;

create or replace function public.save_published_week_draft_v2(
  p_mesociclo text,
  p_semana integer,
  p_titulo text,
  p_data jsonb,
  p_draft_id uuid default null,
  p_expected_revision bigint default null,
  p_source_week_id uuid default null,
  p_content_fingerprint text default null,
  p_validation_fingerprint text default null,
  p_validation_status text default 'pending',
  p_validation_score integer default null,
  p_validation_blockers jsonb default '[]'::jsonb,
  p_validation_pending jsonb default '[]'::jsonb,
  p_validated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mesociclo text := btrim(coalesce(p_mesociclo, ''));
  v_cycle_id text;
  v_cycle_start_date date;
  v_week_start_date date;
  v_titulo text;
  v_computed_fingerprint text;
  v_validation_fingerprint text :=
    nullif(btrim(coalesce(p_validation_fingerprint, '')), '');
  v_validation_status text :=
    coalesce(nullif(btrim(coalesce(p_validation_status, '')), ''), 'pending');
  v_blockers jsonb := coalesce(p_validation_blockers, '[]'::jsonb);
  v_pending jsonb := coalesce(p_validation_pending, '[]'::jsonb);
  v_existing public.published_weeks%rowtype;
  v_row public.published_weeks%rowtype;
  v_source_week_id uuid;
  v_next_version bigint;
begin
  if v_mesociclo = '' then
    raise exception using errcode = '22023', message = 'mesociclo_required';
  end if;
  if p_semana is null or p_semana < 1 then
    raise exception using errcode = '22023', message = 'semana_must_be_positive';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception using errcode = '22023', message = 'week_data_must_be_json_object';
  end if;
  v_cycle_start_date :=
    public.published_week_try_date_v2(p_data ->> 'cycle_start_date');
  v_week_start_date :=
    public.published_week_try_date_v2(p_data ->> 'week_start_date');
  v_cycle_id := nullif(btrim(coalesce(p_data ->> 'cycle_id', '')), '');
  if v_cycle_start_date is null or v_week_start_date is null or v_cycle_id is null then
    raise exception using errcode = '22023', message = 'exact_cycle_identity_required';
  end if;
  if v_cycle_id <> format('%s:%s', v_mesociclo, v_cycle_start_date) then
    raise exception using errcode = '22023', message = 'cycle_identity_mismatch';
  end if;
  if v_week_start_date <> v_cycle_start_date + ((p_semana - 1) * 7) then
    raise exception using errcode = '22023', message = 'week_start_date_mismatch';
  end if;
  if nullif(btrim(coalesce(p_data ->> 'mesociclo', '')), '') is not null
    and btrim(p_data ->> 'mesociclo') <> v_mesociclo then
    raise exception using errcode = '22023', message = 'week_mesociclo_mismatch';
  end if;
  if nullif(btrim(coalesce(p_data ->> 'semana', '')), '') is not null
    and (p_data ->> 'semana')::integer <> p_semana then
    raise exception using errcode = '22023', message = 'week_number_mismatch';
  end if;
  if jsonb_typeof(v_blockers) <> 'array'
    or jsonb_typeof(v_pending) <> 'array' then
    raise exception using errcode = '22023', message = 'validation_lists_must_be_arrays';
  end if;
  if v_validation_status not in ('pending', 'approved', 'rejected') then
    raise exception using errcode = '22023', message = 'invalid_validation_status';
  end if;
  if p_validation_score is not null
    and (p_validation_score < 0 or p_validation_score > 100) then
    raise exception using errcode = '22023', message = 'invalid_validation_score';
  end if;

  v_titulo := coalesce(
    nullif(btrim(coalesce(p_titulo, '')), ''),
    format('S%s', p_semana)
  );
  v_computed_fingerprint :=
    public.published_week_content_fingerprint_v2(p_data);

  if nullif(btrim(coalesce(p_content_fingerprint, '')), '') is not null
    and btrim(p_content_fingerprint) <> v_computed_fingerprint then
    raise exception using
      errcode = '22023',
      message = 'content_fingerprint_mismatch';
  end if;

  if v_validation_status = 'approved' and (
    coalesce(p_validation_score, -1) < 80
    or v_validation_fingerprint is null
    or jsonb_array_length(v_blockers) <> 0
    or jsonb_array_length(v_pending) <> 0
    or p_validated_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'approved_validation_gate_failed';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      format('published_weeks:slot:%s:%s:%s', v_mesociclo, p_semana, v_cycle_id),
      0
    )
  );

  if p_draft_id is not null then
    select *
    into v_existing
    from public.published_weeks
    where id = p_draft_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'draft_not_found';
    end if;
    if v_existing.mesociclo <> v_mesociclo
      or v_existing.semana <> p_semana
      or v_existing.cycle_id <> v_cycle_id then
      raise exception using errcode = '22023', message = 'draft_slot_mismatch';
    end if;
    if v_existing.publication_status <> 'draft' then
      raise exception using errcode = '55000', message = 'draft_is_not_mutable';
    end if;
  else
    select *
    into v_existing
    from public.published_weeks
    where mesociclo = v_mesociclo
      and semana = p_semana
      and cycle_id = v_cycle_id
      and publication_status in ('draft', 'publishing')
    order by version_number desc
    limit 1
    for update;

    if found then
      raise exception using
        errcode = '40001',
        message = 'draft_exists_pass_id_and_expected_revision';
    end if;
  end if;

  if p_source_week_id is not null then
    select id
    into v_source_week_id
    from public.published_weeks
    where id = p_source_week_id
      and mesociclo = v_mesociclo
      and semana = p_semana
      and cycle_id = v_cycle_id
      and publication_status in ('published', 'superseded');

    if not found then
      raise exception using
        errcode = '22023',
        message = 'source_week_must_be_immutable_same_slot';
    end if;
  end if;

  if p_draft_id is null then
    if p_expected_revision is not null and p_expected_revision <> 0 then
      raise exception using
        errcode = '40001',
        message = 'new_draft_expected_revision_must_be_zero';
    end if;

    if v_source_week_id is null then
      select id
      into v_source_week_id
      from public.published_weeks
      where mesociclo = v_mesociclo
        and semana = p_semana
        and cycle_id = v_cycle_id
        and publication_status in ('published', 'superseded')
      order by version_number desc
      limit 1;
    end if;

    select coalesce(max(version_number), 0) + 1
    into v_next_version
    from public.published_weeks
    where mesociclo = v_mesociclo
      and semana = p_semana
      and cycle_id = v_cycle_id;

    insert into public.published_weeks (
      mesociclo,
      semana,
      cycle_id,
      cycle_start_date,
      week_start_date,
      titulo,
      data,
      is_active,
      publication_status,
      revision,
      version_number,
      source_week_id,
      content_fingerprint,
      validation_fingerprint,
      validation_status,
      validation_score,
      validation_blockers,
      validation_pending,
      validated_at,
      updated_at,
      superseded_at
    )
    values (
      v_mesociclo,
      p_semana,
      v_cycle_id,
      v_cycle_start_date,
      v_week_start_date,
      v_titulo,
      p_data,
      false,
      'draft',
      1,
      v_next_version,
      v_source_week_id,
      v_computed_fingerprint,
      v_validation_fingerprint,
      v_validation_status,
      p_validation_score,
      v_blockers,
      v_pending,
      p_validated_at,
      now(),
      null
    )
    returning * into v_row;
  else
    if p_expected_revision is null
      or p_expected_revision <> v_existing.revision then
      raise exception using
        errcode = '40001',
        message = 'draft_revision_conflict';
    end if;

    if p_source_week_id is not null
      and v_existing.source_week_id is not null
      and p_source_week_id <> v_existing.source_week_id then
      raise exception using
        errcode = '55000',
        message = 'draft_source_week_is_immutable';
    end if;

    update public.published_weeks
    set
      titulo = v_titulo,
      data = p_data,
      revision = revision + 1,
      source_week_id = coalesce(source_week_id, v_source_week_id),
      content_fingerprint = v_computed_fingerprint,
      validation_fingerprint = v_validation_fingerprint,
      validation_status = v_validation_status,
      validation_score = p_validation_score,
      validation_blockers = v_blockers,
      validation_pending = v_pending,
      validated_at = p_validated_at,
      updated_at = now()
    where id = v_existing.id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'mesociclo', v_row.mesociclo,
    'semana', v_row.semana,
    'cycle_id', v_row.cycle_id,
    'cycle_start_date', v_row.cycle_start_date,
    'week_start_date', v_row.week_start_date,
    'titulo', v_row.titulo,
    'data', v_row.data,
    'is_active', v_row.is_active,
    'publication_status', v_row.publication_status,
    'revision', v_row.revision,
    'version_number', v_row.version_number,
    'source_week_id', v_row.source_week_id,
    'content_fingerprint', v_row.content_fingerprint,
    'validation_fingerprint', v_row.validation_fingerprint,
    'validation_status', v_row.validation_status,
    'validation_score', v_row.validation_score,
    'validation_blockers', v_row.validation_blockers,
    'validation_pending', v_row.validation_pending,
    'validated_at', v_row.validated_at,
    'published_at', v_row.published_at,
    'updated_at', v_row.updated_at,
    'superseded_at', v_row.superseded_at
  );
end;
$$;

create or replace function public.publish_published_week_draft_v2(
  p_draft_id uuid,
  p_expected_revision bigint,
  p_expected_content_fingerprint text,
  p_expected_validation_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mesociclo text;
  v_semana integer;
  v_cycle_id text;
  v_draft public.published_weeks%rowtype;
  v_published public.published_weeks%rowtype;
  v_next_version bigint;
  v_computed_fingerprint text;
  v_context_snapshot_at timestamptz;
begin
  if p_draft_id is null then
    raise exception using errcode = '22023', message = 'draft_id_required';
  end if;
  if p_expected_revision is null then
    raise exception using errcode = '22023', message = 'expected_revision_required';
  end if;

  select mesociclo, semana, cycle_id
  into v_mesociclo, v_semana, v_cycle_id
  from public.published_weeks
  where id = p_draft_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'draft_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      format('published_weeks:slot:%s:%s:%s', v_mesociclo, v_semana, v_cycle_id),
      0
    )
  );

  select *
  into v_draft
  from public.published_weeks
  where id = p_draft_id
  for update;

  if v_draft.publication_status <> 'draft' then
    raise exception using errcode = '55000', message = 'draft_is_not_publishable';
  end if;
  if v_draft.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'draft_revision_conflict';
  end if;

  v_computed_fingerprint :=
    public.published_week_content_fingerprint_v2(v_draft.data);

  if v_draft.content_fingerprint is null
    or v_draft.content_fingerprint <> v_computed_fingerprint
    or btrim(coalesce(p_expected_content_fingerprint, '')) <> v_computed_fingerprint then
    raise exception using errcode = '23514', message = 'content_fingerprint_gate_failed';
  end if;
  if v_draft.validation_fingerprint is null
    or btrim(coalesce(p_expected_validation_fingerprint, ''))
      <> v_draft.validation_fingerprint then
    raise exception using errcode = '23514', message = 'validation_fingerprint_gate_failed';
  end if;
  if v_draft.validation_status <> 'approved' then
    raise exception using errcode = '23514', message = 'validation_status_must_be_approved';
  end if;
  if coalesce(v_draft.validation_score, -1) < 80 then
    raise exception using errcode = '23514', message = 'validation_score_below_80';
  end if;
  if jsonb_typeof(v_draft.validation_blockers) <> 'array'
    or jsonb_array_length(v_draft.validation_blockers) <> 0 then
    raise exception using errcode = '23514', message = 'validation_blockers_not_empty';
  end if;
  if jsonb_typeof(v_draft.validation_pending) <> 'array'
    or jsonb_array_length(v_draft.validation_pending) <> 0 then
    raise exception using errcode = '23514', message = 'validation_pending_not_empty';
  end if;
  if v_draft.validated_at is null then
    raise exception using errcode = '23514', message = 'validated_at_required';
  end if;
  begin
    v_context_snapshot_at :=
      nullif(v_draft.data #>> '{publication_context,context_snapshot_at}', '')::timestamptz;
  exception
    when others then
      raise exception using errcode = '22023', message = 'publication_context_snapshot_invalid';
  end;
  if v_context_snapshot_at is null
    or v_context_snapshot_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'publication_context_snapshot_invalid';
  end if;

  -- Serializa la activación global. No se persiste un estado intermedio
  -- "publishing": si cualquier sentencia falla, PostgreSQL revierte todo.
  perform pg_advisory_xact_lock(
    hashtextextended('published_weeks:global_active', 0)
  );
  if exists (
    select 1
    from public.published_weeks
    where publication_status in ('published', 'superseded')
      and published_at > v_context_snapshot_at
  ) then
    raise exception using
      errcode = '40001',
      message = 'publication_context_changed';
  end if;
  perform set_config('app.published_weeks_v2_internal', 'on', true);

  update public.published_weeks
  set
    is_active = false,
    publication_status = 'superseded',
    superseded_at = coalesce(superseded_at, now()),
    updated_at = now()
  where is_active is true;

  select coalesce(max(version_number), 0) + 1
  into v_next_version
  from public.published_weeks
  where mesociclo = v_draft.mesociclo
    and semana = v_draft.semana
    and cycle_id = v_draft.cycle_id;

  insert into public.published_weeks (
    mesociclo,
    semana,
    cycle_id,
    cycle_start_date,
    week_start_date,
    titulo,
    data,
    is_active,
    published_at,
    edit_history,
    publication_status,
    revision,
    version_number,
    source_week_id,
    content_fingerprint,
    validation_fingerprint,
    validation_status,
    validation_score,
    validation_blockers,
    validation_pending,
    validated_at,
    updated_at,
    superseded_at
  )
  values (
    v_draft.mesociclo,
    v_draft.semana,
    v_draft.cycle_id,
    v_draft.cycle_start_date,
    v_draft.week_start_date,
    v_draft.titulo,
    v_draft.data,
    true,
    now(),
    coalesce(v_draft.edit_history, '[]'::jsonb),
    'published',
    1,
    v_next_version,
    v_draft.id,
    v_draft.content_fingerprint,
    v_draft.validation_fingerprint,
    v_draft.validation_status,
    v_draft.validation_score,
    v_draft.validation_blockers,
    v_draft.validation_pending,
    v_draft.validated_at,
    now(),
    null
  )
  returning * into v_published;

  update public.published_weeks
  set
    publication_status = 'consumed',
    is_active = false,
    revision = revision + 1,
    superseded_at = coalesce(superseded_at, now()),
    updated_at = now()
  where id = v_draft.id;

  return jsonb_build_object(
    'id', v_published.id,
    'mesociclo', v_published.mesociclo,
    'semana', v_published.semana,
    'cycle_id', v_published.cycle_id,
    'cycle_start_date', v_published.cycle_start_date,
    'week_start_date', v_published.week_start_date,
    'titulo', v_published.titulo,
    'data', v_published.data,
    'is_active', v_published.is_active,
    'publication_status', v_published.publication_status,
    'revision', v_published.revision,
    'version_number', v_published.version_number,
    'source_week_id', v_published.source_week_id,
    'content_fingerprint', v_published.content_fingerprint,
    'validation_fingerprint', v_published.validation_fingerprint,
    'validation_status', v_published.validation_status,
    'validation_score', v_published.validation_score,
    'validation_blockers', v_published.validation_blockers,
    'validation_pending', v_published.validation_pending,
    'validated_at', v_published.validated_at,
    'published_at', v_published.published_at,
    'updated_at', v_published.updated_at,
    'superseded_at', v_published.superseded_at,
    'consumed_draft_id', v_draft.id,
    'consumed_draft_revision', v_draft.revision + 1
  );
end;
$$;

-- Envoltura de una sola sentencia para la API: guardar la revisión exacta,
-- sellarla como aprobada y publicarla pertenecen a la misma transacción. Si la
-- activación falla, PostgreSQL revierte también la escritura del borrador.
create or replace function public.save_and_publish_published_week_v2(
  p_mesociclo text,
  p_semana integer,
  p_titulo text,
  p_data jsonb,
  p_draft_id uuid default null,
  p_expected_revision bigint default null,
  p_source_week_id uuid default null,
  p_validation_fingerprint text default null,
  p_validation_score integer default null,
  p_validation_blockers jsonb default '[]'::jsonb,
  p_validation_pending jsonb default '[]'::jsonb,
  p_validated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_saved jsonb;
begin
  v_saved := public.save_published_week_draft_v2(
    p_mesociclo => p_mesociclo,
    p_semana => p_semana,
    p_titulo => p_titulo,
    p_data => p_data,
    p_draft_id => p_draft_id,
    p_expected_revision => p_expected_revision,
    p_source_week_id => p_source_week_id,
    p_content_fingerprint => null,
    p_validation_fingerprint => p_validation_fingerprint,
    p_validation_status => 'approved',
    p_validation_score => p_validation_score,
    p_validation_blockers => p_validation_blockers,
    p_validation_pending => p_validation_pending,
    p_validated_at => p_validated_at
  );

  return public.publish_published_week_draft_v2(
    p_draft_id => (v_saved ->> 'id')::uuid,
    p_expected_revision => (v_saved ->> 'revision')::bigint,
    p_expected_content_fingerprint => v_saved ->> 'content_fingerprint',
    p_expected_validation_fingerprint => p_validation_fingerprint
  );
end;
$$;

-- El cliente público solo puede leer versiones ya publicadas. Los borradores se
-- consultan exclusivamente mediante la API autenticada con service_role.
revoke all on table public.published_weeks from anon, authenticated;
grant select on table public.published_weeks to anon, authenticated;
grant select, insert, update on table public.published_weeks to service_role;

alter table public.published_weeks enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'published_weeks'
  loop
    execute format(
      'drop policy %I on public.published_weeks',
      v_policy.policyname
    );
  end loop;
end;
$$;

create policy published_weeks_public_read_v2
  on public.published_weeks
  for select
  to anon, authenticated
  using (publication_status in ('published', 'superseded'));

-- El limitador recibe IP y nombre de endpoint arbitrarios: solo las funciones
-- server-side pueden consumirlo. La anon key no puede inflar o agotar buckets.
do $$
begin
  if pg_catalog.to_regprocedure(
    'public.check_rate_limit(text,text,integer,integer)'
  ) is not null then
    execute
      'revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated';
    execute
      'grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role';
  end if;
end;
$$;

revoke all on function public.save_published_week_draft_v2(
  text,
  integer,
  text,
  jsonb,
  uuid,
  bigint,
  uuid,
  text,
  text,
  text,
  integer,
  jsonb,
  jsonb,
  timestamptz
) from public;
revoke all on function public.save_published_week_draft_v2(
  text,
  integer,
  text,
  jsonb,
  uuid,
  bigint,
  uuid,
  text,
  text,
  text,
  integer,
  jsonb,
  jsonb,
  timestamptz
) from anon, authenticated;
revoke all on function public.publish_published_week_draft_v2(
  uuid,
  bigint,
  text,
  text
) from public;
revoke all on function public.publish_published_week_draft_v2(
  uuid,
  bigint,
  text,
  text
) from anon, authenticated;
revoke all on function public.save_and_publish_published_week_v2(
  text,
  integer,
  text,
  jsonb,
  uuid,
  bigint,
  uuid,
  text,
  integer,
  jsonb,
  jsonb,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.save_published_week_draft_v2(
  text,
  integer,
  text,
  jsonb,
  uuid,
  bigint,
  uuid,
  text,
  text,
  text,
  integer,
  jsonb,
  jsonb,
  timestamptz
) to service_role;
grant execute on function public.publish_published_week_draft_v2(
  uuid,
  bigint,
  text,
  text
) to service_role;
grant execute on function public.save_and_publish_published_week_v2(
  text,
  integer,
  text,
  jsonb,
  uuid,
  bigint,
  uuid,
  text,
  integer,
  jsonb,
  jsonb,
  timestamptz
) to service_role;

comment on column public.published_weeks.publication_status is
  'draft | publishing | published | superseded | consumed | legacy_unverified. Consumed conserva el borrador de origen sin hacerlo público.';
comment on column public.published_weeks.revision is
  'Revisión optimista de la fila; debe coincidir al actualizar/publicar un borrador.';
comment on column public.published_weeks.version_number is
  'Versión monotónica de fila dentro de (mesociclo, semana, cycle_id).';
comment on column public.published_weeks.source_week_id is
  'Linaje: versión de origen; una publicación V2 apunta al borrador consumido.';
comment on column public.published_weeks.content_fingerprint is
  'MD5 canónico calculado por PostgreSQL sobre data::text; identifica el contenido exacto.';
comment on column public.published_weeks.validation_fingerprint is
  'Huella fp1 del objetivo evaluado (documento + ciclo/contexto); no es el MD5 de data.';
comment on function public.save_published_week_draft_v2(
  text,
  integer,
  text,
  jsonb,
  uuid,
  bigint,
  uuid,
  text,
  text,
  text,
  integer,
  jsonb,
  jsonb,
  timestamptz
) is
  'Crea o actualiza el único borrador de un slot con revisión optimista.';
comment on function public.publish_published_week_draft_v2(
  uuid,
  bigint,
  text,
  text
) is
  'Publica y activa atómicamente un borrador aprobado, sin modificar publicaciones previas.';
comment on function public.save_and_publish_published_week_v2(
  text,
  integer,
  text,
  jsonb,
  uuid,
  bigint,
  uuid,
  text,
  integer,
  jsonb,
  jsonb,
  timestamptz
) is
  'Guarda, aprueba y publica una revisión exacta en una única transacción recuperable.';
