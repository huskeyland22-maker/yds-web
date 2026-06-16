import { useMemo } from "react"
import { formatCurrent } from "../../macro-risk/displayMetrics.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { buildLiquidityEnvironmentCard } from "../../market-os/liquidityEnvironment.js"
import { resolveMarketUpdateTime } from "../../utils/marketUpdateTime.js"

const CARD_TITLE = "유동성 환경"

/**
 * @param {string} key
 * @param {number | null} n
 * @param {string} [fmt]
 */
function fmtMetricValue(key, n, fmt = "rate") {
  if (n == null || !Number.isFinite(n)) return "—"
  return formatCurrent(n, fmt)
}

/**
 * @param {{
 *   metric: import("../../market-os/liquidityEnvironment.js").LiquidityMetricV2
 *   loading?: boolean
 * }} props
 */
function LiquidityMetricItem({ metric, loading = false }) {
  return (
    <div className="liq-env-v2__metric">
      <p className="m-0 liq-env-v2__metric-label">{metric.label}</p>
      <p className="m-0 liq-env-v2__metric-value font-mono tabular-nums">
        {metric.value == null && loading ? "수집 중" : metric.display}
      </p>
    </div>
  )
}

/**
 * @param {{
 *   snapshot?: import("../../macro-risk/engine.js").MacroRiskSnapshot | null
 *   panicData?: object | null
 *   loading?: boolean
 *   fetchFailed?: boolean
 *   timedOut?: boolean
 *   error?: string | null
 *   variant?: "default" | "desk"
 * }} props
 */
export default function CycleBondLiquiditySection({
  snapshot = null,
  panicData = null,
  loading = false,
  variant = "default",
}) {
  const enabled = isMacroRiskEnabled()
  const isDesk = variant === "desk"

  const marketUpdateTime = useMemo(() => resolveMarketUpdateTime(panicData), [panicData])

  const card = useMemo(
    () => buildLiquidityEnvironmentCard(snapshot, panicData, fmtMetricValue),
    [snapshot, panicData],
  )

  if (!enabled) return null

  return (
    <section
      id="bond-liquidity"
      className={[
        "cycle-bond-section",
        "cycle-bond-section--reference",
        "cycle-bond-section--always-open",
        "liq-env-section",
        isDesk ? "cycle-bond-section--desk" : "",
        "scroll-mt-24",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={CARD_TITLE}
    >
      <div
        className={[
          "cycle-bond-panel",
          "cycle-bond-panel--compact",
          "cycle-bond-panel--reference",
          "cycle-bond-panel--always-open",
          "liq-env-card",
          isDesk ? "cycle-bond-panel--desk" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {!isDesk ? (
          <header className="cycle-bond-panel__header cycle-bond-panel__header--compact">
            <div className="min-w-0 flex-1">
              <p className="m-0 cycle-bond-panel__title-ref">{CARD_TITLE}</p>
              <div className="mt-0.5">
                <p className="m-0 text-[9px] font-medium text-slate-500">{marketUpdateTime.basisNote}</p>
                <p className="m-0 font-mono text-[10px] font-semibold tabular-nums text-slate-300">
                  {marketUpdateTime.kstLabel ?? "—"}
                </p>
              </div>
            </div>
          </header>
        ) : (
          <p className="m-0 cycle-bond-panel__desk-meta">
            <span className="cycle-bond-panel__desk-meta-note">{marketUpdateTime.basisNote}</span>
            <span className="cycle-bond-panel__desk-meta-time font-mono tabular-nums">
              {marketUpdateTime.kstLabel ?? "—"}
            </span>
          </p>
        )}

        <div className="cycle-bond-panel__body cycle-bond-panel__body--compact liq-env-card__body">
          <div className="liq-env-v2__head">
            <div className="liq-env-v2__score-wrap">
              <p className="m-0 liq-env-v2__score-label">유동성 점수</p>
              <p className="m-0 liq-env-v2__score font-mono tabular-nums">{card.score ?? "—"}</p>
            </div>
            <span
              className={[
                "liq-env-card__verdict-pill",
                `liq-env-card__verdict-pill--${card.verdict.tone}`,
              ].join(" ")}
            >
              {card.verdict.label}
            </span>
          </div>

          <div className="liq-env-v2__metrics">
            {card.metrics.map((metric) => (
              <LiquidityMetricItem key={metric.id} metric={metric} loading={loading} />
            ))}
          </div>

          <p className="m-0 liq-env-card__summary" role="note">
            {card.summary}
          </p>
        </div>
      </div>
    </section>
  )
}
