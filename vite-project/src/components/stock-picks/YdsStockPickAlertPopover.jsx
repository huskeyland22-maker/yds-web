import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { PICK_ALERT_TYPES } from "../../content/ydsStockPickAlertStorage.js"

/**
 * @param {{
 *   feed: import("../../content/ydsStockPickAlertStorage.js").PickAlertRecord[]
 *   unread: number
 *   onMarkRead: () => void
 *   onEnableBrowser?: () => void
 *   className?: string
 * }} props
 */
export default function YdsStockPickAlertPopover({
  feed,
  unread,
  onMarkRead,
  onEnableBrowser,
  className = "",
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const typeLabel = Object.fromEntries(PICK_ALERT_TYPES.map((t) => [t.id, t.label]))

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDoc)
    return () => document.removeEventListener("pointerdown", onDoc)
  }, [open])

  return (
    <div
      ref={rootRef}
      className={["yds-spick-alert-pop", className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className={[
          "yds-spick-alert-pop__trigger",
          unread > 0 ? "yds-spick-alert-pop__trigger--unread" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        🔔 AI 알림
        {unread > 0 ? <span className="yds-spick-alert-pop__badge">{unread}</span> : null}
      </button>

      {open ? (
        <div className="yds-spick-alert-pop__panel" role="dialog" aria-label="AI 추천 알림">
          <div className="yds-spick-alert-pop__panel-head">
            <strong>AI 추천 알림</strong>
            <div className="yds-spick-alert-pop__tools">
              {onEnableBrowser ? (
                <button type="button" className="yds-spick-alert-pop__btn" onClick={onEnableBrowser}>
                  브라우저
                </button>
              ) : null}
              {unread > 0 ? (
                <button type="button" className="yds-spick-alert-pop__btn" onClick={onMarkRead}>
                  읽음
                </button>
              ) : null}
              <Link to="/alert-center#pick-alerts" className="yds-spick-alert-pop__link">
                센터 →
              </Link>
            </div>
          </div>

          {!feed.length ? (
            <p className="yds-spick-alert-pop__empty">최근 변경 없음</p>
          ) : (
            <ul className="yds-spick-alert-pop__list">
              {feed.slice(0, 8).map((item) => (
                <li
                  key={item.id}
                  className={[
                    "yds-spick-alert-pop__item",
                    !item.read ? "yds-spick-alert-pop__item--unread" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Link
                    to={`/stock-picks/${item.ticker}`}
                    className="yds-spick-alert-pop__item-link"
                    onClick={() => setOpen(false)}
                  >
                    <span className="yds-spick-alert-pop__type">
                      {typeLabel[item.type] ?? item.type}
                    </span>
                    <strong>{item.name}</strong>
                    <span>{item.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
