import { useMemo } from "react"
import { computeMarketAction, pickMetricValue } from "../utils/panicMarketActionEngine.js"

const FIELD_LABEL = "shrink-0 text-[8px] font-semibold uppercase tracking-wide text-slate-500"

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
 * @param {{ panicData?: object | null }} props
 */
export default function PanicMarketActionPanel({ panicData = null }) {
  const guide = useMemo(() => computeMarketAction(panicData), [panicData])

  if (!guide) {
    return (
      <div className="border-t border-white/[0.06] px-2 py-1">
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
    <div className="border-t border-white/[0.06] px-2 py-1.5">
      <div className="border-l-2 border-cyan-400/35 pl-1.5">
        <p className="m-0 text-[10px] font-bold text-slate-300">{"\uC2DC\uC7A5 \uC561\uC158"}</p>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded border border-white/[0.06] bg-[#070a10] px-2 py-1.5 sm:grid-cols-5">
        {fields.map((f) => (
          <div key={f.label} className="min-w-0">
            <p className={`m-0 ${FIELD_LABEL}`}>{f.label}</p>
            <p className="m-0 mt-0.5 line-clamp-2 text-[9px] font-semibold leading-snug text-slate-200">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
