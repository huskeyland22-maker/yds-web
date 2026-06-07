import { useMemo } from "react"
import { getStagePhilosophy } from "../content/ydsCyclePhilosophy.js"
import { macroStageDisplayLabel } from "../content/ydsLanguage.js"
import {
  OVERHEAT_ALLOCATION_MAP,
  YDS_OVERHEAT_ALLOCATION_PHILOSOPHY,
  resolveEffectiveMarketAllocation,
} from "../content/ydsOverheatAllocation.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { resolveMacroStageAllocation } from "../trading-zone/macroStageAllocation.js"
import { getFinalScore } from "../utils/tradingScores.js"

const PANIC_ALLOCATION_MAP = [
  { id: "neutral", emoji: "🟢", label: "공포 부족", displayRatio: "60 / 40", stockPct: 60, cashPct: 40 },
  { id: "interest", emoji: "🟡", label: "관심", displayRatio: "75 / 25", stockPct: 75, cashPct: 25 },
  { id: "dca", emoji: "🟠", label: "분할매수", displayRatio: "90 / 10", stockPct: 90, cashPct: 10 },
  { id: "panicBuy", emoji: "🔴", label: "인생 타점", displayRatio: "100 / 0", stockPct: 100, cashPct: 0 },
]

function distributeStockBuckets(stockPct) {
  if (!Number.isFinite(stockPct)) return { largeCap: 40, aiGrowth: 20, dividend: 10 }
  const largeCap = Math.round((stockPct * 4) / 7)
  const aiGrowth = Math.round((stockPct * 2) / 7)
  const dividend = Math.max(0, stockPct - largeCap - aiGrowth)
  return { largeCap, aiGrowth, dividend }
}

/**
 * @param {{ panicData?: object | null; compact?: boolean }} props
 */
export default function YdsAllocationCenter({ panicData = null, compact = false }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const stage = resolveMacroV1Status(score)
    const effective = resolveEffectiveMarketAllocation(panicData)
    if (!effective) return null

    const stockBuckets = distributeStockBuckets(effective.stockPct)
    const philosophy = getStagePhilosophy(stage?.id ?? "neutral")
    const overheatActive = effective.mode === "overheat" && effective.tier

    const stageLabel = overheatActive
      ? `${effective.tier.emoji} ${effective.tier.label}`
      : `${stage?.emoji ?? "🟢"} ${stage?.label ?? macroStageDisplayLabel("neutral")}`

    const stageRole = overheatActive ? effective.tier.note : philosophy.role

    const actionLines =
      overheatActive && effective.actions?.length
        ? effective.actions.slice(0, 2).concat(
            effective.cashPct != null
              ? [`현금 ${effective.cashPct}% 목표`]
              : effective.actions.slice(2, 3),
          )
        : stage?.id === "overheated"
          ? ["현금 비중 확대 우선", `현금 ${effective.cashPct}% 유지 권장`]
          : stage?.id === "neutral"
            ? ["종목 리스트 · 탐색", `현금 ${effective.cashPct}% 유지 권장`]
            : stage?.id === "interest"
              ? ["종목 발굴 · 현금 확보", `현금 ${effective.cashPct}% · 매수 준비`]
              : stage?.id === "dca"
                ? ["핵심 매집 · 분할매수 실행", `현금 ${effective.cashPct}%만 유지`]
                : ["보너스 · 계획 현금 투입", "드문 극단 공포 구간"]

    return {
      stageId: stage?.id ?? "neutral",
      overheatTierId: effective.tier?.id ?? null,
      stageLabel,
      stageRole,
      stockPct: effective.stockPct,
      cashPct: effective.cashPct,
      stockBuckets,
      actionLines,
      showOverheatPhilosophy: Boolean(overheatActive),
    }
  }, [panicData])

  if (!view) return null

  if (compact) {
    return (
      <section className="yds-allocation-center yds-allocation-center--compact" aria-label="YDS 자산 배분">
        <p className="m-0 yds-allocation-center__title">YDS 자산 배분</p>
        <div className="yds-allocation-center__hero yds-allocation-center__hero--compact">
          <div className="yds-allocation-center__hero-grid yds-allocation-center__hero-grid--compact">
            <p className="m-0 yds-allocation-center__hero-value font-mono tabular-nums">{view.stockPct}%</p>
            <p className="m-0 yds-allocation-center__hero-name">주식</p>
            <p className="m-0 yds-allocation-center__hero-value font-mono tabular-nums">{view.cashPct}%</p>
            <p className="m-0 yds-allocation-center__hero-name">현금</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="yds-allocation-center trading-card-shell panic-v2-section" aria-label="YDS 자산 배분">
      <div className="yds-allocation-center__head">
        <p className="m-0 yds-allocation-center__title">YDS 자산 배분</p>
        <p className="m-0 yds-allocation-center__stage">
          {view.stageLabel}
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
        <p
          className={[
            "m-0 yds-allocation-center__map-row",
            view.stageId === "neutral" && !view.overheatTierId
              ? "yds-allocation-center__map-row--active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span>{PANIC_ALLOCATION_MAP[0].emoji} {PANIC_ALLOCATION_MAP[0].label}</span>
          <strong className="font-mono tabular-nums">{PANIC_ALLOCATION_MAP[0].displayRatio}</strong>
        </p>
        {OVERHEAT_ALLOCATION_MAP.map((tier) => (
          <p
            key={tier.id}
            className={[
              "m-0 yds-allocation-center__map-row",
              view.overheatTierId === tier.id ? "yds-allocation-center__map-row--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>{tier.emoji} {tier.label}</span>
            <strong className="font-mono tabular-nums">{tier.displayRatio}</strong>
          </p>
        ))}
        {PANIC_ALLOCATION_MAP.slice(1).map((step) => {
          const alloc = resolveMacroStageAllocation(step.id)
          return (
            <p
              key={step.id}
              className={[
                "m-0 yds-allocation-center__map-row",
                !view.overheatTierId && view.stageId === step.id
                  ? "yds-allocation-center__map-row--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>{step.emoji} {step.label}</span>
              <strong className="font-mono tabular-nums">
                {alloc ? `${alloc.stockPct} / ${alloc.cashPct}` : step.displayRatio}
              </strong>
            </p>
          )
        })}
      </div>

      {view.showOverheatPhilosophy ? (
        <div className="yds-allocation-center__philosophy" aria-label="과열권 철학">
          {YDS_OVERHEAT_ALLOCATION_PHILOSOPHY.map((line) => (
            <p key={line} className="m-0 yds-allocation-center__philosophy-line">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div className="yds-allocation-center__action" aria-label="오늘 행동">
        <p className="m-0 yds-allocation-center__action-title">오늘 행동</p>
        <p className="m-0 yds-allocation-center__action-line">✓ {view.actionLines[0]}</p>
        <p className="m-0 yds-allocation-center__action-line">✓ {view.actionLines[1]}</p>
      </div>
    </section>
  )
}
