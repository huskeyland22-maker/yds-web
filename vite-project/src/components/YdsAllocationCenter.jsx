import { useMemo } from "react"
import { getStagePhilosophy, YDS_FEAR_CYCLE_RAIL } from "../content/ydsCyclePhilosophy.js"
import { macroStageDisplayLabel } from "../content/ydsLanguage.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { resolveMacroStageAllocation } from "../trading-zone/macroStageAllocation.js"
import { getFinalScore } from "../utils/tradingScores.js"

const STAGE_GUIDE = YDS_FEAR_CYCLE_RAIL.map(({ id, emoji, short }) => ({
  id,
  emoji,
  label: short,
}))

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
    const philosophy = getStagePhilosophy(stage?.id)
    const actionLines =
      stage?.id === "overheated"
        ? ["현금 비중 확대 우선", `현금 ${alloc.cashPct}% 유지 권장`]
        : stage?.id === "neutral"
          ? ["종목 리스트 · 탐색", `현금 ${alloc.cashPct}% 유지 권장`]
          : stage?.id === "interest"
            ? ["종목 발굴 · 현금 확보", `현금 ${alloc.cashPct}% · 매수 준비`]
            : stage?.id === "dca"
              ? ["핵심 매집 · 분할매수 실행", `현금 ${alloc.cashPct}%만 유지`]
              : ["보너스 · 계획 현금 투입", "드문 극단 공포 구간"]
    return {
      stageId: stage?.id ?? "neutral",
      stageLabel: stage?.label ?? macroStageDisplayLabel("neutral"),
      stageEmoji: stage?.emoji ?? "🟢",
      stageRole: philosophy.role,
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
          <span className="yds-allocation-center__stage-role"> · {view.stageRole}</span>
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
