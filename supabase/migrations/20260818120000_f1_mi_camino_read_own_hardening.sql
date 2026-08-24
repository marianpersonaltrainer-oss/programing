-- Fase 1: endurecimiento de privacidad de Mi Camino.
--
-- La app cliente nunca debe usar el permiso administrativo para leer las
-- proyecciones de otras personas. La administración conserva exclusivamente
-- las operaciones server-side ya autorizadas; toda futura lectura agregada o
-- administrativa debe tener su propio endpoint y contrato explícito.
--
-- Rollback en staging: restaurar la versión anterior de esta función. No hay
-- transformación ni borrado de datos.

create or replace function private.evo_can_read_mi_camino_projection(
  target_organization_id uuid,
  target_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and private.evo_has_capability(target_organization_id, 'mi_camino.read_own')
    and exists (
      select 1
      from public.mi_camino_person_access access_map
      where access_map.organization_id = target_organization_id
        and access_map.person_id = target_person_id
        and access_map.user_id = (select auth.uid())
        and access_map.status = 'active'
    );
$$;

revoke all on function private.evo_can_read_mi_camino_projection(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.evo_can_read_mi_camino_projection(uuid, uuid)
  to authenticated, service_role;

comment on function private.evo_can_read_mi_camino_projection(uuid, uuid) is
  'Permite únicamente a la propia identidad activa leer su proyección Mi Camino. La administración usa endpoints server-side separados.';
