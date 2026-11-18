import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  SHELL_NAV_MAIN,
  shellNavItemIsActive,
  shellNavMainContainsPath,
} from "../../content/ydsShellNavConfig.js"

/**
 * @param {{ item: import("../../content/ydsShellNavConfig.js").ShellNavItem, onNavigate?: () => void, badge?: number }} props
 */
function NavItem({ item, onNavigate, badge = 0, statusLabel = "" }) {
  const location = useLocation()
  const active = shellNavItemIsActive(item, location)
  const status = typeof statusLabel === "string" ? statusLabel.trim() : ""
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "yds-market-nav__link",
        active ? "is-active" : null,
        item.emphasis ? "is-emphasis" : null,
        status ? "has-status" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{item.label}</span>
      {status ? (
        <span className="yds-market-nav__status" data-testid={`nav-status-${item.id}`}>
          {status}
        </span>
      ) : null}
      {badge > 0 ? <em>{badge}</em> : null}
    </Link>
  )
}

/**
 * @param {{
 *   onNavigate?: () => void
 *   pickAlertUnread?: number
 *   onOpenAccountSettings?: () => void
 *   onOpenInputPanel?: () => void
 *   inputLabel?: string
 *   accountPanel?: import("react").ReactNode
 * }} props
 */
export default function MarketShellNav({
  onNavigate,
  pickAlertUnread = 0,
  onOpenAccountSettings,
  onOpenInputPanel,
  inputLabel = "AI 리포트 입력",
  accountPanel = null,
}) {
  const location = useLocation()
  const strategyMain = SHELL_NAV_MAIN.find((entry) => entry.id === "adjustment-strategy")
  const moreMain = SHELL_NAV_MAIN.find((entry) => entry.id === "more")
  const strategyHasPage = strategyMain ? shellNavMainContainsPath(strategyMain, location) : false
  const moreHasPage = moreMain ? shellNavMainContainsPath(moreMain, location) : false

  const [strategyOpen, setStrategyOpen] = useState(strategyHasPage)
  const [moreOpen, setMoreOpen] = useState(moreHasPage)

  useEffect(() => {
    if (strategyHasPage) setStrategyOpen(true)
  }, [strategyHasPage])

  useEffect(() => {
    if (moreHasPage) setMoreOpen(true)
  }, [moreHasPage])

  const openAccount = () => {
    onNavigate?.()
    onOpenAccountSettings?.()
  }

  return (
    <nav className="yds-market-nav" aria-label="YDS 메뉴">
      {SHELL_NAV_MAIN.map((main) => {
        if (main.kind === "link") {
          return (
            <section key={main.id} className="yds-market-nav__group yds-market-nav__group--main-link">
              <NavItem
                item={{
                  id: main.id,
                  label: main.label,
                  path: main.path,
                  emphasis: main.emphasis,
                  matchPaths: main.matchPaths,
                }}
                statusLabel={main.statusLabel || ""}
                onNavigate={onNavigate}
              />
            </section>
          )
        }

        if (main.kind === "tree") {
          return (
            <section key={main.id} className="yds-market-nav__group">
              <p className="yds-market-nav__main-title">
                <span className="yds-market-nav__kicker">{main.label}</span>
              </p>
              <div className="yds-market-nav__children">
                {(main.items ?? []).map((item) => (
                  <NavItem key={item.id} item={item} onNavigate={onNavigate} />
                ))}
              </div>
            </section>
          )
        }

        if (main.id === "adjustment-strategy") {
          return (
            <details
              key={main.id}
              className="yds-market-nav__group yds-market-nav__accordion yds-market-nav__accordion--strategy"
              open={strategyOpen}
              onToggle={(event) => {
                const next = event.currentTarget.open
                setStrategyOpen((prev) => (prev === next ? prev : next))
              }}
            >
              <summary className="yds-market-nav__kicker">{main.label}</summary>
              <div className="yds-market-nav__accordion-body">
                {(main.sections ?? []).map((section) => (
                  <div key={section.id} className="yds-market-nav__method">
                    <p className="yds-market-nav__method-label">{section.label}</p>
                    <div className="yds-market-nav__children">
                      {section.items.map((item) => (
                        <NavItem key={item.id} item={item} onNavigate={onNavigate} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )
        }

        return (
          <details
            key={main.id}
            className="yds-market-nav__group yds-market-nav__accordion yds-market-nav__accordion--more"
            open={moreOpen}
            onToggle={(event) => {
              const next = event.currentTarget.open
              setMoreOpen((prev) => (prev === next ? prev : next))
            }}
          >
            <summary className="yds-market-nav__kicker">{main.label}</summary>
            <div className="yds-market-nav__accordion-body yds-market-nav__children">
              {(main.items ?? []).map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  onNavigate={onNavigate}
                  badge={item.path === "/stock-picks" ? pickAlertUnread : 0}
                />
              ))}
              {onOpenAccountSettings ? (
                <button type="button" className="yds-market-nav__settings is-emphasis" onClick={openAccount}>
                  계정 설정
                </button>
              ) : null}
              {accountPanel}
              {onOpenInputPanel ? (
                <button
                  type="button"
                  className="yds-sidebar-metric-input-btn"
                  onClick={() => {
                    onNavigate?.()
                    onOpenInputPanel()
                  }}
                >
                  {inputLabel}
                </button>
              ) : null}
            </div>
          </details>
        )
      })}
    </nav>
  )
}
