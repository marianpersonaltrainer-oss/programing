import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260817110000_f1_mi_camino_private_access.sql', import.meta.url),
  'utf8',
).toLowerCase()

const hardening = readFileSync(
  new URL('./20260818120000_f1_mi_camino_read_own_hardening.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('F1 Mi Camino private access', () => {
  it('reutiliza el rol Cliente ya definido y añade capacidades sin perfiles legacy', () => {
    expect(migration).not.toContain('insert into public.evo_roles')
    expect(migration).toContain('insert into public.evo_capabilities (capability_key, description, data_class)')
    expect(migration).toContain("'mi_camino.read_own'")
    expect(migration).toContain("'mi_camino.manage'")
    expect(migration).toContain("('client', 'mi_camino.read_own')")
    expect(migration).toContain("('admin', 'mi_camino.manage')")
    expect(migration).not.toContain('profiles.role')
  })

  it('mantiene una relación privada uno-a-uno entre auth, persona y organización', () => {
    expect(migration).toContain('create table if not exists public.mi_camino_person_access')
    expect(migration).toContain('unique (organization_id, user_id)')
    expect(migration).toContain('unique (organization_id, person_id)')
    expect(migration).toContain("status text not null default 'active'")
  })

  it('limita la proyección a la porción 0→30 y evita una falsa semana cero para veteranos', () => {
    expect(migration).toContain('journey_day integer check (journey_day between 0 and 30)')
    expect(migration).toContain("entry_mode = 'new' and journey_day is not null")
    expect(migration).toContain("entry_mode = 'veteran' and journey_day is null")
  })

  it('no modela salud, notas internas ni texto libre sensible', () => {
    expect(migration).not.toMatch(/\b(health|medical|injury|diagnosis|internal_notes|free_text)\b/)
    expect(migration).toContain('no almacenar salud, notas internas ni texto libre sensible')
  })

  it('define el permiso base de lectura y el hardening evita que Administración lea proyecciones ajenas desde la app cliente', () => {
    expect(migration).toContain('create or replace function private.evo_can_read_mi_camino_projection')
    expect(migration).toContain("private.evo_has_capability(target_organization_id, 'mi_camino.manage')")
    expect(migration).toContain("private.evo_has_capability(target_organization_id, 'mi_camino.read_own')")
    expect(migration).toContain('access_map.user_id = (select auth.uid())')
    expect(migration).toContain('access_map.status = \'active\'')
    expect(hardening).toContain('create or replace function private.evo_can_read_mi_camino_projection')
    expect(hardening).toContain("private.evo_has_capability(target_organization_id, 'mi_camino.read_own')")
    expect(hardening).toContain('access_map.user_id = (select auth.uid())')
    expect(hardening).not.toContain("'mi_camino.manage'")
    expect(hardening).toContain('la administración usa endpoints server-side separados')
  })

  it('cierra anon y todas las escrituras de navegador', () => {
    expect(migration).toContain('alter table public.mi_camino_projections force row level security')
    expect(migration).toContain('revoke all on table public.mi_camino_person_access\n  from public, anon, authenticated')
    expect(migration).toContain('revoke all on table public.mi_camino_projections\n  from public, anon, authenticated')
    expect(migration).toContain('grant select on table public.mi_camino_projections to authenticated')
    expect(migration).not.toContain('grant insert on table public.mi_camino_projections to authenticated')
    expect(migration).not.toContain('grant update on table public.mi_camino_projections to authenticated')
    expect(migration).not.toContain('grant delete on table public.mi_camino_projections to authenticated')
  })

  it('mantiene el helper privilegiado privado y sin execute público', () => {
    expect(migration).toContain('security definer\nset search_path = \'\'')
    expect(migration).toContain('revoke all on function private.evo_can_read_mi_camino_projection(uuid, uuid)')
    expect(migration).toContain('to authenticated, service_role')
  })

  it('hace atómicas la activación y baja server-side, sin exponer RPC a clientes', () => {
    expect(migration).toContain('create or replace function public.evo_provision_mi_camino_access')
    expect(migration).toContain('create or replace function public.evo_set_mi_camino_access_status')
    expect(migration).toContain("raise exception 'mi_camino_person_access_conflict'")
    expect(migration).toContain('revoke all on function public.evo_provision_mi_camino_access(uuid, uuid, jsonb, uuid)')
    expect(migration).toContain('grant execute on function public.evo_provision_mi_camino_access(uuid, uuid, jsonb, uuid)\n  to service_role')
    expect(migration).not.toContain('grant execute on function public.evo_provision_mi_camino_access(uuid, uuid, jsonb, uuid)\n  to authenticated')
  })
})
