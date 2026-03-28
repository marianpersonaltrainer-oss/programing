-- Panel "Contenido coach" + banner / inventario estructurado
-- Escritura vía API serverless (service role), no desde anon.

alter table public.coach_guide_settings
  add column if not exists active_notice text,
  add column if not exists material_table jsonb not null default '[]'::jsonb,
  add column if not exists contact_person text,
  add column if not exists contact_schedule text,
  add column if not exists response_time text;

comment on column public.coach_guide_settings.active_notice is 'Banner opcional en vista ?coach';
comment on column public.coach_guide_settings.material_table is 'Inventario: [{ "name", "qty", "rules" }, ...]';
comment on column public.coach_guide_settings.response_time is 'Texto libre: tiempo de respuesta del soporte';
