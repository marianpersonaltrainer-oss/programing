-- Overrides editables para la guía coach (Table Editor en Supabase).
-- Lectura pública con anon key; escritura solo desde el dashboard (service role / SQL).

create table if not exists public.coach_guide_settings (
  id text primary key default 'default',
  contact_channel text,
  contact_response text,
  material_override text,
  updated_at timestamptz default now()
);

alter table public.coach_guide_settings enable row level security;

create policy "coach_guide_settings_select_public"
  on public.coach_guide_settings
  for select
  to anon, authenticated
  using (true);

-- Sin políticas de INSERT/UPDATE para anon: el admin edita en Table Editor.

insert into public.coach_guide_settings (id)
  values ('default')
  on conflict (id) do nothing;
