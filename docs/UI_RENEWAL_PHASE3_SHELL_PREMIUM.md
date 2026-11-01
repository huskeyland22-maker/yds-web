# UI Renewal Phase 3 — Common shell light premium theme

## Scope

Apply Phase 2 `--yds-*` tokens to **common app shell chrome only** via opt-in class `yds-theme-premium` on `.app-shell-host`.

- In scope: shell background, sidebar, desktop topbar, mobile header, bottom nav, drawer, shell borders/elevated chrome.
- Out of scope: page domains (`.yds-dbb`, panic page cards), signal colors, routes, features, global `html`/`body` color force.

## Opt-in contract

| Condition | Result |
|---|---|
| `.app-shell-host.yds-theme-premium` | Light premium shell (gray bg, white sidebar/header, navy text, blue accent) |
| `.app-shell-host` without premium | Legacy terminal shell colors via `--yds-legacy-terminal-*` |

Current app mounts premium on the shell host in `App.jsx`. Removing `yds-theme-premium` restores the legacy shell look without other code changes.

## Files

| File | Role |
|---|---|
| `vite-project/src/styles/yds-shell-premium.css` | Default + premium shell rules (new) |
| `vite-project/src/main.jsx` | Import shell CSS **after** `index.css` so hooks beat Tailwind utilities |
| `vite-project/src/App.jsx` | Add `yds-theme-premium`; remove hard-coded shell `bg-[#0B0E14]`; hook `yds-desktop-topbar` |
| `vite-project/src/components/layout/AppSidebar.jsx` | Hook `yds-sidebar`; drop hard-coded shell bg |
| `vite-project/src/components/layout/MobileAppHeader.jsx` | Hook `yds-mobile-app-header` |
| `vite-project/src/components/layout/MobileBottomNav.jsx` | Hook `yds-mobile-bottom-nav` |
| `vite-project/src/components/layout/MobileDrawer.jsx` | Hook `yds-mobile-drawer` |

Phase 2 tokens (`yds-design-tokens.css`) remain the color source for premium rules.

## Non-goals (this phase)

- No commit / push / deploy
- No route or menu structure changes
- No DBB / panic / leverage page restyle
- No calculation, API, storage, or sync changes

## Known follow-up (Phase 4+)

Shell light + legacy dark page cards can leave low-contrast page titles on light canvas until page chrome is migrated per domain. That is intentional for Phase 3 isolation.
