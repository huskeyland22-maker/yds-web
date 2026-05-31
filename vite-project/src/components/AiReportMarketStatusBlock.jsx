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
      aria-label={`현재 시장: ${status.stageLabel}`}
      style={status.accentColor ? { "--ai-report-accent": status.accentColor } : undefined}
      data-regime={status.regimeId ?? undefined}
    >
      <p className="m-0 ai-report-market-status__headline">{status.headline}</p>
      <p className="m-0 ai-report-market-status__stage">{status.ready ? status.stageLabel : "—"}</p>
      {status.actionLines.length ? (
        <ul className="m-0 ai-report-market-status__actions">
          {status.actionLines.map((line) => (
            <li key={line} className="ai-report-market-status__action">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="m-0 ai-report-market-status__update">{status.updateLine}</p>
      {status.basisLine ? (
        <p className="m-0 ai-report-market-status__basis">{status.basisLine}</p>
      ) : null}
    </div>
  )
}
