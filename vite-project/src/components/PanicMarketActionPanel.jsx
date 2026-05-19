import { useMemo } from "react"
import { computeMarketAction, pickMetricValue } from "../utils/panicMarketActionEngine.js"

/**
 * @param {object | null} panicData
 * @param {import("../utils/panicMarketActionEngine.js").MarketActionGuide} guide
 */
function buildActionRiskLine(panicData, guide) {
  const pc = pickMetricValue(panicData, "putCall")
  const vix = pickMetricValue(panicData, "vix")
  if (pc != null && pc <= 0.55) return "옵션 과열 · 콜 쏠림"
  if (pc != null && pc >= 0.85) return "헤지 · 풋 수요"
  if (vix != null && vix >= 25) return "변동성 확대"
  if (guide.regime === "extreme_greed" || guide.regime === "greed") return "과열 · 익절 검토"
  if (guide.regime === "extreme_fear" || guide.regime === "fear") return "공포 · 방어 우선"
  return guide.strategyThesis || "리스크 중립"
}

/**
 * @param {{ panicData?: object | null; strategyBrief?: string }} props
 */
export default function PanicMarketActionPanel({ panicData = null, strategyBrief = "" }) {
  const guide = useMemo(() => computeMarketAction(panicData), [panicData])

  if (!guide) {
    return (
      <div className="panic-desk-action">
        <p className="m-0 text-[9px] text-slate-500">
          {"3\uAC1C \uC774\uC0C1 \uC9C0\uD45C \uC785\uB825 \uC2DC \uC2DC\uC7A5 \uC561\uC158 \uD45C\uC2DC"}
        </p>
      </div>
    )
  }

  const riskLine = buildActionRiskLine(panicData, guide)
  const sectorLine = guide.sectors.length ? guide.sectors.join(" · ") : "분산"

  const fields = [
    {
      label: "\uD604\uC7AC \uAD6C\uAC04",
      value: `${guide.regimeLabel} · ${guide.actionMode}`,
    },
    { label: "\uB2E8\uAE30", value: guide.shortTerm },
    { label: "\uC911\uAE30", value: guide.midTerm },
    { label: "\uB9AC\uC2A4\uD06C", value: riskLine },
    { label: "\uC139\uD130", value: sectorLine },
  ]

  return (
    <div className="panic-desk-action">
      <p className="panic-desk-action__title">{"\uC2DC\uC7A5 \uC561\uC158"}</p>
      <div className="panic-desk-action__grid">
        {fields.map((f) => (
          <div key={f.label} className="min-w-0">
            <p className="panic-desk-action__field-label">{f.label}</p>
            <p className="panic-desk-action__field-value">{f.value}</p>
          </div>
        ))}
      </div>

      {strategyBrief ? (
        <div className="ai-brief ai-brief--after-action" role="note" aria-label={"\uC624\uB298 \uC804\uB7B5 \uBE0C\uB9AC\uD551"}>
          <p className="ai-brief__title">
            <span className="mr-1" aria-hidden>
              {"\uD83E\uDDE0"}
            </span>
            {"\uC624\uB298 \uC804\uB7B5 \uBE0C\uB9AC\uD551"}
          </p>
          <p className="ai-brief__body">{strategyBrief}</p>
        </div>
      ) : null}
    </div>
  )
}
