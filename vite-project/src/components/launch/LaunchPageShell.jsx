import { Link } from "react-router-dom"
import LaunchFooterNav from "./LaunchFooterNav.jsx"
import YdsV1ReleaseBadge from "../trust/YdsV1ReleaseBadge.jsx"

/**
 * @param {{ title: string; subtitle?: string; children: import("react").ReactNode }} props
 */
export default function LaunchPageShell({ title, subtitle, children }) {
  return (
    <div className="yds-launch-page min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-launch-page__header">
        <div>
          <YdsV1ReleaseBadge compact />
          <h1 className="yds-launch-page__title">{title}</h1>
          {subtitle ? <p className="yds-launch-page__sub">{subtitle}</p> : null}
        </div>
        <Link to="/market-analysis" className="yds-launch-page__back">
          시장분석
        </Link>
      </header>
      {children}
      <LaunchFooterNav />
    </div>
  )
}
