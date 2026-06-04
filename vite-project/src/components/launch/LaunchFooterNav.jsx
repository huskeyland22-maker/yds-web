import { Link } from "react-router-dom"
import { LAUNCH_FOOTER_LINKS } from "../../content/ydsLaunchContent.js"

export default function LaunchFooterNav() {
  return (
    <nav className="yds-launch-footer" aria-label="출시 안내">
      <p className="yds-launch-footer__label">YDS V1 Launch</p>
      <ul className="yds-launch-footer__list">
        {LAUNCH_FOOTER_LINKS.map((item) => (
          <li key={item.path}>
            <Link to={item.path}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
