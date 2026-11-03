-- 错题本增加音标（IPA）字段：单词条目有音标、短语子词为空。
alter table public.wrong_entries add column if not exists phonetic text;
