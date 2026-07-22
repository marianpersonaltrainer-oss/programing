-- Puente Programming EVO · V0
-- Registro mínimo de aperturas/cierres. Aditivo y dependiente de
-- organizations, profiles, pe2_my_org() y pe2_my_role() existentes.

create table if not exists public.shift_protocol_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id),
  org_id uuid not null default public.pe2_my_org() references public.organizations (id),
  record_type text not null check (record_type in ('apertura', 'cierre')),
  result text not null check (result in ('completado', 'incidencia')),
  comment text,
  all_steps_confirmed boolean not null default false,
  protocol_version text not null,
  created_at timestamptz not null default now(),
  constraint shift_protocol_logs_incident_comment_check check (
    result <> 'incidencia' or length(btrim(coalesce(comment, ''))) > 0
  ),
  constraint shift_protocol_logs_completed_confirmation_check check (
    result <> 'completado' or all_steps_confirmed = true
  )
);

create index if not exists shift_protocol_logs_user_created_idx
  on public.shift_protocol_logs (user_id, created_at desc);

create index if not exists shift_protocol_logs_org_created_idx
  on public.shift_protocol_logs (org_id, created_at desc);

alter table public.shift_protocol_logs enable row level security;

-- Solo las columnas funcionales pueden llegar en un INSERT del cliente.
-- user_id, org_id, id y created_at se imponen mediante defaults de la BD.
revoke all on table public.shift_protocol_logs from anon, authenticated;
grant select on table public.shift_protocol_logs to authenticated;
grant insert (
  record_type,
  result,
  comment,
  all_steps_confirmed,
  protocol_version
) on table public.shift_protocol_logs to authenticated;

drop policy if exists shift_protocol_logs_insert_own on public.shift_protocol_logs;
create policy shift_protocol_logs_insert_own
  on public.shift_protocol_logs
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and org_id = public.pe2_my_org()
    and public.pe2_my_role() = 'coach'
  );

drop policy if exists shift_protocol_logs_select_own on public.shift_protocol_logs;
create policy shift_protocol_logs_select_own
  on public.shift_protocol_logs
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and org_id = public.pe2_my_org()
  );

drop policy if exists shift_protocol_logs_select_direction on public.shift_protocol_logs;
create policy shift_protocol_logs_select_direction
  on public.shift_protocol_logs
  for select
  to authenticated
  using (
    public.pe2_my_role() = 'programmer'
    and org_id = public.pe2_my_org()
  );

-- Dirección necesita resolver los nombres del equipo para el filtro y la tabla.
-- El entrenador conserva únicamente la política de lectura de su propio perfil.
drop policy if exists profiles_select_programmer_org on public.profiles;
create policy profiles_select_programmer_org
  on public.profiles
  for select
  to authenticated
  using (
    public.pe2_my_role() = 'programmer'
    and org_id = public.pe2_my_org()
  );

-- La política V2 inicial permitía actualizar la fila completa del perfil propio,
-- incluidos role y org_id. Se conserva únicamente la edición del nombre propio;
-- los campos de autorización solo pueden administrarse con service_role.
drop policy if exists profiles_update_own on public.profiles;
revoke update on table public.profiles from authenticated;
grant update (full_name) on table public.profiles to authenticated;

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

comment on table public.shift_protocol_logs is
  'Puente EVO V0: registro inmutable de aperturas, cierres e incidencias.';
