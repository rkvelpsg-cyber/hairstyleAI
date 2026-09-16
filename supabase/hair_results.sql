create table if not exists public.hair_results (
  result_token text primary key,
  storage_path text not null,
  style_label text,
  color_label text,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired'))
);

create index if not exists hair_results_expires_at_idx on public.hair_results (expires_at);

-- Run this periodically with a scheduled Edge Function or Supabase cron.
-- Storage objects should be deleted before their matching rows are removed.
