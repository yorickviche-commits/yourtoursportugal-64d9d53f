create table if not exists public.jarvis_state (
  key text primary key,
  kind text not null check (kind in ('done', 'check', 'stage')),
  ref text,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create index if not exists jarvis_state_updated_at_idx on public.jarvis_state (updated_at desc);
alter table public.jarvis_state enable row level security;