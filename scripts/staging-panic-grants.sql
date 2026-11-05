-- Staging ONLY (qzunuksxwwzusyivaznx) — never run against Production (oausvweyocgynjpeguka).
-- Fix Preview 403: tables exist but PostgREST service_role lacks GRANT privileges.
-- Safe: GRANT / RLS enable / policy recreate only. No DROP TABLE, TRUNCATE, DELETE, or data overwrite.

-- Table privileges for API (Vercel uses service_role) + public read roles
grant select, insert, update, delete on table public.panic_metrics to anon, authenticated, service_role;
grant select, insert, update, delete on table public.panic_index_history to anon, authenticated, service_role;
grant select, insert, update, delete on table public.latest_panic_metrics to anon, authenticated, service_role;

-- Ensure RLS stays on (idempotent)
alter table public.panic_metrics enable row level security;
alter table public.panic_index_history enable row level security;
alter table public.latest_panic_metrics enable row level security;

-- Read policies for anon/authenticated (service_role bypasses RLS after GRANT)
drop policy if exists "panic_metrics_select_public" on public.panic_metrics;
create policy "panic_metrics_select_public"
  on public.panic_metrics for select to anon, authenticated using (true);

drop policy if exists "panic_index_history_select_public" on public.panic_index_history;
create policy "panic_index_history_select_public"
  on public.panic_index_history for select to anon, authenticated using (true);

drop policy if exists "latest_panic_metrics_select_public" on public.latest_panic_metrics;
create policy "latest_panic_metrics_select_public"
  on public.latest_panic_metrics for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
