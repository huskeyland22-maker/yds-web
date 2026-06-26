import { useMemo } from "react"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { buildStockPickScoreDetail } from "../../content/ydsStockPickScoreDetailEngine.js"
import { PHASE3_QUALITY_MAX } from "../../content/ydsStockPickPhase3Breakdown.js"
import { TIMING_SCORE_MAX } from "../../content/ydsStockPickTimingScore.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   className?: string
 * }} props
 */
export default function YdsStockPickScoreBreakdown({ stock, className = "" }) {
  const marketContext = useYdsMarketContext()
  const detail = useMemo(
    () => buildStockPickScoreDetail(stock, marketContext?.ready ? marketContext : null),
    [stock, marketContext],
  )

  const b = stock.scoreBreakdown ?? {}
  const rows = [
    {
      id: "market-fit",
      label: `시장적합 ${stock.pickMeta?.marketFitScore ?? b.marketEnv ?? 0}점`,
      max: 15,
      positives: detail.marketFitItems.map((i) => i.label + (i.sub ? ` (${i.sub})` : "")),
      negatives: [],
    },
    {
      id: "industry",
      label: `산업모멘텀 ${b.industry ?? 0}/${25}`,
      max: 25,
      positives: stock.sectorLabel ? [`${stock.sectorLabel} 섹터`] : [],
      negatives: [],
    },
    {
      id: "performance",
      label: `실적품질 ${b.performance ?? 0}/${30}`,
      max: 30,
      positives: detail.qualityItems.filter((i) => i.points >= i.max * 0.5).map((i) => i.label),
      negatives: detail.qualityItems.filter((i) => i.points < i.max * 0.4).map((i) => i.label),
    },
    {
      id: "timing",
      label: `타이밍 ${stock.v4Score?.timing ?? b.timing ?? 0}/${TIMING_SCORE_MAX}`,
      max: TIMING_SCORE_MAX,
      positives: detail.timingItems.filter((i) => i.points >= 6).map((i) => i.label),
      negatives: detail.excludeReasons.slice(0, 3),
    },
    {
      id: "quality",
      label: `기업품질 ${stock.v4Score?.quality ?? b.quality ?? 0}/${PHASE3_QUALITY_MAX}`,
      max: PHASE3_QUALITY_MAX,
      positives: (stock.recommendRationales ?? []).map((r) => r.text).slice(0, 4),
      negatives: detail.excludeReasons,
    },
  ]

  if (marketContext?.ready && marketContext.ydsScore != null) {
    rows[0].positives.push(`패닉 ${marketContext.ydsScore}`)
    rows[0].positives.push(
      marketContext.unifiedMarketStateLabel
        ? `현재 ${marketContext.unifiedMarketStateLabel}`
        : "현재 시장상태 반영",
    )
  }

  return (
    <div className={["yds-spick-score-breakdown", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <details key={row.id} className="yds-spick-score-breakdown__block">
          <summary className="yds-spick-score-breakdown__summary">{row.label}</summary>
          {row.positives.length ? (
            <ul className="yds-spick-score-breakdown__plus">
              {row.positives.map((text) => (
                <li key={text}>✓ {text}</li>
              ))}
            </ul>
          ) : null}
          {row.negatives.length ? (
            <ul className="yds-spick-score-breakdown__minus">
              {row.negatives.map((text) => (
                <li key={text}>- {text}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ))}
    </div>
  )
}
