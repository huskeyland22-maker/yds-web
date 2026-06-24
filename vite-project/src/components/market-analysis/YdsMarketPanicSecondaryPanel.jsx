import { useMemo } from "react"
import { MARKET_LABEL_PANIC_INTENSITY } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"
import { buildPanicIntensityComparison } from "../../content/ydsPanicIntensityComparison.js"
import { buildPanicIntensityInterpretation } from "../../content/ydsPanicIntensityInterpretation.js"
import { buildPanicEvidenceReport } from "../../content/ydsPanicEvidenceEngine.js"

/** @param {number} score */
function resolvePanicAccentTier(score) {
  if (score >= 81) return "critical"
  if (score >= 61) return "high"
  if (score >= 41) return "mid"
  return "low"
}

/**
 * V7 — 패닉 강도 보조 카드 (축소)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketPanicSecondaryPanel({
  panicData = null,
  historyRows = [],
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => resolveMarketStateCenterView(panicData), [panicData])
  const interpretation = useMemo(
    () => (view?.panicScore != null ? buildPanicIntensityInterpretation(view.panicScore) : null),
    [view?.panicScore],
  )
  const evidence = useMemo(() => buildPanicEvidenceReport(panicData), [panicData])
  const comparison = useMemo(
    () => buildPanicIntensityComparison(historyRows, panicData),
    [historyRows, panicData],
  )

  if (!view || view.panicScore == null || !interpretation) return null

  const accentTier = resolvePanicAccentTier(view.panicScore)
  const statusLabel = interpretation.label

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
        <p className="yds-market-panic-secondary__level">{statusLabel}</p>

        <div className="yds-market-panic-secondary__interpret">
          <p className="yds-market-panic-secondary__interpret-label">시장 해석</p>
          <ul className="yds-market-panic-secondary__interpret-list">
            {interpretation.interpretationLines.map((line) => (
              <li key={line} className="yds-market-panic-secondary__interpret-line">
                {line}
              </li>
            ))}
          </ul>
        </div>

        {interpretation.actionGuide ? (
          <div className="yds-market-panic-secondary__action">
            <p className="yds-market-panic-secondary__action-label">행동 가이드</p>
            <p className="yds-market-panic-secondary__action-line">{interpretation.actionGuide}</p>
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
        <div className="yds-market-panic-secondary__compare" aria-label="패닉 강도 과거 비교">
          <div className="yds-market-panic-secondary__compare-row">
            <span className="yds-market-panic-secondary__compare-key">오늘</span>
            <strong className="yds-market-panic-secondary__compare-val font-mono tabular-nums">
              {comparison.today ?? "—"}
            </strong>
          </div>
          <div className="yds-market-panic-secondary__compare-row">
            <span className="yds-market-panic-secondary__compare-key">1주전</span>
            <strong className="yds-market-panic-secondary__compare-val font-mono tabular-nums">
              {comparison.weekAgo ?? "—"}
            </strong>
          </div>
          <div className="yds-market-panic-secondary__compare-row">
            <span className="yds-market-panic-secondary__compare-key">1개월전</span>
            <strong className="yds-market-panic-secondary__compare-val font-mono tabular-nums">
              {comparison.monthAgo ?? "—"}
            </strong>
          </div>
          <p className="yds-market-panic-secondary__compare-conclusion">{comparison.conclusion}</p>
          {comparison.subConclusion ? (
            <p className="yds-market-panic-secondary__compare-sub">{comparison.subConclusion}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-panic-secondary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
