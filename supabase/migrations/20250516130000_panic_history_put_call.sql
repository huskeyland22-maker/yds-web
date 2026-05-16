-- Optional put/call on daily history (live value also in panic_metrics.putCall)
alter table public.panic_index_history add column if not exists put_call double precision;
