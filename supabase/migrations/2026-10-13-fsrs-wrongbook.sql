-- 错题本 SM-2 → FSRS 迁移（在 Supabase SQL Editor 对已有部署执行一次）。
-- 新增 FSRS 记忆状态三列，并从旧 SM-2 列回填；旧列保留（客户端不再读写）。
alter table public.wrong_entries
  add column if not exists stability double precision not null default 0,
  add column if not exists difficulty double precision not null default 5,
  add column if not exists state int not null default 0;

update public.wrong_entries set
  stability = greatest(1, interval_days),
  difficulty = least(10, greatest(1, round(5 - (ease_factor - 2.5) * 4))),
  state = case when reviews = 0 then 0 else 2 end;
