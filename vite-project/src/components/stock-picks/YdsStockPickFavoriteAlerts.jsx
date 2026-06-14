import { Link } from "react-router-dom"

/**
 * @param {{
 *   alerts: import("../../hooks/useStockPickFavoriteAlerts.js").FavoriteAlert[]
 * }} props
 */
export default function YdsStockPickFavoriteAlerts({ alerts = [] }) {
  if (!alerts.length) return null

  return (
    <section className="yds-spick-fav-alerts" aria-label="관심종목 알림">
      <h2 className="yds-spick-fav-alerts__title">관심종목 알림</h2>
      <ul className="yds-spick-fav-alerts__list">
        {alerts.map((alert) => (
          <li key={`${alert.ticker}-${alert.type}`} className="yds-spick-fav-alerts__item">
            <Link to={`/stock-picks/${encodeURIComponent(alert.ticker)}`} className="yds-spick-fav-alerts__link">
              <strong>{alert.name}</strong> — {alert.message}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
