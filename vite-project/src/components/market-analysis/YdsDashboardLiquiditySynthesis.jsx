import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{ label: string; score: number | null }} props
 */
function LiquidityScoreBar({ label, score }) {
  const value = Math.max(0, Math.min(100, Math.round(score ?? 0)))
  const filled = Math.round(value / 10)

  return (
    <div className="yds-liquidity-scorebar">
      <div className="yds-liquidity-scorebar__head">
        <span className="yds-liquidity-scorebar__label">{label}</span>
        <span className="yds-liquidity-scorebar__value font-mono tabular-nums">
          {value}점
        </span>
      </div>
      <div
        className="yds-liquidity-scorebar__track"
        role="img"
        aria-label={`${label} ${value}점`}
      >
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={[
              "yds-liquidity-scorebar__block",
              index < filled ? "yds-liquidity-scorebar__block--filled" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * @param {{
 *   report: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   className?: string
 * }} props
 */
export default function YdsDashboardLiquiditySynthesis({ report, className = "" }) {
  if (!report?.visible || !report.synthesis) return null

  return (
    <YdsDeskCard
      title="유동성 종합 해석"
      titleId="desk-liquidity-synthesis-title"
      className={className}
    >
      <div className="yds-liquidity-summary yds-liquidity-summary--solo">
        <div className="yds-liquidity-scorebars">
          <LiquidityScoreBar label="시장 유동성" score={report.marketScore} />
          <LiquidityScoreBar label="정책 유동성" score={report.policyScore} />
        </div>
        <p className="yds-liquidity-summary__headline">{report.synthesis.headline}</p>
        <ul className="yds-liquidity-summary__lines">
          {report.synthesis.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </YdsDeskCard>
  )
}
