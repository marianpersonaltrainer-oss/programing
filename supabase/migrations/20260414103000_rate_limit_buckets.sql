-- Sprint 1 / Seguridad API Anthropic:
-- - Rate limit por IP + endpoint en buckets por ventana.
-- - Log de uso/tokens por llamada.

create table if not exists public.rate_limit_buckets (
  ip text not null,
  endpoint text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip, endpoint, window_start)
);

create index if not exists idx_rate_limit_buckets_window_start
  on public.rate_limit_buckets (window_start desc);

alter table public.rate_limit_buckets enable row level security;

create table if not exists public.api_usage_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  endpoint text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  total_tokens int not null default 0,
  ip text
);

create index if not exists idx_api_usage_log_created_at
  on public.api_usage_log (created_at desc);

alter table public.api_usage_log enable row level security;

create or replace function public.check_rate_limit(
  p_ip text,
  p_endpoint text,
  p_limit int,
  p_window_minutes int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_seconds int := greatest(1, coalesce(p_window_minutes, 10)) * 60;
  v_window_start timestamptz;
  v_count int;
begin
  v_window_start :=
    to_timestamp(floor(extract(epoch from v_now) / v_window_seconds) * v_window_seconds);

  insert into public.rate_limit_buckets (ip, endpoint, window_start, count)
  values (coalesce(p_ip, 'unknown'), coalesce(p_endpoint, '/api/anthropic'), v_window_start, 1)
  on conflict (ip, endpoint, window_start)
  do update
    set count = public.rate_limit_buckets.count + 1
  returning count into v_count;

  return v_count > greatest(1, coalesce(p_limit, 30));
end;
$$;

revoke all on function public.check_rate_limit(text, text, int, int) from public;
grant execute on function public.check_rate_limit(text, text, int, int) to anon, authenticated, service_role;

