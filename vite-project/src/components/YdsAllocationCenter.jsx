import { useMemo } from "react"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { resolveMacroStageAllocation } from "../trading-zone/macroStageAllocation.js"
import { getFinalScore } from "../utils/tradingScores.js"

const STAGE_GUIDE = [
  { id: "overheated", emoji: "🔵", label: "과열" },
  { id: "neutral", emoji: "🟢", label: "중립" },
  { id: "interest", emoji: "🟡", label: "관심" },
  { id: "dca", emoji: "🟠", label: "분할매수" },
  { id: "panicBuy", emoji: "🔴", label: "패닉매수" },
]

function distributeStockBuckets(stockPct) {
  if (!Number.isFinite(stockPct)) return { largeCap: 40, aiGrowth: 20, dividend: 10 }
  const largeCap = Math.round((stockPct * 4) / 7)
  const aiGrowth = Math.round((stockPct * 2) / 7)
  const dividend = Math.max(0, stockPct - largeCap - aiGrowth)
  return { largeCap, aiGrowth, dividend }
}

/**
 * @param {{ panicData?: object | null }} props
 */
export default function YdsAllocationCenter({ panicData = null }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const stage = resolveMacroV1Status(score)
    const alloc = resolveMacroStageAllocation(stage?.id ?? "neutral")
    if (!alloc) return null
    const stockBuckets = distributeStockBuckets(alloc.stockPct)
    const actionLines =
      stage?.id === "overheated"
        ? ["현금 비중 확대 우선", `현금 ${alloc.cashPct}% 유지 권장`]
        : stage?.id === "neutral"
          ? ["AI 성장주 비중 확대 가능", `현금 ${alloc.cashPct}% 유지 권장`]
          : stage?.id === "interest"
            ? ["관심 종목 분할 진입 준비", `현금 ${alloc.cashPct}% 유지 권장`]
            : stage?.id === "dca"
              ? ["AI/대형주 분할매수 실행", `현금 ${alloc.cashPct}%만 유지`]
              : ["패닉매수 계획 집행", "현금 0%까지 투입 가능"]
    return {
      stageId: stage?.id ?? "neutral",
      stageLabel: stage?.label ?? "중립구간",
      stageEmoji: stage?.emoji ?? "🟢",
      stockPct: alloc.stockPct,
      cashPct: alloc.cashPct,
      stockBuckets,
      actionLines,
    }
  }, [panicData])

  if (!view) return null

  return (
    <section className="yds-allocation-center trading-card-shell panic-v2-section" aria-label="YDS 자산 배분">
      <div className="yds-allocation-center__head">
        <p className="m-0 yds-allocation-center__title">YDS 자산 배분</p>
        <p className="m-0 yds-allocation-center__stage">
          {view.stageEmoji} {view.stageLabel}
        </p>
      </div>

      <div className="yds-allocation-center__hero">
        <p className="m-0 yds-allocation-center__hero-label">권장 비중</p>
        <div className="yds-allocation-center__hero-grid">
          <p className="m-0 yds-allocation-center__hero-value font-mono tabular-nums">{view.stockPct}%</p>
          <p className="m-0 yds-allocation-center__hero-name">주식</p>
          <p className="m-0 yds-allocation-center__hero-value font-mono tabular-nums">{view.cashPct}%</p>
          <p className="m-0 yds-allocation-center__hero-name">현금</p>
        </div>
      </div>

      <div className="yds-allocation-center__detail" aria-label="주식 비중 상세">
        <p className="m-0 yds-allocation-center__detail-row">
          <span>미국 대형주</span>
          <strong className="font-mono tabular-nums">{view.stockBuckets.largeCap}%</strong>
        </p>
        <p className="m-0 yds-allocation-center__detail-row">
          <span>AI 성장주</span>
          <strong className="font-mono tabular-nums">{view.stockBuckets.aiGrowth}%</strong>
        </p>
        <p className="m-0 yds-allocation-center__detail-row">
          <span>현금흐름/배당</span>
          <strong className="font-mono tabular-nums">{view.stockBuckets.dividend}%</strong>
        </p>
        <p className="m-0 yds-allocation-center__detail-row">
          <span>현금</span>
          <strong className="font-mono tabular-nums">{view.cashPct}%</strong>
        </p>
      </div>

      <div className="yds-allocation-center__map" aria-label="단계별 자동 변경">
        {STAGE_GUIDE.map((step) => {
          const alloc = resolveMacroStageAllocation(step.id)
          return (
            <p
              key={step.id}
              className={[
                "m-0 yds-allocation-center__map-row",
                view.stageId === step.id ? "yds-allocation-center__map-row--active" : "",
              ].join(" ")}
            >
              <span>{step.emoji} {step.label}</span>
              <strong className="font-mono tabular-nums">{alloc?.stockPct ?? 0}/{alloc?.cashPct ?? 0}</strong>
            </p>
          )
        })}
      </div>

      <div className="yds-allocation-center__action" aria-label="오늘 행동">
        <p className="m-0 yds-allocation-center__action-title">오늘 행동</p>
        <p className="m-0 yds-allocation-center__action-line">✓ {view.actionLines[0]}</p>
        <p className="m-0 yds-allocation-center__action-line">✓ {view.actionLines[1]}</p>
      </div>
    </section>
  )
}
