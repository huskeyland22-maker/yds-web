# UI Renewal Phase 8 — Performance / research / lab chrome

## Scope

Apply light premium surfaces to performance, validation, backtest, and research routes under Phase 3 opt-in. Main `/market-analysis` chrome stays Phase 5; this phase covers related lab/calendar strip + research pages.

| Route | Root class |
|---|---|
| `/performance-center` | `.yds-perf-center` |
| `/performance-validation` | `.yds-perf-val` |
| `/performance-validation/dashboard` | `.yds-ai-dashboard` |
| `/performance-validation/track-record` | `.yds-track-record-page` |
| `/performance-validation/picks` | `.yds-spick-validation-page` |
| `/performance-validation/pick/:pickId` | `.yds-spick-validation-page` |
| `/performance-validation/backtest` | `.yds-spick-backtest-page` |
| `/panic-lab` | `.yds-panic-lab` |
| `/lab` | `.panic-validation-page` |
| `/investment-playbook` | `.yds-playbook` |
| `/investment-calendar` | `.yds-inv-cal--page` |
| `/market-analysis` (strip only) | `.yds-market-analysis .yds-inv-cal--strip` |

| Condition | Result |
|---|---|
| `.app-shell-host.yds-theme-premium` + above roots | White cards, navy text, token borders/shadows |
| Without premium | Legacy dark rules in `index.css` / `stock-picks-platform.css` |

## Out of scope

- Score / backtest / EV / allocation math
- APIs, localStorage sync, recommendation engines
- Admin / debug / unmounted research pages (U-*)
- Dirty tree files unrelated to this phase
- Full rewrite of Phase 5 panic page (only calendar strip add-on)

## Files

| File | Role |
|---|---|
| `vite-project/src/styles/yds-research-premium.css` | Scoped light overrides (new) |
| `vite-project/src/main.jsx` | Import after hub premium CSS |
| `docs/UI_RENEWAL_PHASE8_RESEARCH_PREMIUM.md` | This note |

Page JSX was **not** edited. Legacy CSS left intact.

## Visual coverage

- Titles / kickers / links / empty states
- KPI / stat cards, tables, filters / period chips
- Lab panels, VS metrics, year tables, histogram chrome
- Playbook cards / compliance / allocation
- Calendar page sections + impact badges
- Mobile padding and horizontal table overflow

## Non-goals

No commit / push / deploy.
No data / calc / API / sync changes.
