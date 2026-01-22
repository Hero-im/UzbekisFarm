alter table if exists public.posts
  add column if not exists harvest_date date;
