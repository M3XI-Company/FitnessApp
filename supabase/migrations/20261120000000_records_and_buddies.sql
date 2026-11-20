-- Workout records and the buddy system.
-- Every table here is written and read only by Edge Functions (service role).
-- Row level security is on with no policies, so the app's public key cannot
-- touch them directly. A person is identified by `owner`: the SHA-256 of
-- their app install id, which only their phone holds.

-- One row per set logged in a workout.
create table if not exists public.workout_sets (
  owner text not null,
  id text not null,
  user_id uuid references auth.users (id) on delete set null,
  date date not null,
  exercise_id text not null,
  weight numeric(7, 2) not null,
  reps integer not null,
  created_at timestamptz not null default now(),
  primary key (owner, id)
);
create index if not exists workout_sets_user on public.workout_sets (user_id, date desc);
alter table public.workout_sets enable row level security;

-- What someone looking for a training partner has chosen to show. Adults only.
create table if not exists public.buddy_profiles (
  owner text primary key,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  age integer not null check (age >= 18),
  goal text not null,
  level text not null,
  times text[] not null default '{}',
  gym text not null,
  lat double precision not null,
  lon double precision not null,
  bio text not null default '',
  looking_for text not null default '',
  days_per_week integer not null default 3,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists buddy_profiles_place on public.buddy_profiles (lat, lon) where active;
alter table public.buddy_profiles enable row level security;

-- A yes or a no to one person.
create table if not exists public.buddy_swipes (
  owner text not null,
  target text not null,
  liked boolean not null,
  at timestamptz not null default now(),
  primary key (owner, target)
);
create index if not exists buddy_swipes_target on public.buddy_swipes (target, owner) where liked;
alter table public.buddy_swipes enable row level security;

-- Two people who both said yes. a sorts before b.
create table if not exists public.buddy_matches (
  id uuid primary key default gen_random_uuid(),
  a text not null,
  b text not null,
  created_at timestamptz not null default now(),
  -- the session the two of them do together, as the coach laid it out
  joint_plan jsonb,
  a_read_at timestamptz not null default now(),
  b_read_at timestamptz not null default now(),
  unique (a, b),
  check (a < b)
);
create index if not exists buddy_matches_b on public.buddy_matches (b);
alter table public.buddy_matches enable row level security;

create table if not exists public.buddy_messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.buddy_matches (id) on delete cascade,
  sender text not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists buddy_messages_match on public.buddy_messages (match_id, id);
alter table public.buddy_messages enable row level security;

create table if not exists public.buddy_blocks (
  owner text not null,
  target text not null,
  at timestamptz not null default now(),
  primary key (owner, target)
);
create index if not exists buddy_blocks_target on public.buddy_blocks (target);
alter table public.buddy_blocks enable row level security;

-- Reports, for a moderator to read in the dashboard.
create table if not exists public.buddy_reports (
  id bigint generated always as identity primary key,
  owner text not null,
  target text not null,
  reason text not null,
  at timestamptz not null default now()
);
alter table public.buddy_reports enable row level security;

-- The id other people see for a profile, so the owner hash never leaves the server.
alter table public.buddy_profiles add column if not exists pid uuid not null default gen_random_uuid();
create unique index if not exists buddy_profiles_pid on public.buddy_profiles (pid);
