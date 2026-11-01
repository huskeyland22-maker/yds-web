# UI Renewal Phase 4 — ETF / Equity DBB page chrome

## Scope

Apply light premium surfaces to **ETF DBB** (`/daily-bottom-buy`, `.yds-dbb--dashboard`) and **Equity DBB** (`/equity-daily-bottom-buy`, `.yds-dbb--equity-dash`) under the Phase 3 opt-in.

| Condition | Result |
|---|---|
| `.app-shell-host.yds-theme-premium .yds-dbb` | Light cards, navy text, token borders/shadows |
| Without `.yds-theme-premium` | Legacy dark `.yds-dbb` rules in `index.css` unchanged |

## Out of scope

- Panic / leverage / other routes
- Signal meanings and green/red/caution hues (locked to `--yds-signal-*`)
- Copy, calc, API, data model, routes, menus
- Global `html` / `body`
- Merging ETF and Equity page components

## Files

| File | Role |
|---|---|
| `vite-project/src/styles/yds-dbb-premium.css` | Scoped DBB light overrides (new) |
| `vite-project/src/main.jsx` | Import after shell premium CSS |
| `docs/UI_RENEWAL_PHASE4_DBB_PREMIUM.md` | This note |

Page JSX (`DailyBottomBuyPage`, `EquityDailyBottomBuyPage`) was **not** edited.

## Visual coverage

- Hero / title / lead / notice / meta / loading & error status
- Cards, strong/primary/watch borders, research fold & tables
- Candidate cards (incl. Tailwind `bg-slate-950` / `text-slate-*` overrides)
- Picker, research list, all-row list, selection states
- Score, 4 conditions, holdings, trade status, trade-record form (inside `.yds-dbb` only)

## Non-goals

No commit / push / deploy.
