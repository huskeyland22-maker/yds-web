-- panic_index_history: API/차트 필드명 정합 (high_yield, gs_bb)
alter table public.panic_index_history add column if not exists high_yield double precision;
alter table public.panic_index_history add column if not exists gs_bb double precision;

update public.panic_index_history
set
  high_yield = coalesce(high_yield, hy_oas),
  gs_bb = coalesce(gs_bb, gs_sentiment)
where high_yield is null or gs_bb is null;
