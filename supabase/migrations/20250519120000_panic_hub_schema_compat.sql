-- Production schema compat: columns used by POST /api/panic/update
alter table public.panic_metrics add column if not exists market text not null default 'global';
alter table public.panic_index_history add column if not exists put_call double precision;
alter table public.panic_index_history add column if not exists high_yield double precision;
alter table public.panic_index_history add column if not exists gs_bb double precision;
alter table public.panic_index_history add column if not exists market text not null default 'global';
