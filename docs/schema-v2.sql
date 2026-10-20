-- Run ONCE in the Supabase SQL editor. Additive only: it creates two NEW tables and does not touch `contacts`.
-- Safe to run twice (IF NOT EXISTS).

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('pageview','click','form_start','form_success','form_error','remove_open','remove_success')),
  target text check (target is null or char_length(target) <= 40),
  path text not null check (char_length(path) <= 41),
  session text not null check (char_length(session) between 16 and 32),
  country text check (country is null or char_length(country) = 2),
  region text check (region is null or char_length(region) <= 10),
  city text check (city is null or char_length(city) <= 60),
  referrer text check (referrer is null or char_length(referrer) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

create table if not exists public.admin_sessions (
  token_hash text primary key check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from anon, authenticated;

-- Optional housekeeping you can run any time to keep only the last 180 days of analytics:
-- delete from public.analytics_events where created_at < now() - interval '180 days';
