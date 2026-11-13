-- AI usage ledger: one row per AI call, for per-device/per-user limits and cost monitoring.
-- Written only by Edge Functions (service role). Clients can't read or write it.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  feature text not null,                -- e.g. 'food_photo'
  device_hash text not null,            -- SHA-256 of the app install id (never the raw id)
  user_id uuid references auth.users (id) on delete cascade,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  outcome text not null                 -- 'ok' | 'not_food' | 'declined' | 'error'
);

create index if not exists ai_usage_device_month on public.ai_usage (device_hash, feature, created_at desc);
create index if not exists ai_usage_user_month on public.ai_usage (user_id, feature, created_at desc);

alter table public.ai_usage enable row level security;
-- No policies: with RLS on and no policy, anon/authenticated clients have no access at all.
