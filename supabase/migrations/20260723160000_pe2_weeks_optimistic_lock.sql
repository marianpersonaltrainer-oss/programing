-- Optimistic locking para borradores pe2_weeks (Programación V2).
-- Evita que una pestaña antigua sobrescriba una versión más reciente.
-- Rollback: alter table public.pe2_weeks drop column if exists lock_version;
--           restaurar pe2_weeks_set_updated_at sin bump de lock_version.

alter table public.pe2_weeks
  add column if not exists lock_version integer not null default 1;

comment on column public.pe2_weeks.lock_version is
  'Incrementa en cada UPDATE; el cliente debe enviar el valor leído para evitar sobrescrituras concurrentes.';

create or replace function public.pe2_weeks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then
    new.lock_version = coalesce(old.lock_version, 0) + 1;
  end if;
  return new;
end;
$$;

-- Datos existentes: conservar lock_version=1 salvo filas ya actualizadas tras la migración.
