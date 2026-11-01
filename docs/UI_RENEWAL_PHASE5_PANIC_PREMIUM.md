# UI Renewal Phase 5 — Panic / fear page chrome

## Scope

Apply light premium surfaces to **`/market-analysis`** (root `.yds-market-analysis`) under the Phase 3 opt-in.

| Condition | Result |
|---|---|
| `.app-shell-host.yds-theme-premium .yds-market-analysis` | Navy titles/score, white elevated chrome, readable drivers/fear scale/trade |
| Without `.yds-theme-premium` | Legacy dark panic CSS in `index.css` unchanged |

## Out of scope

- Panic Lab (`/panic-lab`), DBB, leverage, other routes
- Score formula, thresholds, collectors, cron, API, store logic
- Dirty files (`panicStore.js`, `YdsMarketAnalysisReferenceFold.jsx`, etc.)
- Global `html` / `body`

## Files

| File | Role |
|---|---|
| `vite-project/src/styles/yds-panic-premium.css` | Scoped panic light overrides (new) |
| `vite-project/src/main.jsx` | Import after DBB premium CSS |
| `docs/UI_RENEWAL_PHASE5_PANIC_PREMIUM.md` | This note |

Page JSX was **not** edited. Stage band colors keep inline `style={{ color: status.color }}`.

## Visual coverage

- Header title / subtitle / ops meta
- Panic Index score, stage label, DCA band, gauge marker
- Fear Scale stages + current badge
- History heading, chips, reset, tooltip, legend text
- Drivers table / mobile driver cards (sources & values)
- Trade record panel chrome (inside this page only)
- Mobile spacing / fear-stage wrap

## Non-goals

No commit / push / deploy.
