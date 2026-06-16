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
  const verdictIcon =
    card.verdict.tone === "favorable" ? "🟢" : card.verdict.tone === "neutral" ? "🟡" : "🔴"

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
          <div className="liq-env-v3__head">
            <p className="m-0 liq-env-v3__title">
              {verdictIcon} 유동성 환경 : {card.headline}
            </p>
            <span
              className={[
                "liq-env-card__verdict-pill",
                `liq-env-card__verdict-pill--${card.verdict.tone}`,
              ].join(" ")}
            >
              {card.verdict.label}
            </span>
          </div>

          <div className="liq-env-v3__signals" role="note" aria-label="유동성 해석">
            <p className="m-0 liq-env-v3__signal liq-env-v3__signal--core">{card.summary}</p>
            <p className="m-0 liq-env-v3__signal">{card.styleSignal}</p>
            <p className="m-0 liq-env-v3__signal">{card.ratesSignal}</p>
            <p className="m-0 liq-env-v3__signal">{card.volatilitySignal}</p>
            <p className="m-0 liq-env-v3__signal">{card.creditSignal}</p>
          </div>

          <p className="m-0 liq-env-v3__footnote font-mono tabular-nums">
            유동성 점수 {card.score ?? (loading ? "수집 중" : "—")}
          </p>
        </div>
      </div>
    </section>
  )
}
