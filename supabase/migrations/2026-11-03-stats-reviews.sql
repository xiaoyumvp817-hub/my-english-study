-- 分开统计「学习句数」与「复习答对数」
alter table public.stats add column if not exists total_reviews int not null default 0;
alter table public.stats add column if not exists daily_reviews jsonb not null default '{}';
