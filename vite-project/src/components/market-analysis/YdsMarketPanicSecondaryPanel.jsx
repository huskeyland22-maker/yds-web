import { useMemo } from "react"
import { MARKET_LABEL_PANIC_INTENSITY } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"
import { buildPanicIntensityComparison, formatPanicCompareDelta } from "../../content/ydsPanicIntensityComparison.js"
import { resolvePanicStateLabel, resolvePanicCompositeActionView } from "../../content/ydsPanicCompositeVerdict.js"
import { buildPanicEvidenceReport } from "../../content/ydsPanicEvidenceEngine.js"
import YdsPanicScoreComposition from "./YdsPanicScoreComposition.jsx"
import YdsPanicCompositeVerdict from "./YdsPanicCompositeVerdict.jsx"

/** @param {number} score */
function resolvePanicAccentTier(score) {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 40) return "mid"
  if (score >= 20) return "warm"
  return "overheat"
}

/**
 * V7 — 패닉 강도 보조 카드
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number>; asOfDate?: string | null } | null
 *   className?: string
 *   embedded?: boolean
 * }} props
 */
export default function YdsMarketPanicSecondaryPanel({
  panicData = null,
  historyRows = [],
  etfContext = null,
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => resolveMarketStateCenterView(panicData), [panicData])
  const stateLabel = useMemo(
    () => (view?.panicScore != null ? resolvePanicStateLabel(view.panicScore) : null),
    [view?.panicScore],
  )
  const compositeAction = useMemo(
    () =>
      resolvePanicCompositeActionView(panicData, {
        spyPrices: etfContext?.spyPrices,
        qqqPrices: etfContext?.qqqPrices,
        asOfDate: etfContext?.asOfDate ?? null,
      }),
    [panicData, etfContext],
  )
  const evidence = useMemo(() => buildPanicEvidenceReport(panicData), [panicData])
  const comparison = useMemo(
    () => buildPanicIntensityComparison(historyRows, panicData),
    [historyRows, panicData],
  )

  if (!view || view.panicScore == null || !stateLabel) return null

  const accentTier = resolvePanicAccentTier(view.panicScore)

  const card = (
    <div
      className={[
        "yds-market-panic-secondary",
        "yds-market-panic-secondary--v7",
        "yds-market-panic-secondary--interpret",
        `yds-market-panic-secondary--accent-${accentTier}`,
      ].join(" ")}
    >
      <p className="yds-market-panic-secondary__title">{MARKET_LABEL_PANIC_INTENSITY}</p>

      <div className="yds-market-panic-secondary__body">
        <p className="yds-market-panic-secondary__score font-mono tabular-nums">
          {view.panicScore}
        </p>

        <div className="yds-market-panic-secondary__stage" aria-label="패닉 심리 상태">
          <p className="yds-market-panic-secondary__stage-current yds-market-panic-secondary__state-only">
            {stateLabel}
          </p>
        </div>

        {compositeAction ? (
          <div className="yds-market-panic-secondary__action" aria-label="최종 투자 해석">
            <p className="yds-market-panic-secondary__buy-strength">{compositeAction.buyStrength}</p>
            <p className="yds-market-panic-secondary__action-line">{compositeAction.actionLine}</p>
            <p className="yds-market-panic-secondary__action-note">최종 투자 해석 · 가격·추세 반영</p>
          </div>
        ) : null}

        {evidence.briefChips.length ? (
          <ul className="yds-market-panic-secondary__evidence-chips" aria-label="근거 요약">
            {evidence.briefChips.map((chip) => (
              <li key={chip.id} className="yds-market-panic-secondary__evidence-chip">
                {chip.text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {comparison.visible ? (
        <div className="yds-market-panic-secondary__compare" aria-label="패닉 강도 최근 변화">
          {comparison.points.map((point) => (
            <div key={point.label} className="yds-market-panic-secondary__compare-row">
              <span className="yds-market-panic-secondary__compare-key">{point.label}</span>
              <strong className="yds-market-panic-secondary__compare-val font-mono tabular-nums">
                {point.score ?? "—"}
                {point.delta != null ? (
                  <span className="yds-market-panic-secondary__compare-delta">
                    {" "}
                    {formatPanicCompareDelta(point.delta)}
                  </span>
                ) : null}
              </strong>
            </div>
          ))}
          <p className="yds-market-panic-secondary__compare-conclusion">{comparison.conclusion}</p>
          {comparison.subConclusion ? (
            <p className="yds-market-panic-secondary__compare-sub">{comparison.subConclusion}</p>
          ) : null}
        </div>
      ) : null}

      <YdsPanicScoreComposition panicData={panicData} className="yds-market-panic-secondary__composition" />

      <YdsPanicCompositeVerdict
        panicData={panicData}
        etfContext={etfContext}
        className="yds-market-panic-secondary__composite"
      />
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-panic-secondary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
