-- Protocol Database Schema
-- Run this in your Supabase SQL editor or via `supabase db reset`

-- ─── Enable Extensions ────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with Protocol-specific fields

create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  name            text not null default '',
  timezone        text not null default 'America/Chicago',
  standup_time    time not null default '07:30',
  current_streak  integer not null default 0,
  season_num      integer not null default 1,
  onboarded       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.users enable row level security;
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Protocol Items ───────────────────────────────────────────────────────
-- The user's standard operating procedure

create type protocol_category as enum (
  'health', 'focus', 'finance', 'relationships', 'creative', 'admin'
);

create type item_source as enum (
  'user_created', 'memory_suggested', 'onboarding'
);

create table public.protocol_items (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,
  label             text not null,
  category          protocol_category not null default 'focus',
  active_days       integer[] not null default '{0,1,2,3,4,5,6}', -- all days
  source            item_source not null default 'user_created',
  active            boolean not null default true,
  completion_rate   numeric(4,3) not null default 0, -- rolling 28-day, 0.0-1.0
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

alter table public.protocol_items enable row level security;
create policy "Users manage own protocol items" on public.protocol_items
  using (auth.uid() = user_id);

create index idx_protocol_items_user on public.protocol_items(user_id, active);

-- ─── Daily Logs ───────────────────────────────────────────────────────────
-- Every task for every day

create type task_type as enum ('protocol', 'stack', 'stretch');
create type task_source as enum ('standup', 'quick_add', 'passive_confirm', 'close');

create table public.daily_logs (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,
  date              date not null,
  task_label        text not null,
  task_type         task_type not null,
  pts_possible      integer not null,
  pts_earned        integer not null default 0,
  completed         boolean not null default false,
  completed_at      timestamptz,
  source            task_source not null default 'standup',
  protocol_item_id  uuid references public.protocol_items(id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table public.daily_logs enable row level security;
create policy "Users manage own daily logs" on public.daily_logs
  using (auth.uid() = user_id);

create index idx_daily_logs_user_date on public.daily_logs(user_id, date desc);

-- ─── Standup Sessions ─────────────────────────────────────────────────────
-- Full conversation history + structured output for both standup and close

create type session_type as enum ('standup', 'close');
create type energy_signal as enum ('high', 'medium', 'low');

create table public.standup_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  date            date not null,
  session_type    session_type not null default 'standup',
  mode            text not null default 'chat', -- 'chat' | 'voice'
  messages        jsonb not null default '[]',
  output          jsonb, -- StandupOutput JSON
  energy_signal   energy_signal,
  carry_forward   text, -- from close sessions, passed to next standup
  duration_sec    integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.standup_sessions enable row level security;
create policy "Users manage own standup sessions" on public.standup_sessions
  using (auth.uid() = user_id);

create index idx_standup_sessions_user_date on public.standup_sessions(user_id, date desc);

-- ─── Weekly Scores ────────────────────────────────────────────────────────
-- Aggregated nightly by Edge Function

create table public.weekly_scores (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  week_of         date not null, -- Monday of the week
  season_num      integer not null default 1,
  total_pts       integer not null default 0,
  protocol_pts    integer not null default 0,
  stack_pts       integer not null default 0,
  stretch_pts     integer not null default 0,
  protocol_rate   numeric(4,3) not null default 0,
  perfect_days    integer not null default 0,
  stretch_wins    integer not null default 0,
  peak_moment     text,
  forward_line    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(user_id, week_of)
);

alter table public.weekly_scores enable row level security;
create policy "Users view own weekly scores" on public.weekly_scores
  for select using (auth.uid() = user_id);

create index idx_weekly_scores_user on public.weekly_scores(user_id, week_of desc);

-- ─── Templates ────────────────────────────────────────────────────────────
-- Phase 3 — stub table, not used in Phase 1

create type template_source as enum ('user_created', 'memory_generated');

create table public.templates (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  source          template_source not null default 'user_created',
  tasks           jsonb not null default '[]',
  use_count       integer not null default 0,
  avg_completion  numeric(4,3) not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.templates enable row level security;
create policy "Users manage own templates" on public.templates
  using (auth.uid() = user_id);

-- ─── Helper Function: Get today's carry forward ───────────────────────────

create or replace function public.get_carry_forward(p_user_id uuid)
returns text as $$
  select carry_forward
  from public.standup_sessions
  where user_id = p_user_id
    and session_type = 'close'
    and date = current_date - interval '1 day'
  order by created_at desc
  limit 1;
$$ language sql security definer;

-- ─── Helper Function: Update protocol completion rates ────────────────────
-- Run nightly or after each day close

create or replace function public.update_completion_rates(p_user_id uuid)
returns void as $$
declare
  item record;
  completion_count integer;
  active_days_count integer;
begin
  for item in
    select id from public.protocol_items
    where user_id = p_user_id and active = true
  loop
    select
      count(*) filter (where completed = true),
      count(*)
    into completion_count, active_days_count
    from public.daily_logs
    where user_id = p_user_id
      and protocol_item_id = item.id
      and date >= current_date - interval '28 days';

    if active_days_count > 0 then
      update public.protocol_items
      set completion_rate = completion_count::numeric / active_days_count
      where id = item.id;
    end if;
  end loop;
end;
$$ language plpgsql security definer;
