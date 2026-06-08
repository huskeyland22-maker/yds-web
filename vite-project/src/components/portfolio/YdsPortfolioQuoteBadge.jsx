import { formatQuoteUpdatedAt, quoteStatusLabel } from "../../content/ydsPortfolioQuoteTypes.js"

/**
 * @param {{
 *   status: import("../../content/ydsPortfolioQuoteTypes.js").PortfolioQuoteStatus | null
 *   stale?: boolean
 *   updatedAt?: string | null
 *   compact?: boolean
 * }} props
 */
export default function YdsPortfolioQuoteBadge({ status, stale = false, updatedAt, compact }) {
  if (!status) return null

  const label = quoteStatusLabel(status, stale)
  const className = [
    "yds-portfolio-v6__quote-badge",
    status === "live" ? "yds-portfolio-v6__quote-badge--live" : "",
    status === "delayed" || stale ? "yds-portfolio-v6__quote-badge--delayed" : "",
    status === "error" ? "yds-portfolio-v6__quote-badge--error" : "",
  ]
    .filter(Boolean)
    .join(" ")

  if (compact) {
    return <span className={className}>{label}</span>
  }

  return (
    <span className="yds-portfolio-v6__quote-meta">
      <span className={className}>{label}</span>
      {updatedAt ? (
        <span className="yds-portfolio-v6__quote-time font-mono tabular-nums">
          {formatQuoteUpdatedAt(updatedAt)}
        </span>
      ) : null}
    </span>
  )
}
