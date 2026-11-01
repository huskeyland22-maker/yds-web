# UI Renewal Phase 7 — Portfolio / Watchlist / Alert chrome

## Scope

Apply light premium surfaces to hub personalization routes under Phase 3 opt-in.

| Route | Root class |
|---|---|
| `/portfolio` | `.yds-pf-v1-page` (+ `.yds-pf-v1`) |
| `/watchlist` | `.yds-user-watchlist` |
| `/alert-center` | `.yds-alert-center` (excludes `.yds-alert-center--lab`) |

| Condition | Result |
|---|---|
| `.app-shell-host.yds-theme-premium` + above roots | White cards, navy text, token borders/shadows |
| Without premium | Legacy dark rules in `index.css` |

## Out of scope

- Holdings CRUD / P&L calc / cash ledger logic
- Watchlist register/unregister / score engines
- Alert create / read / filter / sync APIs
- Lab embeds using `.yds-alert-center--lab`
- Dirty tree files unrelated to this phase

## Files

| File | Role |
|---|---|
| `vite-project/src/styles/yds-hub-premium.css` | Scoped light overrides (new) |
| `vite-project/src/main.jsx` | Import after stock-picks premium CSS |
| `docs/UI_RENEWAL_PHASE7_HUB_PREMIUM.md` | This note |

Page JSX was **not** edited. Legacy rules in `index.css` left intact.

## Visual coverage

- Page title / kicker / sub / foot
- Portfolio blocks, metrics, holdings rows, form inputs & buttons
- Alloc table / badges / posture (signal hues preserved)
- Watchlist cards, position badges, score / delta, dash blocks, alerts list
- Alert sections, grade chips, rows, stock/market lists, days chips
- Empty / muted / footnotes text contrast
- Mobile padding and horizontal overflow for tables/lists

## Non-goals

No commit / push / deploy.
No data / calc / API / sync changes.
