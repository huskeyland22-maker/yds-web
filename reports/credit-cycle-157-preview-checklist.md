# Credit Cycle Preview Readiness — Task 157

## Scope
155 UI + 156 CORE8/Liquidity wiring + 157 freshness/history/interpretation.

## Preview build
- [ ] `cd vite-project && npm run build` succeeds
- [ ] Optional RC: `VITE_APP_RELEASE_CHANNEL=rc npm run build`

## Environment
- [ ] No new Production secrets required for CORE Board public snapshot path
- [ ] NY Fed SOFR/ON RRP live fetch is browser-side; snapshot fallback present
- [ ] Do not put API keys into public snapshots

## Public API / static surface
- [ ] `/credit-cycle/core-r-core-snapshot.json` — VERIFIED_PRODUCT_FEED tip
- [ ] `/credit-cycle/core-domain-history.json` — NON_STRICT_PIT domain history
- [ ] `/credit-cycle/liquidity-environment-snapshot.json` — RIGHTS_CONDITIONAL
- [ ] `/credit-cycle/core-history/index.json` — product tip history index
- [ ] `/api/credit-cycle-core?mode=core-latest` — PUBLIC read-only when server present

## Cache / fallback
- [ ] API failure → public CORE snapshot preserved
- [ ] NY Fed failure → liquidity snapshot preserved
- [ ] Null domains / insufficient liquidity → no zero-fill

## Rights / attribution
- [ ] SOFR/ON RRP show RIGHTS_CONDITIONAL + NY Fed attribution
- [ ] Board CORE features show RIGHTS_PASS (public Board)
- [ ] Do not claim STRICT_PIT

## Preview vs Production
- Preview: Vite static + optional local API; Board/NY Fed client fetches
- Production: same public JSON contracts; no Soft State / Panic merge; λ=0
- Production DB / Firebase Claims: **unchanged** (out of scope)

## Smoke
- [ ] Desktop `/credit-cycle` overview + detail + history + risk
- [ ] Mobile 390×844 layout
- [ ] CORE obs date ≠ SOFR obs date visible
- [ ] R_core history chart when n≥2
- [ ] Liquidity interpretation guide visible

## Deploy gate
- User explicit approval required for Commit / Push / Deploy
- Production deploy is a separate approval after Preview
