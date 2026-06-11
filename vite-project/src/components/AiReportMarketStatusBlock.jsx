/**
 * @param {{ status: import("../utils/buildAiReportMarketStatus.js").AiReportMarketStatus; compact?: boolean }} props
 */
export default function AiReportMarketStatusBlock({ status, compact = false }) {
  if (!status) return null

  return (
    <div
      className={["ai-report-market-status", compact ? "ai-report-market-status--compact" : ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={status.memoLines.join(" ")}
    >
      <p className="m-0 ai-report-market-status__title">{status.title}</p>
      {status.memoLines.length ? (
        <div className="ai-report-market-status__memo">
          {status.memoLines.map((line) => (
            <p key={line} className="m-0 ai-report-market-status__memo-line">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <p className="m-0 ai-report-market-status__update">{status.updateLine}</p>
      {status.basisLine ? (
        <p className="m-0 ai-report-market-status__basis">{status.basisLine}</p>
      ) : null}
    </div>
  )
}
