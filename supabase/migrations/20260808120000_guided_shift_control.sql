-- Control de turno guiado · Programming EVO
-- Secuencia operativa, novedades y seguimientos post-clase. Aditivo y dependiente de
-- organizations, profiles, pe2_my_org() y pe2_my_role() existentes.

create table if not exists public.shift_protocol_logs (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id),
  org_id uuid not null default public.pe2_my_org() references public.organizations (id),
  record_type text not null check (record_type in ('apertura', 'revision', 'cierre')),
  result text not null check (result in ('completado', 'incidencia')),
  comment text,
  all_steps_confirmed boolean not null default false,
  first_class_expected boolean not null default false,
  protocol_version text not null default 'v0'
    check (protocol_version = 'v0'),
  created_at timestamptz not null default now(),
  constraint shift_protocol_logs_incident_comment_check check (
    result <> 'incidencia' or coalesce(comment, '') ~ '[^[:space:]]'
  ),
  constraint shift_protocol_logs_completed_confirmation_check check (
    all_steps_confirmed = (result = 'completado')
  ),
  constraint shift_protocol_logs_review_check check (
    record_type <> 'revision'
    or (result = 'completado' and all_steps_confirmed = true)
  ),
  constraint shift_protocol_logs_first_class_check check (
    record_type = 'revision' or first_class_expected = false
  ),
  constraint shift_protocol_logs_comment_length_check check (
    char_length(coalesce(comment, '')) <= 600
  )
);

create index if not exists shift_protocol_logs_user_created_idx
  on public.shift_protocol_logs (user_id, created_at desc);

create index if not exists shift_protocol_logs_org_created_idx
  on public.shift_protocol_logs (org_id, created_at desc);

create index if not exists shift_protocol_logs_user_shift_created_idx
  on public.shift_protocol_logs (user_id, shift_id, created_at desc);

create unique index if not exists shift_protocol_logs_one_completed_step_idx
  on public.shift_protocol_logs (shift_id, record_type)
  where result = 'completado';

alter table public.shift_protocol_logs enable row level security;

-- Solo las columnas funcionales pueden llegar en un INSERT del cliente.
-- user_id, org_id, id y created_at se imponen mediante defaults de la BD.
revoke all on table public.shift_protocol_logs from anon, authenticated;
grant select on table public.shift_protocol_logs to authenticated;
grant insert (
  shift_id,
  record_type,
  result,
  comment,
  all_steps_confirmed,
  first_class_expected,
  protocol_version
) on table public.shift_protocol_logs to authenticated;

drop policy if exists shift_protocol_logs_insert_own on public.shift_protocol_logs;
create policy shift_protocol_logs_insert_own
  on public.shift_protocol_logs
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = (select public.pe2_my_org())
    and (select public.pe2_my_role()) = 'coach'
  );

drop policy if exists shift_protocol_logs_select_own on public.shift_protocol_logs;
create policy shift_protocol_logs_select_own
  on public.shift_protocol_logs
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = (select public.pe2_my_org())
    and (select public.pe2_my_role()) = 'coach'
    and created_at >= (
      date_trunc('day', timezone('Europe/Madrid', now()))
      at time zone 'Europe/Madrid'
    )
    and created_at < (
      (date_trunc('day', timezone('Europe/Madrid', now())) + interval '1 day')
      at time zone 'Europe/Madrid'
    )
  );

drop policy if exists shift_protocol_logs_select_direction on public.shift_protocol_logs;
create policy shift_protocol_logs_select_direction
  on public.shift_protocol_logs
  for select
  to authenticated
  using (
    (select public.pe2_my_role()) = 'programmer'
    and org_id = (select public.pe2_my_org())
  );

-- Dirección necesita resolver los nombres del equipo para el filtro y la tabla.
-- El entrenador conserva únicamente la política de lectura de su propio perfil.
drop policy if exists profiles_select_programmer_org on public.profiles;
create policy profiles_select_programmer_org
  on public.profiles
  for select
  to authenticated
  using (
    (select public.pe2_my_role()) = 'programmer'
    and org_id = (select public.pe2_my_org())
  );

-- La política V2 inicial permitía actualizar la fila completa del perfil propio,
-- incluidos role y org_id. Se conserva únicamente la edición del nombre propio;
-- los campos de autorización solo pueden administrarse con service_role.
drop policy if exists profiles_update_own on public.profiles;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

comment on table public.shift_protocol_logs is
  'Control de turno EVO: pasos guiados e incidencias, inmutables y separados por turno.';

-- Las funciones auxiliares son SECURITY DEFINER: no quedan invocables por
-- sesiones anónimas ni por PUBLIC.
revoke all on function public.pe2_my_org() from public, anon;
revoke all on function public.pe2_my_role() from public, anon;
grant execute on function public.pe2_my_org() to authenticated;
grant execute on function public.pe2_my_role() to authenticated;

-- Novedades del equipo y seguimientos post-clase. Es una entrada operativa
-- mínima: no crea fichas de alumno, CRM ni dependencias con Cerebro EVO.
create table if not exists public.shift_notes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id),
  org_id uuid not null default public.pe2_my_org() references public.organizations (id),
  note_type text not null check (note_type in ('team', 'post_class')),
  team_note text,
  person_name text,
  is_first_class boolean not null default false,
  mobility_technique text,
  discomfort_status text check (
    discomfort_status is null
    or discomfort_status in ('none', 'stable', 'improved', 'worsened')
  ),
  discomfort_zone text,
  discomfort_intensity smallint check (
    discomfort_intensity is null
    or discomfort_intensity between 0 and 10
  ),
  work_volume_percent smallint check (
    work_volume_percent is null
    or work_volume_percent in (25, 50, 75, 100)
  ),
  loads_used text,
  adapted_exercises text,
  schema_version smallint not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  constraint shift_notes_team_check check (
    note_type <> 'team'
    or (
      coalesce(team_note, '') ~ '[^[:space:]]'
      and person_name is null
      and mobility_technique is null
      and discomfort_status is null
      and discomfort_zone is null
      and discomfort_intensity is null
      and work_volume_percent is null
      and loads_used is null
      and adapted_exercises is null
      and is_first_class = false
    )
  ),
  constraint shift_notes_post_class_check check (
    note_type <> 'post_class'
    or (
      team_note is null
      and coalesce(person_name, '') ~ '[^[:space:]]'
      and coalesce(mobility_technique, '') ~ '[^[:space:]]'
      and discomfort_status is not null
      and discomfort_intensity is not null
      and work_volume_percent in (25, 50, 75, 100)
      and coalesce(loads_used, '') ~ '[^[:space:]]'
      and coalesce(adapted_exercises, '') ~ '[^[:space:]]'
    )
  ),
  constraint shift_notes_discomfort_detail_check check (
    discomfort_status is null
    or (
      discomfort_status = 'none'
      and discomfort_intensity = 0
      and discomfort_zone is null
    )
    or (
      discomfort_status in ('stable', 'improved', 'worsened')
      and coalesce(discomfort_zone, '') ~ '[^[:space:]]'
      and discomfort_intensity between 0 and 10
    )
  ),
  constraint shift_notes_text_lengths_check check (
    char_length(coalesce(person_name, '')) <= 120
    and char_length(coalesce(team_note, '')) <= 600
    and char_length(coalesce(mobility_technique, '')) <= 400
    and char_length(coalesce(discomfort_zone, '')) <= 400
    and char_length(coalesce(loads_used, '')) <= 400
    and char_length(coalesce(adapted_exercises, '')) <= 400
  )
);

create index if not exists shift_notes_org_created_idx
  on public.shift_notes (org_id, created_at desc);

create index if not exists shift_notes_org_type_created_idx
  on public.shift_notes (org_id, note_type, created_at desc);

create index if not exists shift_notes_user_shift_created_idx
  on public.shift_notes (user_id, shift_id, created_at desc);

alter table public.shift_notes enable row level security;

revoke all on table public.shift_notes from anon, authenticated;
grant select on table public.shift_notes to authenticated;
grant insert (
  shift_id,
  note_type,
  team_note,
  person_name,
  is_first_class,
  mobility_technique,
  discomfort_status,
  discomfort_zone,
  discomfort_intensity,
  work_volume_percent,
  loads_used,
  adapted_exercises,
  schema_version
) on table public.shift_notes to authenticated;

drop policy if exists shift_notes_insert_own on public.shift_notes;
create policy shift_notes_insert_own
  on public.shift_notes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = (select public.pe2_my_org())
    and (select public.pe2_my_role()) = 'coach'
  );

drop policy if exists shift_notes_select_team on public.shift_notes;
create policy shift_notes_select_team
  on public.shift_notes
  for select
  to authenticated
  using (
    (select public.pe2_my_role()) = 'coach'
    and org_id = (select public.pe2_my_org())
    and created_at >= (
      date_trunc('day', timezone('Europe/Madrid', now()))
      at time zone 'Europe/Madrid'
    )
    and created_at < (
      (date_trunc('day', timezone('Europe/Madrid', now())) + interval '1 day')
      at time zone 'Europe/Madrid'
    )
  );

drop policy if exists shift_notes_select_direction on public.shift_notes;
create policy shift_notes_select_direction
  on public.shift_notes
  for select
  to authenticated
  using (
    (select public.pe2_my_role()) = 'programmer'
    and org_id = (select public.pe2_my_org())
  );

comment on table public.shift_notes is
  'Novedades del turno y seguimientos post-clase, inmutables y limitados a la organización.';

-- La base de datos impone el orden, incluso si un cliente evita la interfaz.
create or replace function public.validate_shift_protocol_log_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shift_day date := timezone('Europe/Madrid', new.created_at)::date;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.shift_id::text, 0)
  );

  if new.user_id <> (select auth.uid())
    or new.org_id <> (select public.pe2_my_org()) then
    raise exception using errcode = '42501', message = 'shift identity mismatch';
  end if;

  if exists (
    select 1
    from public.shift_protocol_logs log
    where log.user_id = new.user_id
      and log.org_id = new.org_id
      and log.shift_id = new.shift_id
      and timezone('Europe/Madrid', log.created_at)::date = shift_day
      and log.record_type = 'cierre'
      and log.result = 'completado'
  ) then
    raise exception using errcode = '23514', message = 'shift already finished';
  end if;

  if new.record_type <> 'apertura' and not exists (
    select 1
    from public.shift_protocol_logs log
    where log.user_id = new.user_id
      and log.org_id = new.org_id
      and log.shift_id = new.shift_id
      and timezone('Europe/Madrid', log.created_at)::date = shift_day
      and log.record_type = 'apertura'
      and log.result = 'completado'
  ) then
    raise exception using errcode = '23514', message = 'opening must be completed first';
  end if;

  if new.record_type = 'cierre' then
    if not exists (
      select 1
      from public.shift_protocol_logs log
      where log.user_id = new.user_id
        and log.org_id = new.org_id
        and log.shift_id = new.shift_id
        and timezone('Europe/Madrid', log.created_at)::date = shift_day
        and log.record_type = 'revision'
        and log.result = 'completado'
    ) then
      raise exception using errcode = '23514', message = 'review must be completed first';
    end if;

    if exists (
      select 1
      from public.shift_protocol_logs log
      where log.user_id = new.user_id
        and log.org_id = new.org_id
        and log.shift_id = new.shift_id
        and timezone('Europe/Madrid', log.created_at)::date = shift_day
        and log.record_type = 'revision'
        and log.result = 'completado'
        and log.first_class_expected = true
    ) and not exists (
      select 1
      from public.shift_notes note
      where note.user_id = new.user_id
        and note.org_id = new.org_id
        and note.shift_id = new.shift_id
        and timezone('Europe/Madrid', note.created_at)::date = shift_day
        and note.note_type = 'post_class'
        and note.is_first_class = true
    ) then
      raise exception using errcode = '23514', message = 'first class follow-up must be completed first';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_shift_protocol_log_sequence() from public, anon, authenticated;

drop trigger if exists validate_shift_protocol_log_sequence_trigger on public.shift_protocol_logs;
create trigger validate_shift_protocol_log_sequence_trigger
  before insert on public.shift_protocol_logs
  for each row execute function public.validate_shift_protocol_log_sequence();

create or replace function public.validate_shift_note_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shift_day date := timezone('Europe/Madrid', new.created_at)::date;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.shift_id::text, 0)
  );

  if new.user_id <> (select auth.uid())
    or new.org_id <> (select public.pe2_my_org()) then
    raise exception using errcode = '42501', message = 'shift identity mismatch';
  end if;

  if not exists (
    select 1
    from public.shift_protocol_logs log
    where log.user_id = new.user_id
      and log.org_id = new.org_id
      and log.shift_id = new.shift_id
      and timezone('Europe/Madrid', log.created_at)::date = shift_day
      and log.record_type = 'revision'
      and log.result = 'completado'
  ) then
    raise exception using errcode = '23514', message = 'review must be completed before adding notes';
  end if;

  if exists (
    select 1
    from public.shift_protocol_logs log
    where log.user_id = new.user_id
      and log.org_id = new.org_id
      and log.shift_id = new.shift_id
      and timezone('Europe/Madrid', log.created_at)::date = shift_day
      and log.record_type = 'cierre'
      and log.result = 'completado'
  ) then
    raise exception using errcode = '23514', message = 'finished shifts are immutable';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_shift_note_sequence() from public, anon, authenticated;

drop trigger if exists validate_shift_note_sequence_trigger on public.shift_notes;
create trigger validate_shift_note_sequence_trigger
  before insert on public.shift_notes
  for each row execute function public.validate_shift_note_sequence();
