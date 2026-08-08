-- Ajuste posterior al despliegue inicial: una sola política SELECT por tabla
-- evita evaluar varias políticas permisivas para cada consulta.

drop policy if exists shift_protocol_logs_select_own on public.shift_protocol_logs;
drop policy if exists shift_protocol_logs_select_direction on public.shift_protocol_logs;
drop policy if exists shift_protocol_logs_select_authorized on public.shift_protocol_logs;
create policy shift_protocol_logs_select_authorized
  on public.shift_protocol_logs
  for select
  to authenticated
  using (
    (
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
    )
    or (
      (select public.pe2_my_role()) = 'programmer'
      and org_id = (select public.pe2_my_org())
    )
  );

drop policy if exists shift_notes_select_team on public.shift_notes;
drop policy if exists shift_notes_select_direction on public.shift_notes;
drop policy if exists shift_notes_select_authorized on public.shift_notes;
create policy shift_notes_select_authorized
  on public.shift_notes
  for select
  to authenticated
  using (
    (
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
    )
    or (
      (select public.pe2_my_role()) = 'programmer'
      and org_id = (select public.pe2_my_org())
    )
  );

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_programmer_org on public.profiles;
drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (
      (select public.pe2_my_role()) = 'programmer'
      and org_id = (select public.pe2_my_org())
    )
  );
