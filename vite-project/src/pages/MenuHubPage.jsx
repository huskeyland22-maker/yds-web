import { Link } from "react-router-dom"
import { getShellNavHub } from "../content/ydsShellNavConfig.js"

/**
 * 통합 메뉴 허브 — 기존 세부 기능 라우트로만 연결한다.
 * @param {{ hubId: string }} props
 */
const STRATEGY_HUB_IDS = new Set(["buy-strategy", "panic-fear-buy"])

export default function MenuHubPage({ hubId }) {
  const hub = getShellNavHub(hubId)
  const strategyDesk = STRATEGY_HUB_IDS.has(hubId)
  if (!hub) {
    return (
      <div className="yds-menu-hub" role="status">
        <h1 className="yds-menu-hub__title">메뉴를 찾지 못했습니다</h1>
        <p className="yds-menu-hub__sub">사이드바에서 다른 메뉴를 선택해 주세요.</p>
      </div>
    )
  }

  return (
    <div className={["yds-menu-hub", strategyDesk ? "yds-menu-hub--strategy" : null].filter(Boolean).join(" ")}>
      <header className="yds-menu-hub__header">
        <h1 className="yds-menu-hub__title">{hub.title}</h1>
        <p className="yds-menu-hub__sub">{hub.subtitle}</p>
        {hub.notice ? <p className="yds-menu-hub__notice">{hub.notice}</p> : null}
      </header>
      <ul className="yds-menu-hub__list">
        {hub.links.map((link) => (
          <li key={link.id} className="yds-menu-hub__item">
            <Link to={link.path} className="yds-menu-hub__link">
              <span className="yds-menu-hub__link-label">{link.label}</span>
              {link.note ? <span className="yds-menu-hub__link-note">{link.note}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
