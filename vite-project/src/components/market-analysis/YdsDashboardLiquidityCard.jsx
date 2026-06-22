import YdsDeskCard from "./YdsDeskCard.jsx"

/** @param {import("../../market-os/liquidityEnvironment.js").LiquidityVerdictId} id */
function deskVerdictLabel(id) {
  if (id === "favorable") return "우호"
  if (id === "alert") return "경계"
  return "중립"
}

/**
 * @param {{
 *   card: import("../../market-os/liquidityEnvironment.js").LiquidityEnvironmentCard | null
 *   loading?: boolean
 * }} props
 */
export default function YdsDashboardLiquidityCard({ card, loading = false }) {
  if (!card) return null

  const score = card.score
  const scorePct = score != null ? Math.max(0, Math.min(100, score)) : 0
  const tone = card.verdict?.tone ?? "neutral"

  const factors = [
    { id: "style", label: "스타일", value: card.styleSignal },
    { id: "rates", label: "금리", value: card.ratesSignal },
    { id: "volatility", label: "변동성", value: card.volatilitySignal },
    { id: "credit", label: "신용", value: card.creditSignal },
  ]

  return (
    <YdsDeskCard title="유동성 환경" titleId="desk-liquidity-title">
      <div className="yds-desk-card__panel yds-desk-card__liquidity-score">
        <div className="yds-desk-card__liquidity-top">
          <p className="yds-desk-card__liquidity-score-val font-mono tabular-nums">
            {score != null ? `${score}점` : loading ? "수집 중" : "—"}
          </p>
          <span
            className={[
              "yds-desk-card__liquidity-badge",
              `yds-desk-card__liquidity-badge--${tone}`,
            ].join(" ")}
          >
            {deskVerdictLabel(card.verdict?.id ?? "neutral")}
          </span>
        </div>

        <div
          className={[
            "yds-desk-card__liquidity-bar",
            `yds-desk-card__liquidity-bar--${tone}`,
          ].join(" ")}
          role="meter"
          aria-label="유동성 점수"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score ?? undefined}
        >
          <span
            className="yds-desk-card__liquidity-bar-fill"
            style={{ width: `${scorePct}%` }}
          />
        </div>
      </div>

      <dl className="yds-desk-card__liquidity-factors">
        {factors.map((factor) => (
          <div key={factor.id} className="yds-desk-card__liquidity-factor">
            <dt>{factor.label}</dt>
            <dd>{factor.value}</dd>
          </div>
        ))}
      </dl>
    </YdsDeskCard>
  )
}
