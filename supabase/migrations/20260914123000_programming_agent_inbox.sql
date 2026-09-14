-- Relevo mínimo Head Coach -> agente de Programing EVO.
-- Solo servicio servidor; no se expone a anon/authenticated ni contiene texto libre.
create table if not exists public.programming_agent_inbox (
  week_start_date date primary key,
  source text not null check (source = 'head_coach_to_programming_agent'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  received_at timestamptz not null default now()
);

alter table public.programming_agent_inbox enable row level security;

revoke all on table public.programming_agent_inbox from anon, authenticated;
grant select, insert, update, delete on table public.programming_agent_inbox to service_role;

comment on table public.programming_agent_inbox is
  'Buzón agregado Head Coach -> Programing; solo service_role, sin nombres, texto libre, WODs ni datos de clientes.';
