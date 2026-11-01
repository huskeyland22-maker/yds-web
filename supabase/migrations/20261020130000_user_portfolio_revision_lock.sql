-- Phase B — portfolio optimistic locking notes (no destructive schema change).
-- Apply manually when ready; this migration does NOT rewrite existing rows.
--
-- `revision` remains bigint. Clients send `baseRevision` on PUT.
-- API increments revision only on successful write (create → 1, update → N+1).
-- Concurrent updates use PATCH ...&revision=eq.{baseRevision}.
-- Concurrent creates use INSERT without upsert; duplicate PK → 409.

comment on column public.user_portfolio.revision is
  'Monotonic sync version for optimistic locking. Client PUT sends baseRevision; server increments only on success.';
