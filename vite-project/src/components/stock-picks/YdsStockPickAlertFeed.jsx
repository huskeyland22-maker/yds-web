import { Link } from "react-router-dom"
import { PICK_ALERT_TYPES } from "../../content/ydsStockPickAlertStorage.js"

/**
 * @param {{
 *   feed: import("../../content/ydsStockPickAlertStorage.js").PickAlertRecord[]
 *   unread: number
 *   onMarkRead: () => void
 *   onEnableBrowser?: () => void
 *   compact?: boolean
 *   className?: string
 * }} props
 */
export default function YdsStockPickAlertFeed({
  feed,
  unread,
  onMarkRead,
  onEnableBrowser,
  compact = false,
  className = "",
}) {
  const typeLabel = Object.fromEntries(PICK_ALERT_TYPES.map((t) => [t.id, t.label]))

  return (
    <section
      className={["yds-spick-alert-feed", compact ? "yds-spick-alert-feed--compact" : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="AI 추천 알림"
    >
      <div className="yds-spick-alert-feed__head">
        <h2 className="yds-spick-alert-feed__title">
          AI 추천 알림
          {unread > 0 ? <span className="yds-spick-alert-feed__badge">{unread}</span> : null}
        </h2>
        <div className="yds-spick-alert-feed__tools">
          {onEnableBrowser ? (
            <button type="button" className="yds-spick-alert-feed__btn" onClick={onEnableBrowser}>
              브라우저 알림
            </button>
          ) : null}
          {unread > 0 ? (
            <button type="button" className="yds-spick-alert-feed__btn" onClick={onMarkRead}>
              모두 읽음
            </button>
          ) : null}
          <Link to="/stock-picks" className="yds-spick-alert-feed__link">
            종목추천 →
          </Link>
        </div>
      </div>

      {!feed.length ? (
        <p className="yds-spick-alert-feed__empty">
          ★ 관심 등록 종목의 추천·점수·목표가 변화가 여기 표시됩니다.
        </p>
      ) : (
        <ul className="yds-spick-alert-feed__list">
          {feed.slice(0, compact ? 6 : 20).map((item) => (
            <li
              key={item.id}
              className={[
                "yds-spick-alert-feed__item",
                !item.read ? "yds-spick-alert-feed__item--unread" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Link to={`/stock-picks/${item.ticker}`} className="yds-spick-alert-feed__item-link">
                <span className="yds-spick-alert-feed__type">{typeLabel[item.type] ?? item.type}</span>
                <strong>{item.name}</strong>
                <span>{item.message}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
