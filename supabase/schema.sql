-- 账号 + 好友 + PK + 排行榜 —— 建表与 RLS
-- 在 Supabase SQL Editor 一次性执行。
create extension if not exists pgcrypto;

-- ===== Phase 1: 账号与同步（login-sync spec） =====

create table public.templates (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at bigint not null,
  items jsonb not null,
  warnings jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.wrong_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  en text not null,
  zh text not null,
  word text not null,
  word_index int not null,
  added_at bigint not null,
  repetition int not null,
  interval_days int not null,
  ease_factor double precision not null,
  due_at bigint not null,
  reviews int not null,
  lapses int not null,
  last_review_at bigint not null,
  unique (user_id, key)
);

create table public.stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp int not null default 0,
  streak_days int not null default 0,
  total_learned int not null default 0,
  last_study_date text not null default '',
  daily_history jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.learned (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table public.motivation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_per_day int not null default 5,
  makeup_cards int not null default 0,
  awarded_milestones int not null default 0,
  seen_achievements jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ===== Phase 2: 社交层（friends spec） =====

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  friend_code text not null unique,
  total_learned int not null default 0,
  created_at timestamptz not null default now()
);

-- 规范单行模型（修正 spec §4.2 的双向两行 + RLS 插入缺陷）
create table public.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  challengee_id uuid not null references auth.users(id) on delete cascade,
  words jsonb not null,
  challenger_score int not null,
  challenger_duration_ms int not null,
  challengee_score int null,
  challengee_duration_ms int null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

-- ===== RLS =====

alter table public.templates enable row level security;
alter table public.wrong_entries enable row level security;
alter table public.stats enable row level security;
alter table public.learned enable row level security;
alter table public.motivation enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.challenges enable row level security;

-- 自有数据：本人独占
create policy "own templates" on public.templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own wrong_entries" on public.wrong_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own stats" on public.stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own learned" on public.learned for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own motivation" on public.motivation for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles：本人可读写，他人只读（仅 display_name/friend_code/total_learned 公开，无邮箱列）
create policy "own profile" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public profile read" on public.profiles for select using (true);

-- friendships：任一侧可读写
create policy "friendships either side" on public.friendships
  for all using (auth.uid() in (user_a, user_b)) with check (auth.uid() in (user_a, user_b));

-- challenges：仅对战双方
create policy "participant challenges" on public.challenges
  for all using (auth.uid() in (challenger_id, challengee_id))
  with check (auth.uid() in (challenger_id, challengee_id));

-- ===== 排行榜冗余列自动同步 =====
-- profiles.total_learned 由 stats.total_learned 触发器维护（服务端权威，避免客户端漏推）。
-- security definer 绕过 RLS；客户端 pushStats 后排行榜自动正确。
create or replace function public.sync_profile_total_learned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set total_learned = new.total_learned where user_id = new.user_id;
  return new;
end;
$$;

create trigger stats_total_learned_sync
after insert or update of total_learned on public.stats
for each row execute function public.sync_profile_total_learned();
