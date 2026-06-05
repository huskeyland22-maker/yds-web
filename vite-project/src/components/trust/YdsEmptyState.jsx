import { Link } from "react-router-dom"

/**
 * @param {{
 *   title: string
 *   description: string
 *   primaryTo?: string
 *   primaryLabel?: string
 *   secondaryTo?: string
 *   secondaryLabel?: string
 *   icon?: string
 *   className?: string
 * }} props
 */
export default function YdsEmptyState({
  title,
  description,
  primaryTo,
  primaryLabel = "시장분석 보기",
  secondaryTo,
  secondaryLabel,
  icon = "📭",
  className = "",
}) {
  return (
    <section
      className={`yds-empty-state${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="yds-empty-state__icon" aria-hidden>
        {icon}
      </span>
      <h2 className="yds-empty-state__title">{title}</h2>
      <p className="yds-empty-state__desc">{description}</p>
      {(primaryTo || secondaryTo) && (
        <div className="yds-empty-state__actions">
          {primaryTo ? (
            <Link to={primaryTo} className="yds-empty-state__btn yds-empty-state__btn--primary">
              {primaryLabel}
            </Link>
          ) : null}
          {secondaryTo ? (
            <Link to={secondaryTo} className="yds-empty-state__btn">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  )
}
