-- Contexto de referencia global para programación (Drive/histórico).
-- Lectura pública para que el generador la pueda consumir.
-- Escritura solo vía service role (endpoint backend) o SQL dashboard.

create table if not exists public.programming_reference_context (
  id text primary key default 'default',
  context_text text not null default '',
  source text,
  updated_at timestamptz not null default now()
);

alter table public.programming_reference_context enable row level security;

create policy "programming_reference_context_select_public"
  on public.programming_reference_context
  for select
  to anon, authenticated
  using (true);

insert into public.programming_reference_context (id, context_text, source)
  values ('default', '', 'bootstrap')
  on conflict (id) do nothing;
