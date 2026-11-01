# UI Renewal Phase 6 — Stock picks / analysis chrome

## Scope

Apply light premium surfaces to stock-recommendation routes under Phase 3 opt-in.

| Route | Root class |
|---|---|
| `/stock-picks` | `.yds-spick-page` |
| `/stock-picks/:ticker` | `.yds-spick-detail` |
| `/stock-picks/compare` | `.yds-spick-compare-page` |
| `/stock-picks/ranking` | `.yds-spick-ranking-page` |

| Condition | Result |
|---|---|
| `.app-shell-host.yds-theme-premium` + above roots | White cards, navy text, token borders/filters |
| Without premium | Legacy dark rules in `stock-picks-platform.css` |

## Out of scope

- `/performance-validation/*`, backtest, admin debug (even if they import `stock-picks-platform.css`)
- Panic / DBB / leverage pages
- Score engines, APIs, ranking math, data models
- Dirty tree files unrelated to this phase

## Files

| File | Role |
|---|---|
| `vite-project/src/styles/yds-stock-picks-premium.css` | Scoped light overrides (new) |
| `vite-project/src/main.jsx` | Import after panic premium CSS |
| `docs/UI_RENEWAL_PHASE6_STOCK_PICKS_PREMIUM.md` | This note |

Page JSX was **not** edited. Platform CSS (`stock-picks-platform.css`) left intact.

## Visual coverage

- Page title / kicker / empty & load banners
- Invest dashboard, filter bar, search, hub quick links
- Briefing / regime / signal & list cards
- Rec-status badges (buy/watch/exclude meanings kept; light-bg contrast tuned)
- Detail hero / panels / confidence bars
- Ranking & compare tables, inputs, empty state
- Alert popover chrome
- Chart legend/tooltip text inside these roots
- Mobile padding / filter spacing

## Non-goals

No commit / push / deploy.
