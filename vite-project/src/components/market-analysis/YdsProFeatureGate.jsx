import { PANIC_PRO_LOCK_COPY } from "../../content/ydsMarketAnalysisProGate.js"

/**
 * Show children only when PRO; otherwise a compact lock panel.
 * @param {{
 *   unlocked: boolean
 *   children: import("react").ReactNode
 *   title?: string
 *   body?: string
 *   className?: string
 * }} props
 */
export default function YdsProFeatureGate({
  unlocked,
  children,
  title = PANIC_PRO_LOCK_COPY.title,
  body = PANIC_PRO_LOCK_COPY.body,
  className = "",
}) {
  if (unlocked) return children

  return (
    <div
      className={["yds-pro-gate", className].filter(Boolean).join(" ")}
      role="status"
      aria-label={title}
    >
      <p className="yds-pro-gate__title">🔒 {title}</p>
      <p className="yds-pro-gate__body">{body}</p>
    </div>
  )
}
