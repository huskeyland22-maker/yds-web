import { useMemo } from "react"
import { buildRecommendationEngine } from "../utils/buildRecommendationEngine.js"

const STRENGTH_CLASS = {
  LOW: "recommend-engine__strength--low",
  MID: "recommend-engine__strength--mid",
  HIGH: "recommend-engine__strength--high",
}

/**
 * @param {{ label: string; value: string; accent?: boolean }} props
 */
function ActionRow({ label, value, accent = false }) {
  return (
    <div className={["recommend-engine__row", accent ? "recommend-engine__row--accent" : ""].join(" ")}>
      <span className="recommend-engine__label">{label}</span>
      <span className="recommend-engine__value">{value}</span>
    </div>
  )
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 * }} props
 */
export default function RecommendationEnginePanel({
  panicData = null,
  cycleScore = null,
  snapshot = null,
}) {
  const rec = useMemo(
    () => buildRecommendationEngine({ panicData, cycleScore, snapshot }),
    [panicData, cycleScore, snapshot],
  )

  if (!rec.ready) {
    return (
      <section className="recommend-engine" aria-label="추천 단계">
        <p className="m-0 recommend-engine__placeholder">Cycle·패닉 입력 후 추천 생성</p>
      </section>
    )
  }

  const strengthCls = STRENGTH_CLASS[rec.strength] ?? STRENGTH_CLASS.MID

  return (
    <section className="recommend-engine" aria-label="추천 단계">
      <header className="recommend-engine__head">
        <p className="m-0 cycle-eyebrow text-amber-200/90">추천 단계</p>
        <p className={`m-0 recommend-engine__strength ${strengthCls}`}>
          강도 <span className="font-bold">{rec.strength}</span>
        </p>
      </header>

      <div className="recommend-engine__hero">
        <p className="m-0 recommend-engine__hero-label">오늘 추천</p>
        <p className="m-0 recommend-engine__hero-action">{rec.today}</p>
      </div>

      {rec.reasons.length > 0 ? (
        <p className="m-0 recommend-engine__reasons">
          <span className="recommend-engine__reasons-tag">사유</span>
          {rec.reasons.join(" · ")}
        </p>
      ) : null}

      <div className="recommend-engine__grid">
        <ActionRow label="단기" value={rec.practical.short} />
        <ActionRow label="중기" value={rec.practical.mid} />
        <ActionRow label="장기" value={rec.practical.long} />
        <ActionRow label="실전" value={rec.practical.tactical} accent />
      </div>

      {rec.risk.length > 0 ? (
        <div className="recommend-engine__risk">
          <p className="m-0 recommend-engine__risk-tag">리스크</p>
          <p className="m-0 recommend-engine__risk-line">{rec.risk.join(" · ")}</p>
        </div>
      ) : null}
    </section>
  )
}
