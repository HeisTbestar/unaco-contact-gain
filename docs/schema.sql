-- Run once in the Supabase SQL editor.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  username text not null check (char_length(username) between 2 and 30),
  phone_e164 text not null unique check (phone_e164 ~ '^\+234[0-9]{10}$'),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Lock the table: RLS on with NO policies means the public anon key can read/write nothing.
-- Only the server, using the service-role key, can access it.
alter table public.contacts enable row level security;
revoke all on public.contacts from anon, authenticated;
